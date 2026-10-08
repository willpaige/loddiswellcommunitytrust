import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getRequirementQueue } from "@/actions/requirement-queue";
import { formatBookingDate } from "@/lib/booking-time";
import { requirementDeadline } from "@/lib/requirement-policy";
import { RequirementResendButton } from "@/components/admin/requirement-resend-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function OutstandingRequirementsPage() {
  const { rows, ready, metrics, interventions } = await getRequirementQueue();
  return <div className="space-y-6">
    <div><Link href="/admin/bookings" className="text-sm underline">Back to bookings</Link><h1 className="mt-3 text-3xl font-bold">Required information to chase</h1><p className="mt-2 text-muted-foreground">Upcoming sessions, earliest first. Information is due 48 hours before the session, or immediately for short-notice bookings.</p></div>
    <div className="grid gap-4 sm:grid-cols-3">
      <Card><CardHeader><CardTitle>{rows.length} outstanding · {ready} ready</CardTitle></CardHeader><CardContent>Confirmed bookings with upcoming sessions and required information.</CardContent></Card>
      <Card><CardHeader><CardTitle>{metrics.beforeFirstSession} of {metrics.trackedCompletions} completed before first session</CardTitle></CardHeader><CardContent>Completions recorded in the last 30 days. Historical forms without a recorded completion time are excluded.</CardContent></Card>
      <Card><CardHeader><CardTitle>{interventions} manual chases</CardTitle></CardHeader><CardContent>Last 30 days · {rows.filter(r => r.delivery === "Email failed" || r.delivery === "Email bounced").length} outstanding bookings with email failures.</CardContent></Card>
    </div>
    {!rows.length && <p>No upcoming bookings need chasing.</p>}
    {rows.map(row => <Card key={row.id}><CardHeader><div className="flex flex-wrap items-center gap-3"><CardTitle>{row.customerName} · {row.facilityName}</CardTitle><Badge variant="destructive">{row.progress}</Badge>{requirementDeadline(row.startDate).overdue && <Badge variant="destructive">Due now</Badge>}</div><p className="text-sm">Next session: {formatBookingDate(row.startDate, "d MMM yyyy, HH:mm")} · <a href={`mailto:${row.customerEmail}`} className="underline">{row.customerEmail}</a></p></CardHeader><CardContent className="space-y-3">
      <ul className="list-disc pl-5 text-sm">{row.outstanding.map((item, index) => <li key={index}>{item}</li>)}</ul>
      <p className="text-sm">{row.delivery}{row.lastAttemptAt ? ` · last attempt ${row.lastAttemptAt.toLocaleString("en-GB", { timeZone: "Europe/London" })}` : ""}</p>
      {row.error && <p className="text-sm text-destructive">{row.error}</p>}
      <div className="flex flex-wrap items-start gap-4"><RequirementResendButton bookingId={row.id} requestId={randomUUID()} /><Link href={`/admin/bookings/${row.id}/edit`} className="text-sm underline">Review booking and affected sessions</Link></div>
    </CardContent></Card>)}
  </div>;
}
