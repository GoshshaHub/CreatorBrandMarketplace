import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { uid, email, verifiedCreatorId, displayName } = await req.json();

    if (!uid || !email || !verifiedCreatorId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const listedRef = adminDb.collection("creators").doc(verifiedCreatorId);
    const listedSnap = await listedRef.get();

    if (!listedSnap.exists) {
      return NextResponse.json({ error: "Verified creator listing not found" }, { status: 404 });
    }

    const listed = listedSnap.data() as any;

    if (listed.creatorStatus !== "verified") {
      return NextResponse.json(
        { error: "This creator listing has not been verified yet." },
        { status: 403 }
      );
    }

    await adminDb.collection("users").doc(uid).set(
      {
        email,
        displayName: displayName || listed.displayName || "",
        roles: ["creator"],
        isActive: true,
        creatorStatus: "verified",
        claimedListedCreatorId: verifiedCreatorId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await adminDb.collection("creators").doc(uid).set(
      {
        ...listed,
        userId: uid,
        email,
        contactEmail: email,
        displayName: displayName || listed.displayName || "",
        creatorStatus: "verified",
        isMarketplaceVisible: true,
        claimedListedCreatorId: verifiedCreatorId,
        claimedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await listedRef.set(
      {
        creatorStatus: "claimed",
        isMarketplaceVisible: false,
        claimedByUid: uid,
        claimedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const campaignsSnap = await adminDb
  .collection("campaigns")
  .where("creatorId", "==", verifiedCreatorId)
  .get();

const batch = adminDb.batch();

campaignsSnap.forEach((campaignDoc) => {
  batch.update(campaignDoc.ref, {
    creatorId: uid,
    originalListedCreatorId: verifiedCreatorId,
    creatorStatus: "verified",
    creatorClaimedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
});

if (!campaignsSnap.empty) {
  await batch.commit();
}

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Complete verified signup error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to complete verified signup" },
      { status: 500 }
    );
  }
}