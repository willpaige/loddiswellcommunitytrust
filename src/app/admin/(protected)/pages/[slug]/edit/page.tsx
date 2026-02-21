"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getPage, updatePage } from "@/actions/pages";

export default function EditPagePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("{}");
  const [metaDescription, setMetaDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    async function loadPage() {
      const page = await getPage(slug);
      if (page) {
        setTitle(page.title);
        setContent(page.content);
        setMetaDescription(page.metaDescription || "");
      }
      setPageLoading(false);
    }
    loadPage();
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.set("title", title);
    formData.set("content", content);
    formData.set("metaDescription", metaDescription);

    try {
      await updatePage(slug, formData);
      router.push("/admin/pages");
    } catch {
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <Button variant="link" asChild className="mb-6 px-0 text-muted-foreground">
        <Link href="/admin/pages">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Pages
        </Link>
      </Button>
      <h1 className="text-3xl font-bold mb-8">Edit Page: {title}</h1>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Page Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Page Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Content</Label>
              <RichTextEditor content={content} onChange={setContent} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SEO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="metaDescription">Meta Description</Label>
              <Textarea
                id="metaDescription"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder="Brief description for search engines..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 150-160 characters.
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save Changes
        </Button>
      </form>
    </div>
  );
}
