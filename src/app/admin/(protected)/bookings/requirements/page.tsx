import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  addRequirementQuestion,
  createRequirementSet,
  deactivateRequirementQuestion,
  getRequirementSets,
  updateRequirementQuestion,
  updateRequirementSet,
} from "@/actions/booking-requirements";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";

export const dynamic = "force-dynamic";

const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

export default async function AdminRequirementsPage() {
  const sets = await getRequirementSets();

  return (
    <div className="max-w-4xl">
      <Button variant="link" asChild className="mb-6 px-0 text-muted-foreground">
        <Link href="/admin/bookings">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to bookings
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Booking requirements</h1>
        <p className="mt-1 text-muted-foreground">
          Build questionnaires customers complete after booking. Assign a set to a booking type
          on the bookings settings page. Answering &ldquo;yes&rdquo; to a flagged question requires a
          document upload.
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>New requirement set</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createRequirementSet} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Name</Label>
              <Input id="new-name" name="name" placeholder="Event hire questionnaire" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-description">Description</Label>
              <Input id="new-description" name="description" placeholder="Optional internal note" />
            </div>
            <Button type="submit">Create set</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-8">
        {sets.map((set) => (
          <Card key={set.id}>
            <CardHeader>
              <CardTitle>{set.name}</CardTitle>
              <CardDescription>{set.active ? "Active" : "Inactive"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form action={updateRequirementSet} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={set.id} />
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input name="name" defaultValue={set.name} required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input name="description" defaultValue={set.description ?? ""} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="active" defaultChecked={set.active} /> Active
                </label>
                <div className="sm:col-span-2">
                  <Button type="submit" variant="outline" size="sm">
                    Save set
                  </Button>
                </div>
              </form>

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Questions</h3>
                {set.questions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No questions yet.</p>
                )}
                {set.questions.map((question) => (
                  <form
                    key={question.id}
                    action={updateRequirementQuestion}
                    className="grid gap-3 rounded-md border p-4 sm:grid-cols-2"
                  >
                    <input type="hidden" name="id" value={question.id} />
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Question</Label>
                      <Input name="label" defaultValue={question.label} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <select name="type" defaultValue={question.type} className={selectClass}>
                        <option value="yes_no">Yes / No</option>
                        <option value="text">Short text</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Document label (if required)</Label>
                      <Input
                        name="documentLabel"
                        defaultValue={question.documentLabel ?? ""}
                        placeholder="e.g. Inflatable company insurance"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <input
                        type="checkbox"
                        name="requiresDocumentOnYes"
                        defaultChecked={question.requiresDocumentOnYes}
                      />
                      Require a document upload when answered &ldquo;yes&rdquo;
                    </label>
                    <div className="flex gap-2 sm:col-span-2">
                      <Button type="submit" variant="outline" size="sm">
                        Save question
                      </Button>
                      <Button
                        type="submit"
                        formAction={deactivateRequirementQuestion}
                        variant="ghost"
                        size="sm"
                      >
                        Remove
                      </Button>
                    </div>
                  </form>
                ))}

                <form action={addRequirementQuestion} className="grid gap-3 rounded-md border border-dashed p-4 sm:grid-cols-2">
                  <input type="hidden" name="setId" value={set.id} />
                  <div className="space-y-2 sm:col-span-2">
                    <Label>New question</Label>
                    <Input name="label" placeholder="Do you intend to have a bouncy castle?" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <select name="type" defaultValue="yes_no" className={selectClass}>
                      <option value="yes_no">Yes / No</option>
                      <option value="text">Short text</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Document label (if required)</Label>
                    <Input name="documentLabel" placeholder="e.g. Inflatable company insurance" />
                  </div>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" name="requiresDocumentOnYes" />
                    Require a document upload when answered &ldquo;yes&rdquo;
                  </label>
                  <div className="sm:col-span-2">
                    <PendingSubmitButton
                      idleLabel="Add question"
                      pendingLabel="Adding question..."
                    />
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
