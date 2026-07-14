"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Trash2 } from "lucide-react";
import {
  deleteRequirementDocument,
  saveRequirementAnswers,
  uploadRequirementDocument,
} from "@/actions/booking-requirements";
import type { BookingRequirementDetail } from "@/lib/booking-requirements";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BookingRequirementsForm({
  bookingId,
  detail,
  locked,
}: {
  bookingId: string;
  detail: BookingRequirementDetail;
  locked: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const q of detail.questions) {
      initial[q.questionId] =
        q.type === "yes_no"
          ? q.answerBool === true
            ? "yes"
            : q.answerBool === false
              ? "no"
              : ""
          : q.answerText ?? "";
    }
    return initial;
  });
  const [savingAnswers, setSavingAnswers] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<Record<string, string>>({});

  async function handleSaveAnswers(formData: FormData) {
    setSavingAnswers(true);
    try {
      await saveRequirementAnswers(formData);
      router.refresh();
    } finally {
      setSavingAnswers(false);
    }
  }

  async function handleUpload(questionId: string, formData: FormData) {
    setUploadingId(questionId);
    setUploadError((prev) => ({ ...prev, [questionId]: "" }));
    try {
      const result = await uploadRequirementDocument(formData);
      if (result?.error) {
        setUploadError((prev) => ({ ...prev, [questionId]: result.error! }));
      } else {
        router.refresh();
      }
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {detail.complete && (
        <div className="flex items-center gap-2 rounded-md border border-green-600/30 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          All required information has been provided. Thank you.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Questionnaire</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleSaveAnswers} className="space-y-5">
            <input type="hidden" name="bookingId" value={bookingId} />
            {detail.questions.map((q) => (
              <div key={q.questionId} className="space-y-2">
                <Label>{q.label}</Label>
                {q.type === "yes_no" ? (
                  <div className="flex gap-4 text-sm">
                    {["yes", "no"].map((value) => (
                      <label key={value} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`answer_${q.questionId}`}
                          value={value}
                          checked={answers[q.questionId] === value}
                          disabled={locked}
                          onChange={(event) =>
                            setAnswers((prev) => ({ ...prev, [q.questionId]: event.target.value }))
                          }
                        />
                        {value === "yes" ? "Yes" : "No"}
                      </label>
                    ))}
                  </div>
                ) : (
                  <Input
                    name={`answer_${q.questionId}`}
                    value={answers[q.questionId] ?? ""}
                    disabled={locked}
                    onChange={(event) =>
                      setAnswers((prev) => ({ ...prev, [q.questionId]: event.target.value }))
                    }
                  />
                )}
              </div>
            ))}
            {!locked && (
              <Button type="submit" disabled={savingAnswers}>
                {savingAnswers ? "Saving..." : "Save answers"}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {detail.questions.some((q) => q.needsDocument) && (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {detail.questions
              .filter((q) => q.needsDocument)
              .map((q) => (
                <div key={q.questionId} className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">{q.documentLabel || q.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Required because you answered yes to &ldquo;{q.label}&rdquo;. PDF, PNG or JPG, up to 10MB.
                    </p>
                  </div>

                  {q.documents.length > 0 ? (
                    <ul className="space-y-2">
                      {q.documents.map((doc) => (
                        <li
                          key={doc.id}
                          className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm"
                        >
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 text-primary underline"
                          >
                            <FileText className="h-4 w-4" aria-hidden="true" />
                            {doc.fileName}
                          </a>
                          {!locked && (
                            <form action={deleteRequirementDocument}>
                              <input type="hidden" name="documentId" value={doc.id} />
                              <Button type="submit" variant="ghost" size="icon" className="h-8 w-8">
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Remove</span>
                              </Button>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No document uploaded yet.</p>
                  )}

                  {!locked && (
                    <form action={(formData) => handleUpload(q.questionId, formData)} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="bookingId" value={bookingId} />
                      <input type="hidden" name="questionId" value={q.questionId} />
                      <Input
                        type="file"
                        name="file"
                        accept="application/pdf,image/png,image/jpeg"
                        required
                        className="max-w-xs"
                      />
                      <Button type="submit" variant="outline" disabled={uploadingId === q.questionId}>
                        {uploadingId === q.questionId ? "Uploading..." : "Upload"}
                      </Button>
                    </form>
                  )}
                  {uploadError[q.questionId] && (
                    <p className="text-sm text-destructive">{uploadError[q.questionId]}</p>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {locked && (
        <p className="text-sm text-muted-foreground">
          This booking has started, so required information can no longer be changed.
        </p>
      )}
    </div>
  );
}
