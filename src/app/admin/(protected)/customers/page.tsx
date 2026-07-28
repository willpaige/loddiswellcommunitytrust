import Link from "next/link";
import { Pencil } from "lucide-react";
import { getAdminCustomers } from "@/actions/customers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const customers = await getAdminCustomers();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Customers</h1>
        <p className="mt-1 text-muted-foreground">
          Manage customer names, email addresses, contact numbers, and access roles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All customers</CardTitle>
          <CardDescription>Users created through account login, bookings, and admin access.</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="hidden md:table-cell">Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">{customer.name || "—"}</TableCell>
                <TableCell>{customer.email}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {customer.phone || "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={customer.role === "customer" ? "secondary" : "default"}>
                    {customer.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {customer.discountPercent > 0 ? `${customer.discountPercent}%` : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                    <Link href={`/admin/customers/${customer.id}/edit`} title="Edit customer">
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
