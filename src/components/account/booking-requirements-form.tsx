"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { CheckCircle2, Trash2 } from "lucide-react";
import { deleteRequirementDocument, saveRequirementAnswers, uploadRequirementDocument } from "@/actions/booking-requirements";
import type { BookingRequirementDetail } from "@/lib/booking-requirements";
import { REQUIREMENT_UPLOAD_LIMIT, REQUIREMENT_UPLOAD_TYPES } from "@/lib/requirement-policy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BookingRequirementsForm({ bookingId, detail, locked, confirmed = false }: {
  bookingId: string; detail: BookingRequirementDetail; locked: boolean; confirmed?: boolean;
}) {
  const [saved, setSaved] = useState(detail);
  const [answers, setAnswers] = useState<Record<string, string>>(() => Object.fromEntries(detail.questions.map(q => [q.questionId,
    q.type === "yes_no" ? q.answerBool === true ? "yes" : q.answerBool === false ? "no" : "" : q.answerText ?? ""])));
  const answersRef = useRef(answers);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Serialize writes so a slower earlier save cannot overwrite a newer answer.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const save = (values: Record<string, string>) => {
    setPending(n => n + 1);
    const next = queue.current.then(async () => {
      const form = new FormData(); form.set("bookingId", bookingId);
      for (const [key, value] of Object.entries(values)) form.set(`answer_${key}`, value);
      try {
        setSaved(await saveRequirementAnswers(form));
        setError(""); setNotice("Answers saved.");
      } catch {
        setError("Your answers could not be saved. Check your connection and choose Save answers to retry. If your session has expired, sign in again.");
        throw new Error("Save failed");
      } finally { setPending(n => n - 1); }
    });
    queue.current = next.catch(() => {});
    return next;
  };
  function change(id: string, value: string, immediately: boolean) {
    const next = { ...answersRef.current, [id]: value };
    answersRef.current = next; setAnswers(next); setNotice("");
    if (immediately) void save({ [id]: value }).catch(() => {});
  }
  const answered = saved.questions.filter(q => q.answered).length;
  const missingDocs = saved.questions.filter(q => q.needsDocument && !q.documents.length).length;
  const dirty = saved.questions.some(q => (q.type === "yes_no" ? q.answerBool === true ? "yes" : q.answerBool === false ? "no" : "" : q.answerText ?? "") !== (answers[q.questionId] ?? "").trim());
  const complete = saved.complete && !dirty && pending === 0 && !error && !uploading;
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (dirty || pending > 0 || uploading) window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending, uploading]);

  async function handleUpload(questionId: string, formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) { setError("Choose a file to upload."); return; }
    if (!REQUIREMENT_UPLOAD_TYPES.includes(file.type) || file.size > REQUIREMENT_UPLOAD_LIMIT) {
      setError("Choose a PDF, PNG or JPG file no larger than 10 MB."); return;
    }
    setUploading(questionId); setUploadProgress(0); setError("");
    try {
      await save(answersRef.current);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
      const blob = await upload(`booking-documents/${bookingId}/${questionId}/${crypto.randomUUID()}-${safeName}`, file, {
        access: "public", handleUploadUrl: "/api/booking-requirements/upload",
        clientPayload: JSON.stringify({ bookingId, questionId }),
        onUploadProgress: ({ percentage }) => setUploadProgress(Math.round(percentage)),
      });
      const data = new FormData(); data.set("bookingId", bookingId); data.set("questionId", questionId);
      data.set("url", blob.url); data.set("fileName", file.name);
      setSaved(await uploadRequirementDocument(data)); setNotice("Document uploaded and saved.");
    } catch {
      setError("The document could not be saved. Check your connection and try uploading it again. If your session has expired, sign in again.");
    } finally { setUploading(null); }
  }
  async function remove(documentId: string) {
    setError("");
    try {
      const form = new FormData(); form.set("documentId", documentId);
      setSaved(await deleteRequirementDocument(form)); setNotice("Document removed.");
    } catch { setError("The document could not be removed. Please try again."); }
  }

  return <div className="space-y-6">
    <div role="status" aria-live="polite" className={`rounded-md border p-4 ${complete ? "border-green-600/30 bg-green-50 text-green-800" : "bg-muted/40"}`}>
      {complete ? <><p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-5 w-5" />{confirmed ? "Required information complete — ready for hire" : "Required information complete"}</p><p className="mt-1 text-sm">Your answers and required documents have been saved. Thank you. They apply to all sessions in this booking.</p></>
        : <><p className="font-medium">{answered} of {saved.questions.length} questions saved{missingDocs > 0 ? ` · ${missingDocs} document${missingDocs === 1 ? "" : "s"} still needed` : ""}</p><p className="mt-1 text-sm">Answer every question and upload the documents requested below. Answers save when you select an option or leave a text field.</p></>}
    </div>
    {error && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{error}</p>}
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{pending > 0 ? "Saving answers…" : dirty ? "You have unsaved answers." : notice}</p>
    <Card><CardHeader><CardTitle>Questionnaire</CardTitle></CardHeader><CardContent>
      <form className="space-y-6" onSubmit={event => { event.preventDefault(); void save(answersRef.current).catch(() => {}); }}>
        {saved.questions.map(q => <div key={q.questionId} className="space-y-2">
          <Label htmlFor={`answer-${q.questionId}`}>{q.label}</Label>
          {q.type === "yes_no" ? <fieldset disabled={locked || !!uploading} className="flex gap-5"><legend className="sr-only">{q.label}</legend>
            {["yes", "no"].map(value => <label key={value} className="flex items-center gap-2 text-sm"><input type="radio" name={`answer_${q.questionId}`} value={value} checked={answers[q.questionId] === value} onChange={() => change(q.questionId, value, true)} />{value === "yes" ? "Yes" : "No"}</label>)}
          </fieldset> : <Input id={`answer-${q.questionId}`} value={answers[q.questionId] ?? ""} maxLength={5000} disabled={locked || !!uploading} onChange={event => change(q.questionId, event.target.value, false)} onBlur={() => { if (!locked) void save({ [q.questionId]: answersRef.current[q.questionId] ?? "" }).catch(() => {}); }} />}
          {!q.answered && <p className="text-xs text-muted-foreground">Answer required</p>}
          {q.requiresDocumentOnYes && answers[q.questionId] === "yes" && <p className="text-sm font-medium">Document required: {q.documentLabel || q.label}. Upload it below.</p>}
        </div>)}
        {!locked && <Button type="submit" disabled={pending > 0 || !!uploading}>{pending > 0 ? "Saving…" : "Save answers"}</Button>}
      </form>
    </CardContent></Card>
    {saved.questions.filter(q => q.requiresDocumentOnYes && answers[q.questionId] === "yes").map(q => <Card key={q.questionId}>
      <CardHeader><CardTitle>{q.documentLabel || q.label}</CardTitle></CardHeader>
      <CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Required because you answered yes. PDF, PNG or JPG, up to 10 MB.</p>
        {q.documents.length ? <ul className="space-y-2">{q.documents.map(doc => <li key={doc.id} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm"><a href={doc.fileUrl} target="_blank" rel="noreferrer" className="underline">{doc.fileName}</a>{!locked && <Button type="button" size="icon" variant="ghost" disabled={!!uploading || pending > 0} onClick={() => void remove(doc.id)}><Trash2 className="h-4 w-4" /><span className="sr-only">Remove {doc.fileName}</span></Button>}</li>)}</ul> : <p className="text-sm font-medium">Document still needed</p>}
        {!locked && <form action={data => handleUpload(q.questionId, data)} className="flex flex-wrap gap-2"><Input aria-label={`Upload ${q.documentLabel || q.label}`} type="file" name="file" required accept="application/pdf,image/png,image/jpeg" disabled={!!uploading} className="max-w-xs" /><Button type="submit" variant="outline" disabled={!!uploading || pending > 0}>{uploading === q.questionId ? `Uploading ${uploadProgress}%…` : "Upload document"}</Button></form>}
      </CardContent>
    </Card>)}
    {locked && <p className="text-sm text-muted-foreground">This booking has no upcoming sessions or has been cancelled, so its information can no longer be changed.</p>}
  </div>;
}
