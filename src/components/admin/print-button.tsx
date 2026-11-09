"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ backHref }: { backHref?: string }) {
  return (
    <>
      {backHref && (
        <Button asChild variant="outline">
          <Link href={backHref}>Back</Link>
        </Button>
      )}
      <Button type="button" onClick={() => window.print()}>
        <Printer className="h-4 w-4" aria-hidden="true" /> Print poster
      </Button>
    </>
  );
}
