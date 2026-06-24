import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return NextResponse.json({ exists: false });
    }

    const contactSnap = await adminDb
      .collection("creators")
      .where("contactEmail", "==", normalizedEmail)
      .limit(1)
      .get();

    const emailSnap = contactSnap.empty
      ? await adminDb
          .collection("creators")
          .where("email", "==", normalizedEmail)
          .limit(1)
          .get()
      : null;

    const match = !contactSnap.empty || !!emailSnap?.empty === false;

    return NextResponse.json({ exists: match });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to check creator email" },
      { status: 500 }
    );
  }
}