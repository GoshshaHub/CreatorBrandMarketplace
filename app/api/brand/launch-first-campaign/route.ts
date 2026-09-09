import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "../../../../lib/firebase-admin";
import {
  createAndPublishFirstFreeActivation,
  firstFreeIds,
  OcrCorrectionRequiredError,
  repairFirstFreeProductIdentity,
  resumeFirstFreeActivation,
  verifyFirstFreeScanReady,
} from "../../../../lib/retail-media/create-first-free-activation";

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

async function authenticatedBrand(request: Request) {
  const token = bearerToken(request);
  if (!token) throw new Error("AUTHENTICATION_REQUIRED");
  const decoded = await adminAuth.verifyIdToken(token);
  const [userSnap, brandSnap] = await Promise.all([
    adminDb.collection("users").doc(decoded.uid).get(),
    adminDb.collection("brands").doc(decoded.uid).get(),
  ]);
  const roles = userSnap.exists && Array.isArray(userSnap.data()?.roles)
    ? userSnap.data()?.roles
    : [];
  if (!brandSnap.exists || !roles.includes("brand")) {
    throw new Error("BRAND_AUTHORIZATION_REQUIRED");
  }
  return { uid: decoded.uid, brand: brandSnap.data() || {}, user: userSnap.data() || {} };
}

async function authenticatedActor(request: Request) {
  const token = bearerToken(request);
  if (!token) throw new Error("AUTHENTICATION_REQUIRED");
  const decoded = await adminAuth.verifyIdToken(token);
  const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
  const user = userSnap.exists ? userSnap.data() || {} : {};
  const roles = Array.isArray(user.roles)
    ? user.roles as string[]
    : [];
  const isAdmin = user.isAdmin === true || user.role === "admin" ||
    roles.includes("admin") || decoded.admin === true || decoded.role === "admin";
  const isBrand = user.role === "brand" || roles.includes("brand");
  if (!isBrand && !isAdmin) {
    throw new Error("BRAND_AUTHORIZATION_REQUIRED");
  }
  return { uid: decoded.uid, isAdmin };
}

function errorResponse(error: any) {
  const message = String(error?.message || "Unable to process the free IRL campaign.");
  if (error instanceof OcrCorrectionRequiredError || error?.code === "OCR_CORRECTION_REQUIRED") {
    return NextResponse.json({
      error: message,
      code: "OCR_CORRECTION_REQUIRED",
      extractedText: String(error?.extractedText || ""),
      confidence: Number.isFinite(error?.confidence) ? Number(error.confidence) : null,
    }, { status: 422 });
  }
  if (message === "AUTHENTICATION_REQUIRED") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (message === "BRAND_AUTHORIZATION_REQUIRED" || message === "NOT_AUTHORIZED") {
    return NextResponse.json({ error: "Brand authorization required." }, { status: 403 });
  }
  if (message === "FIRST_FREE_ALREADY_CLAIMED") {
    return NextResponse.json(
      { error: "This Brand account has already used its free first IRL campaign." },
      { status: 409 }
    );
  }
  if (message === "FIRST_FREE_PUBLICATION_IN_PROGRESS") {
    return NextResponse.json(
      { error: "This free IRL campaign is already being published." },
      { status: 409 }
    );
  }
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    const identity = await authenticatedBrand(request);
    const campaignId = new URL(request.url).searchParams.get("campaignId") || "";
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId is required." }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      ...(await verifyFirstFreeScanReady({ brandId: identity.uid, campaignId })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === "repair_product_identity") {
      const actor = await authenticatedActor(request);
      const isAdmin = actor.isAdmin;
      const brandId = isAdmin ? String(body.brandId || "") : actor.uid;
      if (!brandId) throw new Error("Brand authorization required.");
      const campaignId = String(body.campaignId || "");
      const result = await repairFirstFreeProductIdentity({
        brandId,
        campaignId,
        requestedByUserId: actor.uid,
        requestedByRole: isAdmin ? "admin" : "brand",
        correctedOcrText: String(body.correctedOcrText || ""),
        ocrCorrectionConfirmed: body.ocrCorrectionConfirmed === true,
      });
      return NextResponse.json({ ok: true, campaignId, ...result });
    }
    const identity = await authenticatedBrand(request);
    if (body.action === "retry") {
      const campaignId = String(body.campaignId || "");
      const result = await resumeFirstFreeActivation({
        brandId: identity.uid,
        campaignId,
        rightsBasis: body.rightsBasis,
        contentRightsConfirmed: body.contentRightsConfirmed === true,
        audioRightsConfirmed: body.audioRightsConfirmed === true,
        appearanceRightsConfirmed: body.appearanceRightsConfirmed === true,
        correctedOcrText: String(body.correctedOcrText || ""),
        ocrCorrectionConfirmed: body.ocrCorrectionConfirmed === true,
      });
      return NextResponse.json({ ok: true, campaignId, ...result });
    }
    const result = await createAndPublishFirstFreeActivation({
      brandId: identity.uid,
      brandName: String(body.brandName || identity.brand.brandName || identity.user.displayName || ""),
      productName: String(body.productName || ""),
      campaignTitle: String(body.campaignTitle || ""),
      destinationUrl: String(body.destinationUrl || ""),
      mediaStoragePath: String(body.mediaStoragePath || ""),
      targetImageStoragePath: String(body.targetImageStoragePath || ""),
      rightsBasis: body.rightsBasis,
      contentRightsConfirmed: body.contentRightsConfirmed === true,
      audioRightsConfirmed: body.audioRightsConfirmed === true,
      appearanceRightsConfirmed: body.appearanceRightsConfirmed === true,
      correctedOcrText: String(body.correctedOcrText || ""),
      ocrCorrectionConfirmed: body.ocrCorrectionConfirmed === true,
    });
    return NextResponse.json({
      ok: true,
      campaignId: firstFreeIds(identity.uid).campaignId,
      ...result,
    });
  } catch (error) {
    console.error("Free first IRL campaign error:", error);
    return errorResponse(error);
  }
}
