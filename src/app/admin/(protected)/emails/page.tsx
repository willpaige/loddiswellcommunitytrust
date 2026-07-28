import Link from "next/link";
import { Mail, Pencil } from "lucide-react";
import { getEmailTemplates } from "@/actions/email-templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const categoryLabels: Record<string, string> = {
  bookings: "Bookings",
  lottery: "Lottery",
  system: "System",
};

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const activeCategory = params.category;
  const templates = await getEmailTemplates(activeCategory);
  const categories = activeCategory ? [activeCategory] : ["bookings", "lottery", "system"];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Emails</h1>
        <p className="mt-1 text-muted-foreground">
          Edit branded email subjects and body copy. Layout and variables are managed by the system.
        </p>
      </div>

      <div className="grid gap-6">
        {categories.map((category) => {
          const rows = templates.filter((template) => template.category === category);
          if (rows.length === 0) return null;
          return (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                  {categoryLabels[category]}
                </CardTitle>
                <CardDescription>
                  {category === "bookings"
                    ? "Customer and booking manager messages."
                    : category === "lottery"
                      ? "Lottery subscription, draw, and payment messages."
                      : "Account and operational email templates."}
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                {rows.map((template) => (
                  <div key={template.key} className="flex items-center justify-between gap-4 py-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium">{template.name}</h2>
                        <Badge variant={template.enabled ? "default" : "secondary"}>
                          {template.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {template.description}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/admin/emails/${template.key}`} title={`Edit ${template.name}`}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
