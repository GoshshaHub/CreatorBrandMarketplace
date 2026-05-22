import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const {
      campaignId,
      brandId,
      brandName,
      creatorName,
      creatorHandle,
      platform,
    } = await req.json();

    if (!campaignId || !brandName) {
      return NextResponse.json(
        { error: "Missing campaignId or brandName." },
        { status: 400 }
      );
    }

    const inviteToken = crypto.randomBytes(24).toString("hex");

    const inviteRef = adminDb.collection("externalCreatorInvites").doc();

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://irl.goshsha.com";

    const inviteUrl = `${appUrl}/creator/join?inviteToken=${inviteToken}`;

    const message = `Hi${creatorName ? ` ${creatorName}` : ""},

I’d love to invite you to collaborate with ${brandName} on an IRL Campaign through Goshsha.

This campaign lets your content show up directly over our product when shoppers scan it in-store — so your influence appears at the moment people are deciding what to buy.

You can view the campaign invite and join here:
${inviteUrl}

Excited to work with you!`;

    await inviteRef.set({
      campaignId,
      brandId: brandId || null,
      brandName,
      creatorName: creatorName || null,
      creatorHandle: creatorHandle || null,
      platform: platform || null,
      inviteToken,
      inviteUrl,
      message,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      inviteId: inviteRef.id,
      inviteUrl,
      message,
    });
  } catch (error: any) {
    console.error("External creator invite error:", error);

    return NextResponse.json(
      { error: error.message || "Failed to create invite." },
      { status: 500 }
    );
  }
}