import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminCustomer, updateAdminCustomer } from "@/actions/customers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

export default async function AdminEditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getAdminCustomer(id);
  if (!customer) notFound();
  const action = updateAdminCustomer.bind(null, customer.id);

  return (
    <div>
      <Button variant="link" asChild className="mb-6 px-0 text-muted-foreground">
        <Link href="/admin/customers">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to customers
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit customer</h1>
        <p className="mt-1 text-muted-foreground">
          Updating an email address also updates matching booking and lottery records.
        </p>
      </div>

      <form action={action} className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={customer.name ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={customer.email} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={customer.phone ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                defaultValue={customer.role}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="customer">Customer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="discountPercent">Discount (%)</Label>
              <Input
                id="discountPercent"
                name="discountPercent"
                type="number"
                min="0"
                max="100"
                defaultValue={customer.discountPercent ?? 0}
              />
              <p className="text-xs text-muted-foreground">
                Applied automatically to this customer&apos;s bookings. Where it overlaps the
                repeat-booking discount, the larger one is used.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit">Save customer</Button>
          <Button variant="outline" asChild>
            <Link href="/admin/customers">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
