import postmark from "postmark";

const token = process.env.POSTMARK_API_TOKEN || "";

export async function sendEmail(params: {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
}) {
  const { to, subject, htmlBody, textBody, replyTo } = params;

  if (!token) {
    throw new Error("Missing POSTMARK_API_TOKEN");
  }

  const client = new postmark.ServerClient(token);

  return client.sendEmail({
    From: "Athena from Goshsha <athena@goshsha.com>",
    ReplyTo: replyTo || "athena@goshsha.com",
    To: to,
    Subject: subject,
    HtmlBody: htmlBody,
    TextBody: textBody || "",
    MessageStream: "outbound",
  });
}