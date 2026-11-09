"use client";

import { useState } from "react";
import { Check, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** WhatsApp, Facebook and copy-link sharing for a raffle page. */
export function ShareButtons({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link is visible in the address bar anyway.
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <Button asChild variant="outline" className="h-11">
        <a href={whatsapp} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      </Button>
      <Button asChild variant="outline" className="h-11">
        <a href={facebook} target="_blank" rel="noopener noreferrer">
          Facebook
        </a>
      </Button>
      <Button type="button" variant="outline" className="h-11" onClick={copy}>
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <LinkIcon className="h-4 w-4" aria-hidden="true" />}
        <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
      </Button>
    </div>
  );
}
