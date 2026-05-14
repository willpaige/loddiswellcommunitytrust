"use client";

import { useState } from "react";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestPortalLink } from "@/actions/lottery-portal";

export function ManageForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const formData = new FormData(e.currentTarget);
    const result = await requestPortalLink(formData);
    if ("error" in result) {
      setErrorMessage(result.error);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-sage-200 bg-sage-50 p-8 text-center">
        <CheckCircle2
          className="mx-auto h-12 w-12 text-sage-600"
          aria-hidden="true"
        />
        <h3 className="mt-4 text-lg font-semibold text-sage-800">
          Check your inbox
        </h3>
        <p className="mt-2 text-sm text-sage-700">
          If your email is registered as a lottery subscriber, we&apos;ve sent
          you a link to manage your subscription. The link expires shortly, so
          please use it soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <label htmlFor="manage-email" className="sr-only">
        Email address
      </label>
      <div className="relative">
        <Mail
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sage-500"
          aria-hidden="true"
        />
        <input
          type="email"
          id="manage-email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          disabled={status === "sending"}
          className="block w-full rounded-md border border-sage-200 bg-white py-3 pl-11 pr-4 text-sage-900 placeholder:text-sage-500 focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20 focus:outline-none transition-colors disabled:opacity-60"
        />
      </div>

      <Button
        type="submit"
        disabled={status === "sending"}
        className="w-full bg-sage-700 hover:bg-sage-800"
        size="lg"
      >
        {status === "sending" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Sending link...
          </>
        ) : (
          "Email me a manage link"
        )}
      </Button>

      {status === "error" && (
        <p className="text-sm text-copper-700" role="alert">
          {errorMessage}
        </p>
      )}

      <p className="text-xs text-muted-foreground text-center">
        We&apos;ll email you a secure link to update payment details or cancel
        your subscription.
      </p>
    </form>
  );
}
