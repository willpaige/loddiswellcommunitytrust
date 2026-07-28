"use client";

import { usePathname } from "next/navigation";

type SiteChromeProps = {
  children: React.ReactNode;
};

const hiddenChromePaths = new Set(["/lottery/show"]);

export function SiteChrome({ children }: SiteChromeProps) {
  const pathname = usePathname();

  if (hiddenChromePaths.has(pathname)) {
    return null;
  }

  return children;
}
