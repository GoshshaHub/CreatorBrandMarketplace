import { NextResponse } from "next/server";
import postmark from "postmark";

const token = process.env.POSTMARK_API_TOKEN;

export async function POST(req: Request) {
  try {
    if (!token) {
      console.error("POSTMARK_API_TOKEN is missing");
      return NextResponse.json(
        { error: "Missing POSTMARK_API_TOKEN" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { to, brandName, campaignTitle, productName } = body;

    if (!to || !brandName || !campaignTitle || !productName) {
      console.error("Missing required fields", body);
      return NextResponse.json(
        { error: "Missing required fields", body },
        { status: 400 }
      );
    }

    const client = new postmark.ServerClient(token);

    const result = await client.sendEmail({
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

    console.log("Postmark success:", result);

    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error("Postmark invite email full error:", {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      statusCode: err?.statusCode,
      stack: err?.stack,
      raw: err,
    });

    return NextResponse.json(
      {
        error: err?.message || "Failed to send email",
        code: err?.code || null,
        statusCode: err?.statusCode || null,
      },
      { status: 500 }
    );
  }
}