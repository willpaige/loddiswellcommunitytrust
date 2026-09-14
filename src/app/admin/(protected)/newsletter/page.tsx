import { Download, UserPlus } from "lucide-react";
import { addNewsletterSubscriber, getNewsletterSubscribers } from "@/actions/newsletter-admin";
import { NewsletterSubscribersTable } from "@/components/admin/newsletter-subscribers-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

export default async function AdminNewsletterPage() {
  const subscribers = await getNewsletterSubscribers();
  const active = subscribers.filter((row) => row.status === "active").length;
  const unsubscribed = subscribers.length - active;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const recent = subscribers.filter(
    (row) => row.status === "active" && row.createdAt >= thirtyDaysAgo
  ).length;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Newsletter</h1>
          <p className="mt-1 text-muted-foreground">
            Everyone who has signed up for village news through the website.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="/api/admin/newsletter/export?status=all">
              <Download className="h-4 w-4" aria-hidden="true" />
              Export all
            </a>
          </Button>
          <Button asChild>
            <a href="/api/admin/newsletter/export">
              <Download className="h-4 w-4" aria-hidden="true" />
              Export active list
            </a>
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active subscribers</CardDescription>
            <CardTitle className="text-3xl">{active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Joined in the last 30 days</CardDescription>
            <CardTitle className="text-3xl">{recent}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unsubscribed</CardDescription>
            <CardTitle className="text-3xl">{unsubscribed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" aria-hidden="true" />
            Add a subscriber
          </CardTitle>
          <CardDescription>
            For someone who asked to be added in person or by email. An address that previously
            unsubscribed is reactivated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addNewsletterSubscriber} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="newsletterEmail">Email address</Label>
              <Input id="newsletterEmail" name="email" type="email" required placeholder="name@example.com" />
            </div>
            <Button type="submit">Add to list</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>All subscribers</CardTitle>
          <CardDescription>Newest signups first.</CardDescription>
        </CardHeader>
        <NewsletterSubscribersTable rows={subscribers} />
      </Card>
    </div>
  );
}
