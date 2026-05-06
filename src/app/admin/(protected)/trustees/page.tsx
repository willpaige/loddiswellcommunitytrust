import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, Users } from "lucide-react";
import { getTrustees, deleteTrustee } from "@/actions/trustees";
import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminTrusteesPage() {
  const list = await getTrustees();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Trustees</h1>
          <p className="mt-1 text-muted-foreground">
            The committee shown on the About page.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/trustees/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add trustee
          </Link>
        </Button>
      </div>

      {list.length === 0 ? (
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto">
              <Users
                className="h-12 w-12 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <CardTitle>No trustees yet</CardTitle>
            <CardDescription>
              Add the first member of the committee to start populating the
              About page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/trustees/new">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add trustee
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Role</TableHead>
                <TableHead className="hidden md:table-cell">Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((trustee) => (
                <TableRow key={trustee.id}>
                  <TableCell>
                    {trustee.photoUrl ? (
                      <div className="relative h-10 w-10 overflow-hidden rounded-full">
                        <Image
                          src={trustee.photoUrl}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {trustee.name
                          .split(" ")
                          .map((p) => p[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{trustee.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {trustee.role}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {trustee.sortOrder}
                  </TableCell>
                  <TableCell>
                    <Badge variant={trustee.published ? "default" : "secondary"}>
                      {trustee.published ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8"
                      >
                        <Link
                          href={`/admin/trustees/${trustee.id}/edit`}
                          title="Edit trustee"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </Button>
                      <DeleteButton
                        id={trustee.id}
                        action={deleteTrustee}
                        label="Delete trustee"
                      />
                    </div>
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
