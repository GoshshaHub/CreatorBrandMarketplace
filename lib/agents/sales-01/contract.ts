import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";

import type { SalesContractMetadata } from "./types";

export const SALES_CONTRACT_PATH = "agents/sales-01/AGENT.md" as const;
export const SALES_CONTRACT_VERSION = "V1.2" as const;
export const APPROVED_SALES_CONTRACT_SHA256 = "0428ae67558fb21d288e3588139a8f46d2fdd17cc436b07f7ce1f17f14c265e6" as const;
export const APPROVED_GROWTH_CONTRACT_SHA256 = "618b895eb97479db83edc668a32bc4db93a222429b27e2a8f6cbadc2bbb7e860" as const;

export class SalesContractIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesContractIntegrityError";
  }
}

export function verifySalesContractContents(contents: Uint8Array): string {
  if (contents.length === 0) throw new SalesContractIntegrityError("The SALES-01 contract is empty.");
  const sha256 = createHash("sha256").update(contents).digest("hex");
  if (sha256 !== APPROVED_SALES_CONTRACT_SHA256) {
    throw new SalesContractIntegrityError("The SALES-01 V1.2 contract failed its approved integrity check.");
  }
  return sha256;
}

export async function loadSalesContractMetadata(now = new Date()): Promise<SalesContractMetadata> {
  const contents = await readFile(path.join(process.cwd(), SALES_CONTRACT_PATH));
  const sha256 = verifySalesContractContents(contents);
  return {
    name: "SALES-01",
    version: SALES_CONTRACT_VERSION,
    path: SALES_CONTRACT_PATH,
    sha256,
    byteLength: contents.length,
    loadedAt: now.toISOString(),
    repositoryCommit: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null,
  };
}

export function verifyGrowthContractIdentity(sha256: string): void {
  if (sha256 !== APPROVED_GROWTH_CONTRACT_SHA256) {
    throw new SalesContractIntegrityError("The supplied GROWTH-01 contract identity is not the approved frozen contract.");
  }
}
