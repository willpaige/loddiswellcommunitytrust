import Link from "next/link";
import { Pencil } from "lucide-react";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { pages } from "@/lib/db/schema";
import { pageSchemas } from "@/lib/cms/page-schemas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminPagesPage() {
  const dbRows = await db.select().from(pages);
  const dbBySlug = new Map(dbRows.map((r) => [r.slug, r]));

  const rows = Object.values(pageSchemas).map((schema) => {
    const row = dbBySlug.get(schema.slug);
    const publicPath = schema.slug === "home" ? "/" : `/${schema.slug}`;
    return {
      slug: schema.slug,
      title: row?.title ?? schema.title,
      publicPath,
      updatedAt: row?.updatedAt ?? null,
      blockCount: schema.blocks.length,
    };
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Pages</h1>
        <p className="mt-1 text-muted-foreground">
          Edit the content of your website pages.
        </p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page</TableHead>
              <TableHead className="hidden sm:table-cell">URL</TableHead>
              <TableHead className="hidden lg:table-cell">Blocks</TableHead>
              <TableHead className="hidden md:table-cell">Last updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.slug}>
                <TableCell className="font-medium">{row.title}</TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {row.publicPath}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {row.blockCount}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {row.updatedAt
                    ? format(row.updatedAt, "d MMM yyyy")
                    : "Never edited"}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                    <Link
                      href={`/admin/pages/${row.slug}/edit`}
                      title="Edit page"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
