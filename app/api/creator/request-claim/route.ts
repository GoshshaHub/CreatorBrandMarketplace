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
    const { uid, email, claimCreatorId } = await req.json();

    if (!uid || typeof uid !== "string") {
      return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    }

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    if (!claimCreatorId || typeof claimCreatorId !== "string") {
      return NextResponse.json(
        { error: "Missing claimCreatorId" },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);

    const userCreatorSnap = await adminDb
      .collection("users")
      .doc(claimCreatorId)
      .get();

    const legacyCreatorSnap = await adminDb
      .collection("creators")
      .doc(claimCreatorId)
      .get();

    if (!userCreatorSnap.exists && !legacyCreatorSnap.exists) {
      return NextResponse.json(
        { error: "Creator profile not found" },
        { status: 404 }
      );
    }

    const userCreator = userCreatorSnap.exists ? userCreatorSnap.data() : {};
    const legacyCreator = legacyCreatorSnap.exists
      ? legacyCreatorSnap.data()
      : {};

    const profileEmail = normalizeEmail(
      userCreator?.contactEmail ||
        userCreator?.email ||
        legacyCreator?.contactEmail ||
        legacyCreator?.email
    );

    if (!profileEmail) {
      return NextResponse.json(
        {
          error:
            "This creator profile does not have a verification email on file.",
        },
        { status: 400 }
      );
    }

    if (profileEmail !== normalizedEmail) {
      return NextResponse.json(
        {
          error:
            "This email does not match the email connected to this creator profile.",
        },
        { status: 403 }
      );
    }

    const token = makeToken();

    await adminDb.collection("creatorClaimRequests").doc(token).set({
      token,
      uid,
      email: normalizedEmail,
      claimCreatorId,
      status: "pending",
      type: "claim",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://irl.goshsha.com";

    const verifyUrl = `${appUrl}/api/creator/verify-claim?token=${token}`;

    await sendEmail({
      to: normalizedEmail,
      subject: "Verify your Goshsha creator profile claim",
      htmlBody: `
        <h2>Verify your creator profile claim</h2>
        <p>You requested to claim your creator profile on Goshsha IRL Campaign Network.</p>
        <p>Click the button below to verify your email and activate your creator account.</p>
        <p>
          <a href="${verifyUrl}" style="background:#0f172a;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block;">
            Verify and claim profile
          </a>
        </p>
        <p>If you did not request this, you can ignore this email.</p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      `,
      textBody: `
Verify your creator profile claim.

You requested to claim your creator profile on Goshsha IRL Campaign Network.

Click here to verify and claim your profile:
${verifyUrl}

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