"use client";

import { useState } from "react";
import { sendContactEmail } from "@/actions/contact";
import { Loader2, CheckCircle } from "lucide-react";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");

    const formData = new FormData(e.currentTarget);
    const result = await sendContactEmail(formData);

    if (result.error) {
      setErrorMessage(result.error);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-sage-200 bg-sage-50 p-8 text-center">
        <CheckCircle
          className="mx-auto h-12 w-12 text-sage-600"
          aria-hidden="true"
        />
        <h3 className="mt-4 text-lg font-semibold text-sage-800">
          Message Sent!
        </h3>
        <p className="mt-2 text-sm text-sage-700">
          Thank you for getting in touch. We&apos;ll get back to you as soon as
          possible.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-foreground"
        >
          Your Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          className="mt-1 block w-full rounded-md border border-border bg-white px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20 focus:outline-none transition-colors"
          placeholder="John Smith"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-foreground"
        >
          Email Address
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className="mt-1 block w-full rounded-md border border-border bg-white px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20 focus:outline-none transition-colors"
          placeholder="john@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="subject"
          className="block text-sm font-medium text-foreground"
        >
          Subject
        </label>
        <select
          id="subject"
          name="subject"
          className="mt-1 block w-full rounded-md border border-border bg-white px-4 py-3 text-foreground focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20 focus:outline-none transition-colors"
        >
          <option value="General Enquiry">General Enquiry</option>
          <option value="Booking Enquiry">Booking Enquiry</option>
          <option value="Events">Events</option>
          <option value="Community Lottery">Community Lottery</option>
          <option value="Volunteering">Volunteering</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium text-foreground"
        >
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          className="mt-1 block w-full rounded-md border border-border bg-white px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20 focus:outline-none transition-colors resize-vertical"
          placeholder="How can we help?"
        />
      </div>

      {status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex items-center gap-2 rounded-md bg-sage-600 px-6 py-3 text-sm font-semibold text-white hover:bg-sage-700 transition-colors disabled:opacity-50"
      >
        {status === "sending" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Sending...
          </>
        ) : (
          "Send Message"
        )}
      </button>
    </form>
  );
}
