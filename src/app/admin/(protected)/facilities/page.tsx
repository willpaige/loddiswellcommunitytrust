import Link from "next/link";
import { Pencil, Building2 } from "lucide-react";
import { getFacilities } from "@/actions/facilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminFacilitiesPage() {
  const facilitiesList = await getFacilities();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Facilities</h1>
        <p className="mt-1 text-muted-foreground">
          Manage facility information, rates, and images.
        </p>
      </div>

      {facilitiesList.length === 0 ? (
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto">
              <Building2 className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
            </div>
            <CardTitle>No facilities yet</CardTitle>
            <CardDescription>
              Facilities will appear here once the database is seeded.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Facility</TableHead>
                <TableHead className="hidden sm:table-cell">Slug</TableHead>
                <TableHead className="hidden md:table-cell">Capacity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilitiesList.map((facility) => (
                <TableRow key={facility.id}>
                  <TableCell className="font-medium">{facility.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    /{facility.slug}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {facility.capacity || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={facility.published ? "default" : "secondary"}>
                      {facility.published ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                      <Link
                        href={`/admin/facilities/${facility.id}/edit`}
                        title="Edit facility"
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
      )}
    </div>
  );
}
