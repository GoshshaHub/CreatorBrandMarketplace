import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://irl.goshsha.com";
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(`${appUrl}/creators?claim=missing-token`);
    }

    const claimRef = adminDb.collection("creatorClaimRequests").doc(token);
    const claimSnap = await claimRef.get();

    if (!claimSnap.exists) {
      return NextResponse.redirect(`${appUrl}/creators?claim=invalid-token`);
    }

    const claim = claimSnap.data() as any;

    if (claim.status === "verified") {
      return NextResponse.redirect(
        `${appUrl}/signup?role=creator&verifiedCreatorId=${claim.creatorId}&claim=already`
      );
    }

    const creatorId = claim.creatorId;

    if (!creatorId) {
      return NextResponse.redirect(`${appUrl}/creators?claim=missing-creator`);
    }

    const creatorRef = adminDb.collection("creators").doc(creatorId);
    const creatorSnap = await creatorRef.get();

    if (!creatorSnap.exists) {
      return NextResponse.redirect(`${appUrl}/creators?claim=creator-not-found`);
    }

    await creatorRef.set(
      {
        creatorStatus: "verified",
        isMarketplaceVisible: true,
        verifiedAt: FieldValue.serverTimestamp(),
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

    return NextResponse.redirect(
      `${appUrl}/signup?role=creator&verifiedCreatorId=${creatorId}&claim=success`
    );
  } catch (err) {
    console.error("Verify creator claim error:", err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://irl.goshsha.com";
    return NextResponse.redirect(`${appUrl}/creators?claim=failed`);
  }
}