import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { users } from "@/lib/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Resend({
      from: process.env.RESEND_FROM_EMAIL || "noreply@loddiswellcommunitytrust.org",
      apiKey: process.env.RESEND_API_KEY,
    }),
  ],
  pages: {
    signIn: "/admin/login",
    verifyRequest: "/admin/verify",
    error: "/admin/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const allowed = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);
      return allowed.length > 0;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        (session.user as unknown as Record<string, unknown>).role =
          dbUser[0]?.role || "editor";
      }
      return session;
    },
  },
});
