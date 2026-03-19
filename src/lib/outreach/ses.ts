import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesClient = new SESClient({
  region: process.env.AWS_SES_REGION || "eu-west-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

interface SendEmailParams {
  from: string;
  fromName: string;
  to: string;
  subject: string;
  htmlBody: string;
  replyTo?: string;
}

interface SendEmailResult {
  messageId: string;
}

export async function sendEmailViaSES(params: SendEmailParams): Promise<SendEmailResult> {
  const command = new SendEmailCommand({
    Source: `${params.fromName} <${params.from}>`,
    Destination: {
      ToAddresses: [params.to],
    },
    Message: {
      Subject: {
        Data: params.subject,
        Charset: "UTF-8",
      },
      Body: {
        Html: {
          Data: params.htmlBody,
          Charset: "UTF-8",
        },
      },
    },
    ReplyToAddresses: params.replyTo ? [params.replyTo] : [params.from],
  });

  const response = await sesClient.send(command);

  if (!response.MessageId) {
    throw new Error("SES retourneerde geen MessageId");
  }

  return { messageId: response.MessageId };
}

export function buildTrackingPixel(baseUrl: string, trackingId: string): string {
  return `<img src="${baseUrl}/api/outreach/track/${trackingId}/open" width="1" height="1" style="display:none" alt="" />`;
}

export function wrapLinksWithTracking(html: string, baseUrl: string, trackingId: string): string {
  return html.replace(
    /href="(https?:\/\/[^"]+)"/gi,
    (_match, url: string) => {
      // Skip unsubscribe links
      if (url.includes("/unsubscribe")) return `href="${url}"`;
      const encodedUrl = encodeURIComponent(url);
      return `href="${baseUrl}/api/outreach/track/${trackingId}/click?url=${encodedUrl}"`;
    }
  );
}

export function buildUnsubscribeLink(baseUrl: string, token: string): string {
  return `${baseUrl}/api/outreach/unsubscribe/${token}`;
}

export function buildEmailHtml(
  inhoud: string,
  baseUrl: string,
  trackingId: string,
  unsubscribeToken: string
): string {
  const unsubscribeUrl = buildUnsubscribeLink(baseUrl, unsubscribeToken);
  const trackingPixel = buildTrackingPixel(baseUrl, trackingId);
  const wrappedContent = wrapLinksWithTracking(inhoud, baseUrl, trackingId);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${wrappedContent}
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
    <p>Je ontvangt deze email omdat je profiel overeenkomt met onze diensten.</p>
    <p><a href="${unsubscribeUrl}" style="color: #999;">Uitschrijven</a></p>
  </div>
  ${trackingPixel}
</body>
</html>`;
}
