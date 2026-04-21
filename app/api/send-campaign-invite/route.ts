import { NextResponse } from "next/server";
import postmark from "postmark";

const token = process.env.POSTMARK_API_TOKEN;

export async function POST(req: Request) {
  try {
    if (!token) {
      return NextResponse.json(
        { error: "Missing POSTMARK_API_TOKEN" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { to, brandName, campaignTitle, productName } = body;

    if (!to || !brandName || !campaignTitle || !productName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const client = new postmark.ServerClient(token);

    await client.sendEmail({
      From: "Athena from Goshsha <athena@goshsha.com>",
      To: to,
      Subject: `New campaign invite from ${brandName}`,
      HtmlBody: `
        <h2>You’ve been invited to a campaign</h2>
        <p><strong>${brandName}</strong> invited you to collaborate.</p>
        <p><strong>Campaign:</strong> ${campaignTitle}</p>
        <p><strong>Product:</strong> ${productName}</p>
        <p>Please log in to your creator dashboard to review and respond.</p>
      `,
      TextBody: `
You've been invited to a campaign.

Brand: ${brandName}
Campaign: ${campaignTitle}
Product: ${productName}

Log in to your creator dashboard to review and respond.
      `.trim(),
      MessageStream: "outbound",
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Postmark invite email error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to send email" },
      { status: 500 }
    );
  }
}