"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("postmark", {
        email,
        redirect: false,
        callbackUrl: "/admin",
      });

      if (result?.error) {
        setError(
          "Unable to send login link. Please check your email address is authorised."
        );
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
              <Mail className="h-8 w-8" aria-hidden="true" />
            </div>
            <CardTitle className="mt-4">Check Your Email</CardTitle>
            <CardDescription>
              A sign-in link has been sent to <strong>{email}</strong>. Click the
              link in the email to access the admin area.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="link" onClick={() => setSent(false)}>
              Use a different email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xl">
            L
          </div>
          <CardTitle className="mt-4">Admin Sign In</CardTitle>
          <CardDescription>Loddiswell Community Trust</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Sending link...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Send Sign-In Link
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Only authorised trustees can sign in. Contact the Trust if you need
            access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
