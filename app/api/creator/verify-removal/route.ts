import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://irl.goshsha.com";
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(`${appUrl}/creators?removed=missing-token`);
    }

    const removalRef = adminDb.collection("creatorRemovalRequests").doc(token);
    const removalSnap = await removalRef.get();

    if (!removalSnap.exists) {
      return NextResponse.redirect(`${appUrl}/creators?removed=invalid-token`);
    }

    const removal = removalSnap.data() as any;

    if (removal.status === "confirmed") {
      return NextResponse.redirect(`${appUrl}/creators?removed=already`);
    }

    const creatorId = removal.creatorId;

    if (!creatorId) {
      return NextResponse.redirect(`${appUrl}/creators?removed=missing-creator`);
    }

    await adminDb.collection("creators").doc(creatorId).set(
      {
        creatorStatus: "removed",
        isMarketplaceVisible: false,
        removedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await removalRef.update({
      status: "confirmed",
      confirmedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.redirect(`${appUrl}/creators?removed=success`);
  } catch (err) {
    console.error("Verify creator removal error:", err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://irl.goshsha.com";
    return NextResponse.redirect(`${appUrl}/creators?removed=failed`);
  }
}