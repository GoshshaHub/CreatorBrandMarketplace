import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "../../../../../../lib/firebase-admin";
import { authorizeGrowthAdmin, GrowthAdminAuthError } from "../../../../../../lib/agents/growth-01/admin-auth";
import { buildDailyBriefMarkdown } from "../../../../../../lib/agents/growth-01/brief";
import { loadGrowthContractMetadata } from "../../../../../../lib/agents/growth-01/contract";
import { scoreGrowthCandidate } from "../../../../../../lib/agents/growth-01/scoring";
import type { GrowthRunRequest, ValidatedGrowthRun, ValidationFinding } from "../../../../../../lib/agents/growth-01/types";
import {
  MAX_GROWTH_REQUEST_BYTES,
  MAX_QUALIFIED_RESULTS,
  validateGrowthCandidate,
  validateGrowthRunRequest,
  validateQualifiedCount,
} from "../../../../../../lib/agents/growth-01/validation";

export const runtime = "nodejs";

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const declaredLength = Number(request.headers.get("content-length") || "0");
    if (declaredLength > MAX_GROWTH_REQUEST_BYTES) {
      return errorResponse(413, "Request exceeds the Founder-preview size limit.");
    }

    const authorized = await authorizeGrowthAdmin(request, {
      verifyIdToken: (token) => adminAuth.verifyIdToken(token),
      loadUser: async (uid) => {
        const snapshot = await adminDb.collection("users").doc(uid).get();
        return { exists: snapshot.exists, isAdmin: snapshot.data()?.isAdmin === true };
      },
    });

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_GROWTH_REQUEST_BYTES) {
      return errorResponse(413, "Request exceeds the Founder-preview size limit.");
    }

    let input: GrowthRunRequest;
    try {
      input = JSON.parse(rawBody) as GrowthRunRequest;
    } catch {
      return errorResponse(400, "Request body must be valid JSON.");
    }

    const findings: ValidationFinding[] = validateGrowthRunRequest(input);
    const scored = Array.isArray(input.candidates)
      ? input.candidates.map((candidate) => {
          const result = scoreGrowthCandidate(candidate);
          findings.push(...result.findings);
          const validation = validateGrowthCandidate(result.candidate);
          findings.push(...validation.findings);
          return result.candidate;
        })
      : [];
    const maximumQualified = input.maximumQualified ?? MAX_QUALIFIED_RESULTS;
    findings.push(...validateQualifiedCount(scored, maximumQualified));

    const contract = await loadGrowthContractMetadata();
    const status = findings.some((finding) => finding.severity === "error") ? "validation_failed" : "valid";
    const output: ValidatedGrowthRun = {
      run: {
        id: randomUUID(),
        requestedByUid: authorized.uid,
        requestedAt: new Date().toISOString(),
        asOfDate: input.asOfDate,
        marketFocus: input.marketFocus,
        status,
        candidateCount: scored.length,
        qualifiedCount: scored.filter((candidate) => candidate.selectionStatus === "qualified").length,
        authority: "founder_supervised_preview_only",
        persistence: false,
        externalCommunication: false,
      },
      contract,
      candidates: scored,
      findings,
      dailyBriefMarkdown: buildDailyBriefMarkdown({
        asOfDate: input.asOfDate,
        marketPattern: input.marketPattern,
        candidates: scored,
        findings,
      }),
    };

    return NextResponse.json(output, {
      status: status === "valid" ? 200 : 422,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof GrowthAdminAuthError) return errorResponse(error.status, error.message);
    console.error("GROWTH-01 Founder preview failed", error);
    return errorResponse(500, "The GROWTH-01 Founder preview could not be completed.");
  }
}
