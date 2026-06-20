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
    const { creatorId, email } = await req.json();

    if (!creatorId || typeof creatorId !== "string") {
      return NextResponse.json(
        { error: "Missing creatorId" },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Missing email" },
        { status: 400 }
      );
    }

    const creatorSnap = await adminDb
      .collection("creators")
      .doc(creatorId)
      .get();

    if (!creatorSnap.exists) {
      return NextResponse.json(
        { error: "Creator profile not found" },
        { status: 404 }
      );
    }

    const creator = creatorSnap.data() as any;

    const profileEmail = normalizeEmail(
      creator.contactEmail || creator.email
    );

    const submittedEmail = normalizeEmail(email);

    if (!profileEmail) {
      return NextResponse.json(
        {
          error:
            "This creator profile does not have a verification email on file.",
        },
        { status: 400 }
      );
    }

    if (profileEmail !== submittedEmail) {
      return NextResponse.json(
        {
          error:
            "The email entered does not match the email connected to this creator profile.",
        },
        { status: 403 }
      );
    }

    const token = makeToken();

    await adminDb.collection("creatorRemovalRequests").doc(token).set({
      token,
      creatorId,
      email: submittedEmail,
      status: "pending",
      type: "removal",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://irl.goshsha.com";

    const verifyUrl = `${appUrl}/api/creator/verify-removal?token=${token}`;

    await sendEmail({
      to: submittedEmail,
      subject: "Confirm removal of your Goshsha creator profile",
      htmlBody: `
        <h2>Confirm creator profile removal</h2>

        <p>You requested removal of a creator profile listed in the Goshsha IRL Campaign Network.</p>

        <p>Click the button below to confirm removal.</p>

        <p>
          <a
            href="${verifyUrl}"
            style="background:#0f172a;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block;"
          >
            Confirm Removal
          </a>
        </p>

        <p>If you did not request this, simply ignore this email.</p>

        <p>
          Direct link:
          <br />
          <a href="${verifyUrl}">
            ${verifyUrl}
          </a>
        </p>
      `,
      textBody: `
Confirm creator profile removal.

Click the link below to confirm removal:

${verifyUrl}

If you did not request this, ignore this email.
      `.trim(),
    });

    return NextResponse.json({
      ok: true,
    });
  } catch (err: any) {
    console.error("Creator removal request error:", err);

    return NextResponse.json(
      {
        error: err?.message || "Failed to request removal",
      },
      { status: 500 }
    );
  }
}