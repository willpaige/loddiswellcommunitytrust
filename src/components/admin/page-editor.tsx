"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import {
  groupBlocks,
  type BlockSchema,
  type PageSchema,
} from "@/lib/cms/page-schemas";
import { updatePage } from "@/actions/pages";

type Props = {
  schema: PageSchema;
  initialTitle: string;
  initialMetaDescription: string;
  initialBlocks: Record<string, unknown>;
};

type TiptapDoc = {
  type: string;
  content?: TiptapDoc[];
  text?: string;
  marks?: unknown[];
  attrs?: Record<string, unknown>;
};

const EMPTY_DOC = { type: "doc", content: [] };

function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as TiptapDoc;
  if (n.type === "text" && typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) {
    return n.content.map(extractText).join("");
  }
  return "";
}

function inlineDocFromText(text: string): TiptapDoc {
  if (!text) return { type: "doc", content: [{ type: "paragraph" }] };
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function buildInitialValues(
  schema: PageSchema,
  blocks: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const block of schema.blocks) {
    const stored = blocks[block.key];
    if (block.type === "inline") {
      out[block.key] = extractText(stored);
    } else {
      out[block.key] = stored ? JSON.stringify(stored) : JSON.stringify(EMPTY_DOC);
    }
  }
  return out;
}

export function PageEditor({
  schema,
  initialTitle,
  initialMetaDescription,
  initialBlocks,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [metaDescription, setMetaDescription] = useState(initialMetaDescription);
  const [values, setValues] = useState(() =>
    buildInitialValues(schema, initialBlocks)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = groupBlocks(schema);

  function setBlockValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const blocks: Record<string, TiptapDoc> = {};
    for (const block of schema.blocks) {
      const v = values[block.key] ?? "";
      if (block.type === "inline") {
        blocks[block.key] = inlineDocFromText(v.trim());
      } else {
        try {
          const parsed = JSON.parse(v);
          blocks[block.key] = (parsed && typeof parsed === "object"
            ? parsed
            : EMPTY_DOC) as TiptapDoc;
        } catch {
          blocks[block.key] = EMPTY_DOC as TiptapDoc;
        }
      }
    }

    const formData = new FormData();
    formData.set("title", title);
    formData.set("metaDescription", metaDescription);
    formData.set("blocks", JSON.stringify(blocks));

    try {
      await updatePage(schema.slug, formData);
      router.push("/admin/pages");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <div>
      <Button
        variant="link"
        asChild
        className="mb-6 px-0 text-muted-foreground"
      >
        <Link href="/admin/pages">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Pages
        </Link>
      </Button>
      <h1 className="text-3xl font-bold mb-2">Edit Page: {schema.title}</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Editing prose for{" "}
        <code className="font-mono text-xs">
          {schema.slug === "home" ? "/" : `/${schema.slug}`}
        </code>
        . Layout, buttons and grids stay in code.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Page metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Page title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Used as the browser tab title.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="metaDescription">Meta description</Label>
              <Textarea
                id="metaDescription"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder="Brief description for search engines..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 150–160 characters.
              </p>
            </div>
          </CardContent>
        </Card>

        {groups.map(({ group, blocks }) => (
          <Card key={group}>
            <CardHeader>
              <CardTitle>{group}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {blocks.map((block) => (
                <BlockField
                  key={block.key}
                  block={block}
                  value={values[block.key] ?? ""}
                  onChange={(v) => setBlockValue(block.key, v)}
                />
              ))}
            </CardContent>
          </Card>
        ))}

        <Separator />

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Save changes
          </Button>
          <Button
            type="button"
            variant="ghost"
            asChild
            disabled={saving}
          >
            <Link href="/admin/pages">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

function BlockField({
  block,
  value,
  onChange,
}: {
  block: BlockSchema;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`block-${block.key}`}>{block.label}</Label>
      {block.type === "inline" ? (
        <Input
          id={`block-${block.key}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <RichTextEditor content={value} onChange={onChange} />
      )}
      {block.help && (
        <p className="text-xs text-muted-foreground">{block.help}</p>
      )}
    </div>
  );
}
