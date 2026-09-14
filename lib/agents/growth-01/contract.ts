import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";

import type { ContractMetadata } from "./types";

export const GROWTH_CONTRACT_PATH = "agents/growth-01/AGENT.md" as const;

export async function loadGrowthContractMetadata(now = new Date()): Promise<ContractMetadata> {
  const absolutePath = path.join(process.cwd(), GROWTH_CONTRACT_PATH);
  const contents = await readFile(absolutePath);
  if (contents.length === 0) {
    throw new Error("The frozen GROWTH-01 contract is empty.");
  }

  return {
    name: "GROWTH-01",
    version: "V1",
    path: GROWTH_CONTRACT_PATH,
    sha256: createHash("sha256").update(contents).digest("hex"),
    byteLength: contents.length,
    loadedAt: now.toISOString(),
    repositoryCommit: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null,
  };
}
