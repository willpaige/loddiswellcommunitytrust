import { Mail } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccountVerifyPage() {
  return (
    <main className="min-h-[70vh] bg-muted px-4 py-16">
      <Card className="mx-auto w-full max-w-sm text-center">
        <CardHeader>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
            <Mail className="h-8 w-8" aria-hidden="true" />
          </div>
          <CardTitle className="mt-4">Check your email</CardTitle>
          <CardDescription>
            A secure sign-in link has been sent to your email address.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
