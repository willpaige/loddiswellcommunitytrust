"use server";

import { ServerClient } from "postmark";

function getPostmark() {
  return new ServerClient(process.env.POSTMARK_API_KEY!);
}

export async function sendContactEmail(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const subject = formData.get("subject") as string;
  const message = formData.get("message") as string;

  if (!name || !email || !message) {
    return { error: "Please fill in all required fields." };
  }

  try {
    await getPostmark().sendEmail({
      From: process.env.EMAIL_FROM || "noreply@loddiswellcommunitytrust.org",
      To: process.env.CONTACT_EMAIL || "hello@loddiswellcommunitytrust.org",
      ReplyTo: email,
      Subject: `[Website] ${subject}: Message from ${name}`,
      TextBody: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
    });

    return { success: true };
  } catch {
    return { error: "Failed to send message. Please try again or email us directly." };
  }
}
