import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getEmailTemplate,
  resetEmailTemplate,
  updateEmailTemplate,
} from "@/actions/email-templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default async function AdminEmailTemplatePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const template = await getEmailTemplate(key);
  if (!template) notFound();

  const updateAction = updateEmailTemplate.bind(null, template.key);
  const resetAction = resetEmailTemplate.bind(null, template.key);

  return (
    <div>
      <Button variant="link" asChild className="mb-6 px-0 text-muted-foreground">
        <Link href="/admin/emails">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Emails
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{template.name}</h1>
        <p className="mt-1 text-muted-foreground">{template.description}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <form action={updateAction} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email content</CardTitle>
              <CardDescription>
                Use variables like {"{{customerName}}"} exactly as shown.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox id="enabled" name="enabled" defaultChecked={template.enabled} />
                <Label htmlFor="enabled" className="font-normal">
                  Enabled
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" name="subject" defaultValue={template.subject} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Body</Label>
                <Textarea id="body" name="body" defaultValue={template.body} rows={14} required />
                <p className="text-xs text-muted-foreground">
                  Blank lines become paragraphs in the branded email layout.
                </p>
              </div>
              <div className="flex gap-3">
                <Button type="submit">Save template</Button>
                <Button variant="outline" asChild>
                  <Link href="/admin/emails">Cancel</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Variables</CardTitle>
              <CardDescription>Available for this template.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(template.variables ?? []).map((variable) => (
                <code key={variable} className="rounded-sm bg-muted px-2 py-1 text-xs">
                  {"{{"}{variable}{"}}"}
                </code>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reset</CardTitle>
              <CardDescription>Restore the default copy for this template.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={resetAction}>
                <Button type="submit" variant="outline">
                  Reset to default
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
