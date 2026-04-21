import postmark from "postmark";

const client = new postmark.ServerClient(process.env.POSTMARK_API_TOKEN!);

export async function sendEmail(params: {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}) {
  const { to, subject, htmlBody, textBody } = params;

  try {
    await client.sendEmail({
      From: "Athena from Goshsha <athena@goshsha.com>",
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody || "",
    });

    console.log("Email sent to:", to);
  } catch (err) {
    console.error("Postmark error:", err);
  }
}