import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../lib/firebase-admin";
import { sendEmail } from "../../../../lib/postmark";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function makeToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  return Array.from(array)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: Request) {
  try {
    const { creatorId } = await req.json();

    if (!creatorId || typeof creatorId !== "string") {
      return NextResponse.json({ error: "Missing creatorId" }, { status: 400 });
    }

    const creatorRef = adminDb.collection("creators").doc(creatorId);
    const creatorSnap = await creatorRef.get();

    if (!creatorSnap.exists) {
      return NextResponse.json(
        { error: "Creator profile not found" },
        { status: 404 }
      );
    }

    const creator = creatorSnap.data() as any;

    if (creator.creatorStatus === "removed") {
      return NextResponse.json(
        { error: "This creator profile is no longer listed." },
        { status: 400 }
      );
    }

    const profileEmail = normalizeEmail(creator.contactEmail || creator.email);

    if (!profileEmail) {
      return NextResponse.json(
        {
          error:
            "This creator profile does not have a verification email on file.",
        },
        { status: 400 }
      );
    }

    const token = makeToken();

    await adminDb.collection("creatorClaimRequests").doc(token).set({
      token,
      creatorId,
      email: profileEmail,
      status: "pending",
      type: "claim",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://irl.goshsha.com";

    const verifyUrl = `${appUrl}/api/creator/verify-claim?token=${token}`;

    await sendEmail({
      to: profileEmail,
      subject: "Verify your Goshsha creator profile claim",
      htmlBody: `
        <h2>Verify your creator profile claim</h2>
        <p>You requested to claim your creator profile on Goshsha IRL Campaign Network.</p>
        <p>Click the button below to verify this email and mark your creator profile as verified.</p>
        <p>
          <a href="${verifyUrl}" style="background:#0f172a;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block;">
            Verify and claim profile
          </a>
        </p>
        <p>After verification, you can complete creator signup and manage your profile.</p>
        <p>If you did not request this, you can ignore this email.</p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      `,
      textBody: `
Verify your creator profile claim.

You requested to claim your creator profile on Goshsha IRL Campaign Network.

Click here to verify and claim your profile:
${verifyUrl}

After verification, you can complete creator signup and manage your profile.

If you did not request this, you can ignore this email.
      `.trim(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Creator claim request error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to request creator claim" },
      { status: 500 }
    );
  }
}