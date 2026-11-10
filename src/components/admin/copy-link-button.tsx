"use client";

import { useState } from "react";
import { Check, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({ url, label = "Copy link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={copy}>
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <LinkIcon className="h-4 w-4" aria-hidden="true" />}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </Button>
  );
}
