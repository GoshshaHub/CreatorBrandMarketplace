import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";

export const CLOSER_CONTRACT_PATH = "agents/closer-01/AGENT.md" as const;
export const CLOSER_CONTRACT_VERSION = "V1" as const;
export const APPROVED_CLOSER_CONTRACT_SHA256 = "097371ac3333f12321ae834c805eece1e2f6a967009de44bf742df4242cb0368" as const;

export class CloserContractIntegrityError extends Error {
  constructor(message:string){super(message);this.name="CloserContractIntegrityError";}
}
export function verifyCloserContractContents(contents:Uint8Array):string{
  if(!contents.length)throw new CloserContractIntegrityError("The CLOSER-01 contract is empty.");
  const hash=createHash("sha256").update(contents).digest("hex");
  if(hash!==APPROVED_CLOSER_CONTRACT_SHA256)throw new CloserContractIntegrityError("The CLOSER-01 V1 contract failed its approved integrity check.");
  return hash;
}
export async function loadCloserContractMetadata(now=new Date()){
  const contents=await readFile(path.join(process.cwd(),CLOSER_CONTRACT_PATH));
  return{name:"CLOSER-01"as const,version:CLOSER_CONTRACT_VERSION,path:CLOSER_CONTRACT_PATH,sha256:verifyCloserContractContents(contents),byteLength:contents.length,loadedAt:now.toISOString(),repositoryCommit:process.env.VERCEL_GIT_COMMIT_SHA?.trim()||null};
}
