import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "../../../../../lib/firebase-admin";

export async function GET(
  _req: Request,
  context: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await context.params;

    if (!campaignId) {
      return NextResponse.json({ error: "Missing campaignId." }, { status: 400 });
    }

    const campaignSnap = await adminDb.collection("campaigns").doc(campaignId).get();

    if (!campaignSnap.exists) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    const campaign = campaignSnap.data() as any;
    const arTargetImagePath = campaign.arTargetImagePath;

    if (!arTargetImagePath) {
      return NextResponse.json(
        { error: "No target image path found for this campaign." },
        { status: 404 }
      );
    }

    const bucket = adminStorage.bucket();
    const file = bucket.file(arTargetImagePath);

    const [exists] = await file.exists();

    if (!exists) {
      return NextResponse.json({ error: "Target image file not found." }, { status: 404 });
    }

  const [buffer] = await file.download();

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
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