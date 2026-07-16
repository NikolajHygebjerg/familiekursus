interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export async function sendEmailWithAttachment(options: {
  to: string;
  subject: string;
  text: string;
  attachment: EmailAttachment;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    throw new Error(
      "E-mail er ikke konfigureret. Sæt RESEND_API_KEY og EMAIL_FROM i miljøvariabler."
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [options.to],
      subject: options.subject,
      text: options.text,
      attachments: [
        {
          filename: options.attachment.filename,
          content: options.attachment.content.toString("base64"),
          content_type:
            options.attachment.contentType ||
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kunne ikke sende e-mail (${response.status}): ${errorText}`);
  }
}
