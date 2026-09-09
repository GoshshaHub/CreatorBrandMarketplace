import { createHash, randomUUID } from "crypto";
import type { Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../firebase-admin";

export const PRODUCT_IDENTITY_VERSION = 5;
export const PRODUCT_IDENTITY_MATCHER = "web-product-identity-v5";

const STOPWORDS = new Set([
  "the", "and", "for", "with", "a", "an", "or", "of", "to", "in", "on", "at", "by", "is", "it",
  "new", "reviews", "review", "net", "no", "number", "ml", "oz", "fl", "floz", "g", "kg", "lb", "lbs",
]);
const OCR_FIXES: Record<string, string> = {
  shampoc: "shampoo",
  shamp00: "shampoo",
  shamppo: "shampoo",
  conditoner: "conditioner",
  condtioner: "conditioner",
  frize: "frizz",
};

export type ProductIdentityV5Resolution = {
  collectionId: string;
  masterId: string;
  canonicalName: string;
  canonicalSlug: string;
  aliasId: string;
  rawOcr: string;
  normalizedOcr: string;
  tokens: string[];
  brandTokens: string[];
  resolution: "exact_alias" | "existing_collection" | "created_collection";
  collectionExisted: boolean;
  aliasExisted: boolean;
  matcherVersion: typeof PRODUCT_IDENTITY_MATCHER;
};

export class ProductIdentityAmbiguousError extends Error {
  code = "PRODUCT_IDENTITY_AMBIGUOUS";

  constructor() {
    super("Packaging text matched more than one possible product identity. Review and correct the extracted text.");
  }
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeIdentityTextV5(raw: string): string {
  const cleaned = raw.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const seen = new Set<string>();
  return cleaned.split(" ")
    .map((token) => OCR_FIXES[token] || token)
    .filter((token) => token.length >= 2)
    .filter((token) => !STOPWORDS.has(token))
    .filter((token) => {
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    })
    .join(" ");
}

export function identityTokensV5(raw: string, limit = 32): string[] {
  return normalizeIdentityTextV5(raw).split(" ").filter(Boolean).slice(0, limit);
}

export function canonicalTokensV5(raw: string): string[] {
  return Array.from(new Set(identityTokensV5(raw))).sort();
}

function shortHash(value: string, length = 12): string {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

export function createAliasIdV5(raw: string): string {
  const normalized = normalizeIdentityTextV5(raw);
  const readable = normalized.split(" ").slice(0, 12).join("-").slice(0, 72).replace(/^-+|-+$/g, "");
  const digest = shortHash(normalized, 12);
  return readable ? `${readable}-${digest}` : `alias-${digest}`;
}

function legacyMasterId(storageCollection: string): string {
  return "prd_legacy_" + shortHash(storageCollection.toLowerCase(), 24);
}

function newMasterId(): string {
  return "prd_" + randomUUID().replace(/-/g, "").toLowerCase();
}

function getBrandTokens(brandName: string): string[] {
  return identityTokensV5(brandName, 8);
}

function getLegacyAliasTokens(aliasId: string): string[] {
  return aliasId.replace(/-[a-f0-9]{12}$/i, "").split("-").map((token) => token.trim()).filter((token) => token.length >= 2);
}

function calculateMatch(scanTokens: string[], aliasTokens: string[]) {
  const usedAliasIndexes = new Set<number>();
  const matched: string[] = [];
  let score = 0;
  let matches = 0;
  for (const scanToken of scanTokens) {
    let bestIndex = -1;
    let bestValue = 0;
    for (let index = 0; index < aliasTokens.length; index += 1) {
      if (usedAliasIndexes.has(index)) continue;
      const aliasToken = aliasTokens[index];
      let value = 0;
      if (scanToken === aliasToken) value = 1;
      else if (
        scanToken.length >= 5 && aliasToken.length >= 5 &&
        (scanToken.startsWith(aliasToken) || aliasToken.startsWith(scanToken))
      ) value = 0.65;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    }
    if (bestIndex >= 0 && bestValue > 0) {
      usedAliasIndexes.add(bestIndex);
      score += bestValue;
      matches += 1;
      matched.push(scanToken);
    }
  }
  return {
    score,
    matches,
    coverage: matches / Math.max(1, new Set(aliasTokens).size),
    matched,
  };
}

export async function resolveProductIdentityV5(params: {
  rawOcr: string;
  brandName: string;
  productName: string;
  requireUnambiguousMatch?: boolean;
}): Promise<ProductIdentityV5Resolution> {
  const { rawOcr, brandName, productName } = params;
  const normalizedOcr = normalizeIdentityTextV5(rawOcr);
  const tokens = identityTokensV5(rawOcr);
  if (tokens.length < 2) {
    throw new Error("Enter at least two meaningful words visible on the product packaging.");
  }
  const brandTokens = getBrandTokens(brandName);
  const scanSet = new Set(tokens);
  const brandSet = new Set(brandTokens);
  const aliasId = createAliasIdV5(rawOcr);
  const exactAlias = await adminDb.collection("aliases").doc(aliasId).get();
  if (exactAlias.exists) {
    const alias = exactAlias.data() as Record<string, any>;
    const collectionId = clean(alias.storage_collection || alias.canonical_collection);
    if (collectionId) {
      return {
        collectionId,
        masterId: clean(alias.master_id) || legacyMasterId(collectionId),
        canonicalName: productName || clean(alias.canonical_name) || rawOcr,
        canonicalSlug: collectionId,
        aliasId,
        rawOcr,
        normalizedOcr,
        tokens,
        brandTokens,
        resolution: "exact_alias",
        collectionExisted: true,
        aliasExisted: true,
        matcherVersion: PRODUCT_IDENTITY_MATCHER,
      };
    }
  }

  type Candidate = {
    masterId: string;
    collectionId: string;
    score: number;
    matches: number;
    coverage: number;
    distinguishingMatches: number;
  };
  const aliasesSnapshot = await adminDb.collection("aliases").get();
  const bestByMaster = new Map<string, Candidate>();
  for (const aliasDocument of aliasesSnapshot.docs) {
    const alias = aliasDocument.data() as Record<string, any>;
    const collectionId = clean(alias.storage_collection || alias.canonical_collection);
    if (!collectionId) continue;
    const masterId = clean(alias.master_id) || legacyMasterId(collectionId);
    const storedTokens = Array.isArray(alias.identity_tokens) && alias.identity_tokens.length > 0
      ? alias.identity_tokens.map(clean).filter(Boolean)
      : getLegacyAliasTokens(aliasDocument.id);
    if (storedTokens.length < 3) continue;
    const storedBrandTokens = Array.isArray(alias.brand_tokens)
      ? alias.brand_tokens.map(clean).filter(Boolean)
      : [];
    const storedBrandSet = new Set<string>(storedBrandTokens);
    if (brandSet.size > 0 && storedBrandSet.size > 0 && !Array.from(brandSet).some((token) => storedBrandSet.has(token))) continue;
    if (storedBrandSet.size > 0 && !Array.from(storedBrandSet).some((token) => scanSet.has(token))) continue;
    const match = calculateMatch(tokens, storedTokens);
    if (match.matches <= 0) continue;
    const brandEvidence = storedBrandSet.size > 0 ? storedBrandSet : brandSet;
    const distinguishingMatches = new Set(match.matched.filter((token) => !brandEvidence.has(token))).size;
    const candidate = {
      masterId,
      collectionId,
      score: match.score + match.coverage * 2 + distinguishingMatches * 0.15,
      matches: match.matches,
      coverage: match.coverage,
      distinguishingMatches,
    };
    const currentBest = bestByMaster.get(masterId);
    if (!currentBest || candidate.score > currentBest.score) bestByMaster.set(masterId, candidate);
  }
  const ranked = Array.from(bestByMaster.values()).sort((first, second) => {
    if (Math.abs(second.score - first.score) > 0.001) return second.score - first.score;
    if (first.matches !== second.matches) return second.matches - first.matches;
    return second.coverage - first.coverage;
  });
  const best = ranked[0];
  const runnerUp = ranked[1];
  if (best) {
    const margin = runnerUp ? best.score - runnerUp.score : Number.POSITIVE_INFINITY;
    const meetsMatchQuality = best.matches >= 5 && best.coverage >= 0.6 && best.distinguishingMatches >= 3;
    if (meetsMatchQuality && margin >= 1.25) {
      return {
        collectionId: best.collectionId,
        masterId: best.masterId,
        canonicalName: productName || rawOcr,
        canonicalSlug: best.collectionId,
        aliasId,
        rawOcr,
        normalizedOcr,
        tokens,
        brandTokens,
        resolution: "existing_collection",
        collectionExisted: true,
        aliasExisted: false,
        matcherVersion: PRODUCT_IDENTITY_MATCHER,
      };
    }
    if (meetsMatchQuality && margin < 1.25 && params.requireUnambiguousMatch) {
      throw new ProductIdentityAmbiguousError();
    }
  }
  const masterId = newMasterId();
  return {
    collectionId: masterId,
    masterId,
    canonicalName: productName || rawOcr,
    canonicalSlug: masterId,
    aliasId,
    rawOcr,
    normalizedOcr,
    tokens,
    brandTokens,
    resolution: "created_collection",
    collectionExisted: false,
    aliasExisted: false,
    matcherVersion: PRODUCT_IDENTITY_MATCHER,
  };
}

export function writeProductIdentityV5(params: {
  transaction: Transaction;
  resolution: ProductIdentityV5Resolution;
  source: string;
}) {
  const { transaction, resolution } = params;
  const canonicalTokens = canonicalTokensV5(resolution.rawOcr);
  const common = {
    master_id: resolution.masterId,
    storage_collection: resolution.collectionId,
    canonical_name: resolution.canonicalName,
    normalized_ocr: resolution.normalizedOcr,
    identity_tokens: resolution.tokens,
    canonical_tokens: canonicalTokens,
    canonical_fingerprint: canonicalTokens.join("|"),
    brand_tokens: resolution.brandTokens,
    identity_version: PRODUCT_IDENTITY_VERSION,
    updated_at: FieldValue.serverTimestamp(),
  };
  transaction.set(adminDb.collection("products").doc(resolution.masterId), {
    ...common,
    status: "active",
    created_at: FieldValue.serverTimestamp(),
  }, { merge: true });
  transaction.set(adminDb.collection("aliases").doc(resolution.aliasId), {
    ...common,
    canonical_collection: resolution.collectionId,
    token_count: resolution.tokens.length,
  }, { merge: true });
  transaction.set(adminDb.collection(resolution.collectionId).doc("_meta"), {
    master_id: resolution.masterId,
    storage_collection: resolution.collectionId,
    canonical_name: resolution.canonicalName,
    normalized_ocr: resolution.normalizedOcr,
    source: params.source,
    updated_at: FieldValue.serverTimestamp(),
    created_at: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export function bindExistingProductIdentityV5(params: {
  rawOcr: string;
  brandName: string;
  productName: string;
  collectionId: string;
  masterId: string;
}): ProductIdentityV5Resolution {
  const tokens = identityTokensV5(params.rawOcr);
  if (tokens.length < 2) throw new Error("Enter at least two meaningful words visible on the product packaging.");
  return {
    collectionId: params.collectionId,
    masterId: params.masterId,
    canonicalName: params.productName || params.rawOcr,
    canonicalSlug: params.collectionId,
    aliasId: createAliasIdV5(params.rawOcr),
    rawOcr: params.rawOcr,
    normalizedOcr: normalizeIdentityTextV5(params.rawOcr),
    tokens,
    brandTokens: getBrandTokens(params.brandName),
    resolution: "existing_collection",
    collectionExisted: true,
    aliasExisted: false,
    matcherVersion: PRODUCT_IDENTITY_MATCHER,
  };
}
