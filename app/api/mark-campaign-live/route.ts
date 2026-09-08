import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "../../../lib/firebase-admin";
import { verifyFirstFreeScanReady } from "../../../lib/retail-media/create-first-free-activation";
import { publishRetailAsset } from "../../../lib/retail-media/publish-retail-asset";

function tokenFrom(request: Request): string {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

export async function POST(request: Request) {
  try {
    const token = tokenFrom(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const user = userSnap.exists ? userSnap.data() || {} : {};
    const roles = Array.isArray(user.roles) ? user.roles : [];
    const isAdmin = user.isAdmin === true || roles.includes("admin") || decoded.admin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin authorization required." }, { status: 403 });
    }

    const { campaignId } = await request.json();
    if (!campaignId) {
      return NextResponse.json({ error: "Missing campaignId." }, { status: 400 });
    }
    const campaignRef = adminDb.collection("campaigns").doc(String(campaignId));
    const campaignSnap = await campaignRef.get();
    if (!campaignSnap.exists) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    const campaign = campaignSnap.data() as Record<string, any>;
    const retailAssetId = String(campaign.retailAssetId || "").trim();
    const brandId = String(campaign.brandId || "").trim();
    if (!retailAssetId || !brandId) {
      return NextResponse.json(
        { error: "This legacy campaign has no canonical Retail Asset to recover." },
        { status: 409 }
      );
    }

    await publishRetailAsset({
      retailAssetId,
      publishedByUserId: decoded.uid,
      publishedByRole: "admin",
    });
    const verified = await verifyFirstFreeScanReady({ brandId, campaignId: String(campaignId) });
    if (!verified.scanReady) {
      return NextResponse.json(
        { error: "Canonical publication completed without passing scan-readiness verification." },
        { status: 409 }
      );
    }

    await campaignRef.set({
      status: "ar_live",
      arStatus: "live",
      retailMediaStatus: "active",
      canonicalScanReady: true,
      canonicalScanReadyVerifiedAt: FieldValue.serverTimestamp(),
      recoveryRequired: false,
      lastPublicationError: null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await adminDb.collection("brands").doc(brandId).set({
      hasLaunchedFirstIRL: true,
      "firstFreeIRL.status": "active",
      "firstFreeIRL.activatedAt": FieldValue.serverTimestamp(),
      "firstFreeIRL.lastError": null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ ok: true, ...verified });
  } catch (error: any) {
    console.error("First-free Admin recovery error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to recover canonical publication." },
      { status: 500 }
    );
  }
}
