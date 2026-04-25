import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../lib/firebase-admin";
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

    const campaignRef = adminDb.collection("campaigns").doc(campaignId);
    const campaignSnap = await campaignRef.get();

    if (!campaignSnap.exists) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const campaign = campaignSnap.data() as any;

    await campaignRef.update({
      creatorSubmittedArContentUrl: submissionUrl,
      normalizedArContentUrl: submissionUrl.trim(),
      status: "submitted",
      completionStatus: "submitted",
      brandApprovalStatus: "pending",
      payoutStatus: "locked",
      creatorSubmittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("campaignSubmissions").add({
      campaignId,
      creatorId: campaign.creatorId,
      brandId: campaign.brandId,
      submissionUrl: submissionUrl.trim(),
      createdAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("notifications").add({
      userId: campaign.brandId,
      role: "brand",
      type: "campaign_submitted",
      title: "Campaign submitted",
      message: `${campaign.creatorHandle || "A creator"} submitted content for "${campaign.campaignTitle}".`,
      campaignId,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("notifications").add({
      userId: "admin",
      role: "admin",
      type: "campaign_submitted_admin",
      title: "Campaign ready for review",
      message: `${campaign.creatorHandle || "A creator"} submitted "${campaign.campaignTitle}" for review.`,
      campaignId,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const brandSnap = await adminDb.collection("brands").doc(campaign.brandId).get();
    const brand = brandSnap.exists ? brandSnap.data() : null;
    const brandEmail = brand?.contactEmail || brand?.email || campaign.brandEmail;

    if (brandEmail) {
      await sendEmail({
        to: brandEmail,
        subject: "Creator submitted content",
        htmlBody: `
          <h2>Creator submitted content</h2>
          <p><strong>${campaign.creatorHandle || "Your creator"}</strong> submitted content.</p>
          <p><strong>Campaign:</strong> ${campaign.campaignTitle}</p>
          <p><strong>Product:</strong> ${campaign.productName}</p>
          <p><strong>Submission URL:</strong> <a href="${submissionUrl}">${submissionUrl}</a></p>
          <p>Log in to review and approve the campaign.</p>
        `,
        textBody: `
Creator submitted content.

Campaign: ${campaign.campaignTitle}
Product: ${campaign.productName}
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