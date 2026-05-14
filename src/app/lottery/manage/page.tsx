import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ManageForm } from "@/components/lottery/manage-form";

export const metadata: Metadata = {
  title: "Manage your subscription",
  description:
    "Manage your Loddiswell Community Lottery subscription — update your payment details or cancel.",
};

export default function ManageLotteryPage() {
  return (
    <div>
      <PageHeader
        label="Lottery"
        title="Manage your subscription"
        subtitle="Enter the email you used when you signed up. We'll send you a secure link to update your payment details, cancel, or download invoices."
      />

      <section className="py-20 sm:py-24 bg-background">
        <div className="mx-auto max-w-md px-4 sm:px-6 lg:px-8">
          <ManageForm />
        </div>
      </section>
    </div>
  );
}
