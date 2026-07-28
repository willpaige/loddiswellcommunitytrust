import { AccountLoginForm } from "@/components/account/login-form";
import { BrandLogo } from "@/components/layout/brand-logo";

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-sage-800 px-4 py-16">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/hero-bg.jpg')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-sage-900/75" aria-hidden="true" />
      <div className="relative mx-auto w-full max-w-sm">
        <div className="mx-auto mb-6 w-full max-w-[320px] rounded-sm bg-white p-3">
          <BrandLogo />
        </div>
        <AccountLoginForm callbackUrl={params.callbackUrl || "/account"} />
      </div>
    </main>
  );
}
