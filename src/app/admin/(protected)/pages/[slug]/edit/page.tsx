import { notFound } from "next/navigation";
import { pageSchemas } from "@/lib/cms/page-schemas";
import { getPage } from "@/actions/pages";
import { PageEditor } from "@/components/admin/page-editor";

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const schema = pageSchemas[slug];
  if (!schema) notFound();

  const row = await getPage(slug);
  let blocks: Record<string, unknown> = {};
  if (row?.content) {
    try {
      const parsed = JSON.parse(row.content);
      if (parsed && typeof parsed === "object") {
        blocks = parsed as Record<string, unknown>;
      }
    } catch {
      blocks = {};
    }
  }

  return (
    <PageEditor
      schema={schema}
      initialTitle={row?.title ?? schema.title}
      initialMetaDescription={row?.metaDescription ?? ""}
      initialBlocks={blocks}
      initialHeroImageUrl={row?.heroImageUrl ?? ""}
    />
  );
}
