import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage } from "../../../../../lib/firebase-admin";
import { firstFreeIds } from "../../../../../lib/retail-media/create-first-free-activation";

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await context.params;

    if (!campaignId) {
      return NextResponse.json({ error: "Missing campaignId." }, { status: 400 });
    }

    const token = bearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(token);
    const campaignSnap = await adminDb.collection("campaigns").doc(campaignId).get();

    if (!campaignSnap.exists) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    const campaign = campaignSnap.data() as any;
    if (String(campaign.brandId || "").trim() !== decoded.uid) {
      return NextResponse.json({ error: "Brand authorization required." }, { status: 403 });
    }
    let arTargetImagePath = String(campaign.arTargetImagePath || "").trim();
    const bucket = adminStorage.bucket();

    if (!arTargetImagePath) {
      const ids = firstFreeIds(decoded.uid);
      const eligibleRecovery =
        campaignId === ids.campaignId &&
        campaign.campaignType === "brand_first_irl_preview" &&
        campaign.recoveryRequired === true &&
        String(campaign.retailAssetId || "").trim() === ids.retailAssetId;
      if (!eligibleRecovery) {
        return NextResponse.json(
          { error: "No target image path found for this campaign." },
          { status: 404 }
        );
      }
      const candidates = await Promise.all(
        ["jpg", "png", "webp", "heic", "heif"].map(async (extension) => {
          const path = `retail-media-targets/${decoded.uid}/${ids.retailAssetId}/target.${extension}`;
          const [exists] = await bucket.file(path).exists();
          return exists ? path : "";
        })
      );
      const existing = candidates.filter(Boolean);
      if (existing.length !== 1) {
        return NextResponse.json(
          { error: "The preserved target image could not be resolved safely." },
          { status: 404 }
        );
      }
      arTargetImagePath = existing[0];
    }

    const file = bucket.file(arTargetImagePath);

    const [exists] = await file.exists();

    if (!exists) {
      return NextResponse.json({ error: "Target image file not found." }, { status: 404 });
    }

  const [[buffer], [metadata]] = await Promise.all([
    file.download(),
    file.getMetadata(),
  ]);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    },
  });
  } catch (error: any) {
    console.error("Target image load error:", error);

    return NextResponse.json(
      { error: error.message || "Failed to load target image." },
      { status: 500 }
    );
  }
}
