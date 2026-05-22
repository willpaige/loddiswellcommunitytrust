import { AccountLoginForm } from "@/components/account/login-form";

export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center bg-sage-800 px-4 py-16">
      <div className="mx-auto w-full max-w-sm">
        <p className="mb-6 text-center font-serif text-3xl tracking-tight text-white">
          Loddiswell Community Trust
        </p>
        <AccountLoginForm callbackUrl={params.callbackUrl || "/account/bookings"} />
      </div>
    </main>
  );
}
