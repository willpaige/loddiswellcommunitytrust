"use server";

import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
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
    await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL || "noreply@loddiswellcommunitytrust.org",
      to: process.env.CONTACT_EMAIL || "hello@loddiswellcommunitytrust.org",
      replyTo: email,
      subject: `[Website] ${subject}: Message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
    });

    return { success: true };
  } catch {
    return { error: "Failed to send message. Please try again or email us directly." };
  }
}
