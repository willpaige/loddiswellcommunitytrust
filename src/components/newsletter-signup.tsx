"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, Mail } from "lucide-react";
import { subscribeToNewsletter } from "@/actions/newsletter";

export function NewsletterSignup() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");

    const formData = new FormData(e.currentTarget);
    const result = await subscribeToNewsletter(formData);

    if (result.error) {
      setErrorMessage(result.error);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <section
      className="newsletter-signup bg-sage-50 border-t border-sage-100"
      aria-labelledby="newsletter-heading"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-copper-600">
              Stay in the loop
            </p>
            <h2
              id="newsletter-heading"
              className="mt-3 font-serif text-3xl text-sage-900 sm:text-4xl"
            >
              Village news, straight to your inbox
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-sage-700">
              Occasional updates from the Trust — events, lottery draws, AGM
              notices and how the Pump Track fundraiser is coming along. No spam,
              unsubscribe any time.
            </p>
          </div>

          <div className="lg:col-span-7">
            {status === "sent" ? (
              <div className="flex items-start gap-4 rounded-lg border border-sage-200 bg-white p-6">
                <CheckCircle2
                  className="mt-0.5 h-6 w-6 flex-none text-sage-600"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-serif text-lg text-sage-900">
                    You&apos;re subscribed
                  </p>
                  <p className="mt-1 text-sm text-sage-700">
                    Thanks for joining. We&apos;ll be in touch when there&apos;s
                    village news worth sharing.
                  </p>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-3 sm:flex-row"
                noValidate
              >
                <label htmlFor="newsletter-email" className="sr-only">
                  Email address
                </label>
                <div className="relative flex-1">
                  <Mail
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sage-500"
                    aria-hidden="true"
                  />
                  <input
                    type="email"
                    id="newsletter-email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    disabled={status === "sending"}
                    className="block w-full rounded-md border border-sage-200 bg-white py-3 pl-11 pr-4 text-sage-900 placeholder:text-sage-500 focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20 focus:outline-none transition-colors disabled:opacity-60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-sage-700 px-6 py-3 text-sm font-semibold text-white hover:bg-sage-800 transition-colors disabled:opacity-60"
                >
                  {status === "sending" ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Subscribing
                    </>
                  ) : (
                    "Subscribe"
                  )}
                </button>
              </form>
            )}

            {status === "error" && (
              <p className="mt-3 text-sm text-copper-700" role="alert">
                {errorMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
