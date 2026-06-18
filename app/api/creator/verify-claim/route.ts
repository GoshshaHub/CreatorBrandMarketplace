import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://irl.goshsha.com";
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(`${appUrl}/login?error=missing-token`);
    }

    const claimRef = adminDb.collection("creatorClaimRequests").doc(token);
    const claimSnap = await claimRef.get();

    if (!claimSnap.exists) {
      return NextResponse.redirect(`${appUrl}/login?error=invalid-token`);
    }

    const claim = claimSnap.data() as any;

    if (claim.status === "verified") {
      return NextResponse.redirect(`${appUrl}/login?claimed=already`);
    }

    const uid = claim.uid;
    const listedCreatorId = claim.claimCreatorId;

    const listedCreatorRef = adminDb.collection("creators").doc(listedCreatorId);
    const listedCreatorSnap = await listedCreatorRef.get();

    if (!listedCreatorSnap.exists) {
      return NextResponse.redirect(`${appUrl}/login?error=creator-not-found`);
    }

    const listedCreator = listedCreatorSnap.data() as any;

    await adminDb.collection("users").doc(uid).set(
      {
        isActive: true,
        roles: ["creator"],
        creatorStatus: "verified",
        claimedListedCreatorId: listedCreatorId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await adminDb.collection("creators").doc(uid).set(
      {
        ...listedCreator,
        userId: uid,
        claimedListedCreatorId: listedCreatorId,
        creatorStatus: "verified",
        isMarketplaceVisible: true,
        claimedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await listedCreatorRef.set(
      {
        creatorStatus: "claimed",
        isMarketplaceVisible: false,
        claimedByUid: uid,
        claimedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await claimRef.update({
      status: "verified",
      verifiedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.redirect(`${appUrl}/login?claimed=success`);
  } catch (err) {
    console.error("Verify creator claim error:", err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://irl.goshsha.com";
    return NextResponse.redirect(`${appUrl}/login?error=claim-failed`);
  }
}