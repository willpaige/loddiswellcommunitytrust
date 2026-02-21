import Link from "next/link";
import { Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
            <Mail className="h-8 w-8" aria-hidden="true" />
          </div>
          <CardTitle className="mt-4">Check Your Email</CardTitle>
          <CardDescription>
            A sign-in link has been sent to your email address. Click the link to
            access the admin area.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="link" asChild>
            <Link href="/admin/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
