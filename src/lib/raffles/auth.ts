import { auth } from "@/lib/auth";

// Customers can sign in too, so "signed in" is not enough for admin actions.
export async function requireStaff() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "editor")) {
    throw new Error("Unauthorized");
  }
  return session;
}
