import { AccountLoginForm } from "@/components/account/login-form";

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
        <p className="mb-6 text-center font-serif text-3xl tracking-tight text-white">
          Loddiswell Community Trust
        </p>
        <AccountLoginForm callbackUrl={params.callbackUrl || "/account"} />
      </div>
    </main>
  );
}
