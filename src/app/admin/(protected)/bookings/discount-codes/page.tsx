import { format } from "date-fns";
import {
  createBookingDiscountCode,
  getBookingDiscountCodes,
  updateBookingDiscountCode,
} from "@/actions/booking-discount-codes";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function CodeFields({ code }: { code?: Awaited<ReturnType<typeof getBookingDiscountCodes>>[number] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-2">
        <Label>Code</Label>
        <Input name="code" defaultValue={code?.code} placeholder="SUMMER10" required />
      </div>
      <div className="space-y-2">
        <Label>Discount (%)</Label>
        <Input name="discountPercent" type="number" min="1" max="100" step="1" defaultValue={code?.discountPercent} required />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Description</Label>
        <Input name="description" defaultValue={code?.description ?? ""} placeholder="Optional internal note" />
      </div>
      <div className="space-y-2">
        <Label>Valid from</Label>
        <Input name="validFrom" type="date" defaultValue={code?.validFrom ? format(code.validFrom, "yyyy-MM-dd") : ""} />
      </div>
      <div className="space-y-2">
        <Label>Valid until</Label>
        <Input name="validUntil" type="date" defaultValue={code?.validUntil ? format(code.validUntil, "yyyy-MM-dd") : ""} />
      </div>
      <div className="space-y-2">
        <Label>Total usage limit</Label>
        <Input name="maxRedemptions" type="number" min="1" defaultValue={code?.maxRedemptions ?? ""} placeholder="Unlimited" />
      </div>
      <div className="space-y-2">
        <Label>Limit per customer</Label>
        <Input name="maxRedemptionsPerCustomer" type="number" min="1" defaultValue={code?.maxRedemptionsPerCustomer ?? ""} placeholder="Unlimited" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="active" type="checkbox" defaultChecked={code?.active ?? true} />
        Active
      </label>
    </div>
  );
}

export default async function DiscountCodesPage() {
  const codes = await getBookingDiscountCodes();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Discount codes</h1>
        <p className="mt-1 text-muted-foreground">Create percentage discounts for public and manual bookings.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Create discount code</CardTitle><CardDescription>The largest eligible discount is used; discounts never stack.</CardDescription></CardHeader>
        <CardContent>
          <form action={createBookingDiscountCode} className="space-y-4">
            <CodeFields />
            <PendingSubmitButton idleLabel="Create code" pendingLabel="Creating…" />
          </form>
        </CardContent>
      </Card>
      <div className="space-y-4">
        {codes.map((code) => (
          <Card key={code.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-4"><span>{code.code}</span><span className="text-sm font-normal text-muted-foreground">Used {code.redemptions}{code.maxRedemptions ? ` of ${code.maxRedemptions}` : " times"}</span></CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateBookingDiscountCode.bind(null, code.id)} className="space-y-4">
                <CodeFields code={code} />
                <PendingSubmitButton idleLabel="Save changes" pendingLabel="Saving…" />
              </form>
            </CardContent>
          </Card>
        ))}
        {!codes.length && <p className="text-sm text-muted-foreground">No discount codes yet.</p>}
      </div>
    </div>
  );
}
