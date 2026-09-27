import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";

export const CRM_CONTRACT_PATH = "agents/crm-01/AGENT.md" as const;
export const CRM_CONTRACT_VERSION = "V1.1" as const;
export const APPROVED_CRM_CONTRACT_SHA256 = "68129fc2d2d4fdd5646b93879d0b469a71c3ef4c93e84fd0e4aaccc011fa8194" as const;

export class CrmContractIntegrityError extends Error {
  constructor(message: string) { super(message); this.name = "CrmContractIntegrityError"; }
}

export function verifyCrmContractContents(contents: Uint8Array): string {
  if (!contents.length) throw new CrmContractIntegrityError("The CRM-01 contract is empty.");
  const hash = createHash("sha256").update(contents).digest("hex");
  if (hash !== APPROVED_CRM_CONTRACT_SHA256) throw new CrmContractIntegrityError("The CRM-01 V1.1 contract failed its approved integrity check.");
  return hash;
}

export async function loadCrmContractMetadata(now = new Date()) {
  const contents = await readFile(path.join(process.cwd(), CRM_CONTRACT_PATH));
  return { name: "CRM-01" as const, version: CRM_CONTRACT_VERSION, path: CRM_CONTRACT_PATH, sha256: verifyCrmContractContents(contents), byteLength: contents.length, loadedAt: now.toISOString(), repositoryCommit: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null };
}
