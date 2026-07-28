import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  variant = "default",
  decorative = false,
}: {
  className?: string;
  variant?: "default" | "light";
  decorative?: boolean;
}) {
  return (
    <Image
      src={
        variant === "light"
          ? "/loddiswell-community-trust-logo-light.png"
          : "/loddiswell-community-trust-logo.png"
      }
      alt={decorative ? "" : "Loddiswell Community Trust"}
      width={964}
      height={207}
      priority
      className={cn("h-auto w-full", className)}
    />
  );
}
