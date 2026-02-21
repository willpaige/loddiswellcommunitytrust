import Link from "next/link";
import { Pencil, FileText } from "lucide-react";
import { getPages } from "@/actions/pages";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminPagesPage() {
  const pagesList = await getPages();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Pages</h1>
        <p className="mt-1 text-muted-foreground">
          Edit the content of your website pages.
        </p>
      </div>

      {pagesList.length === 0 ? (
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto">
              <FileText className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
            </div>
            <CardTitle>No pages yet</CardTitle>
            <CardDescription>
              Pages will appear here once the database is seeded with initial content.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead className="hidden sm:table-cell">URL</TableHead>
                <TableHead className="hidden md:table-cell">Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagesList.map((page) => (
                <TableRow key={page.id}>
                  <TableCell className="font-medium">{page.title}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    /{page.slug}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {format(page.updatedAt, "d MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                      <Link href={`/admin/pages/${page.slug}/edit`} title="Edit page">
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
