import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";

export const REVENUE_CONTRACT_PATH = "agents/revenue-01/AGENT.md" as const;
export const REVENUE_CONTRACT_VERSION = "V1.1" as const;
export const APPROVED_REVENUE_CONTRACT_SHA256 = "972c2d2dbc482fc6252f05ca77bc2ab1a0c5fd74936bd95fbd30637254a1bb33" as const;

export class RevenueContractIntegrityError extends Error {
  constructor(message: string) { super(message); this.name = "RevenueContractIntegrityError"; }
}

export function verifyRevenueContractContents(contents: Uint8Array): string {
  if (!contents.length) throw new RevenueContractIntegrityError("The REVENUE-01 contract is empty.");
  const hash = createHash("sha256").update(contents).digest("hex");
  if (hash !== APPROVED_REVENUE_CONTRACT_SHA256) throw new RevenueContractIntegrityError("The REVENUE-01 V1.1 contract failed its approved integrity check.");
  return hash;
}

export async function loadRevenueContractMetadata(now = new Date()) {
  const contents = await readFile(path.join(process.cwd(), REVENUE_CONTRACT_PATH));
  return { name: "REVENUE-01" as const, version: REVENUE_CONTRACT_VERSION, path: REVENUE_CONTRACT_PATH, sha256: verifyRevenueContractContents(contents), byteLength: contents.length, loadedAt: now.toISOString(), repositoryCommit: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null };
}
