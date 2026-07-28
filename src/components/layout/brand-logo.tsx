import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/loddiswell-community-trust-logo.png"
      alt="Loddiswell Community Trust"
      width={964}
      height={207}
      priority
      className={cn("h-auto w-full", className)}
    />
  );
}
