import NextAuth from "next-auth";
import Postmark from "next-auth/providers/postmark";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Postmark({
      from: process.env.EMAIL_FROM || "noreply@loddiswellcommunitytrust.org",
      apiKey: process.env.POSTMARK_API_KEY,
    }),
  ],
  pages: {
    signIn: "/account/login",
    verifyRequest: "/account/verify",
    error: "/account/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return true;
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
          dbUser[0]?.role || "customer";
      }
      return session;
    },
  },
});
