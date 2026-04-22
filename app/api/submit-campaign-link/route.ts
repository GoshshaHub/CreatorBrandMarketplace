import { NextResponse } from "next/server";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { createNotification } from "../../../lib/notifications";
import { sendEmail } from "../../../lib/postmark";

export async function POST(req: Request) {
  try {
    const { campaignId, submissionUrl } = await req.json();

    if (!campaignId || !submissionUrl) {
      return NextResponse.json(
        { error: "Missing campaignId or submissionUrl" },
        { status: 400 }
      );
    }

    const campaignRef = doc(db, "campaigns", campaignId);
    const campaignSnap = await getDoc(campaignRef);

    if (!campaignSnap.exists()) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const campaign = campaignSnap.data() as any;

    await updateDoc(campaignRef, {
      creatorSubmittedArContentUrl: submissionUrl,
      normalizedArContentUrl: submissionUrl.trim(),
      status: "submitted",
      completionStatus: "submitted",
      creatorSubmittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await createNotification({
      userId: campaign.brandId,
      role: "brand",
      type: "campaign_submitted",
      title: "Campaign submitted",
      message: `${campaign.creatorHandle || "A creator"} submitted content for "${campaign.campaignTitle}".`,
      campaignId,
    });

    await createNotification({
      userId: "admin",
      role: "admin",
      type: "campaign_submitted_admin",
      title: "Campaign ready for review",
      message: `${campaign.creatorHandle || "A creator"} submitted "${campaign.campaignTitle}" for review.`,
      campaignId,
    });

    const brandRef = doc(db, "brands", campaign.brandId);
    const brandSnap = await getDoc(brandRef);
    const brand = brandSnap.exists() ? brandSnap.data() : null;
    const brandEmail = brand?.contactEmail || brand?.email || campaign.contactEmail;

    if (brandEmail) {
      await sendEmail({
        to: brandEmail,
        subject: `📩 Creator submitted content`,
        htmlBody: `
          <h2>Creator submitted content</h2>
          <p><strong>${campaign.creatorHandle || "Your creator"}</strong> submitted content.</p>
          <p><strong>Campaign:</strong> ${campaign.campaignTitle}</p>
          <p><strong>Submission URL:</strong> <a href="${submissionUrl}">${submissionUrl}</a></p>
          <p>Log in to review and approve the campaign.</p>
        `,
        textBody: `
Creator submitted content.

Campaign: ${campaign.campaignTitle}
Submission URL: ${submissionUrl}

Log in to review and approve the campaign.
        `.trim(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Submit campaign link error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to submit campaign link" },
      { status: 500 }
    );
  }
}