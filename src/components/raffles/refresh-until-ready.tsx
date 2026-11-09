"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * The buyer can land on the success page before Stripe's webhook has given
 * them ticket numbers. Refresh every 2s for up to ~30s while that happens.
 */
export function RefreshUntilReady() {
  const router = useRouter();
  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      router.refresh();
      if (tries >= 15) clearInterval(id);
    }, 2000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
