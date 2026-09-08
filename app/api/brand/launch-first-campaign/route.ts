import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "../../../../lib/firebase-admin";
import {
  createAndPublishFirstFreeActivation,
  firstFreeIds,
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

function errorResponse(error: any) {
  const message = String(error?.message || "Unable to process the free IRL campaign.");
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
    const identity = await authenticatedBrand(request);
    const body = await request.json();
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
