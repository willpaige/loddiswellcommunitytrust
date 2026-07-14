import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bookingRequirementDocuments,
  bookingRequirementResponses,
  bookings,
  requirementQuestions,
} from "@/lib/db/schema";

export type RequirementDocument = {
  id: string;
  fileUrl: string;
  fileName: string;
  uploadedAt: Date;
};

export type RequirementQuestionState = {
  questionId: string;
  label: string;
  type: "yes_no" | "text";
  requiresDocumentOnYes: boolean;
  documentLabel: string | null;
  sortOrder: number;
  answerBool: boolean | null;
  answerText: string | null;
  answered: boolean;
  needsDocument: boolean;
  documents: RequirementDocument[];
};

export type BookingRequirementDetail = {
  hasRequirements: boolean;
  questionnaireComplete: boolean;
  documentsComplete: boolean;
  complete: boolean;
  questions: RequirementQuestionState[];
};

function isAnswered(question: {
  type: "yes_no" | "text";
  answerBool: boolean | null;
  answerText: string | null;
}) {
  if (question.type === "text") return Boolean(question.answerText && question.answerText.trim());
  return question.answerBool !== null && question.answerBool !== undefined;
}

// A document is only required for a yes/no question flagged to require one when
// the customer has actually answered "yes".
function needsDocument(question: {
  type: "yes_no" | "text";
  requiresDocumentOnYes: boolean;
  answerBool: boolean | null;
}) {
  return question.type === "yes_no" && question.requiresDocumentOnYes && question.answerBool === true;
}

const EMPTY: BookingRequirementDetail = {
  hasRequirements: false,
  questionnaireComplete: true,
  documentsComplete: true,
  complete: true,
  questions: [],
};

// Full per-question detail for a single booking. Resolves the booking's
// snapshotted requirement set; safe to call when requirementSetId is null.
export async function getBookingRequirementDetail(
  bookingId: string,
  requirementSetId: string | null
): Promise<BookingRequirementDetail> {
  if (!requirementSetId) return EMPTY;

  const [questions, responses, documents] = await Promise.all([
    db
      .select()
      .from(requirementQuestions)
      .where(and(eq(requirementQuestions.setId, requirementSetId), eq(requirementQuestions.active, true)))
      .orderBy(requirementQuestions.sortOrder),
    db
      .select()
      .from(bookingRequirementResponses)
      .where(eq(bookingRequirementResponses.bookingId, bookingId)),
    db
      .select()
      .from(bookingRequirementDocuments)
      .where(eq(bookingRequirementDocuments.bookingId, bookingId)),
  ]);

  if (questions.length === 0) return EMPTY;

  const responseByQuestion = new Map(responses.map((r) => [r.questionId, r]));
  const docsByQuestion = new Map<string, RequirementDocument[]>();
  for (const doc of documents) {
    const list = docsByQuestion.get(doc.questionId) ?? [];
    list.push({ id: doc.id, fileUrl: doc.fileUrl, fileName: doc.fileName, uploadedAt: doc.uploadedAt });
    docsByQuestion.set(doc.questionId, list);
  }

  const states: RequirementQuestionState[] = questions.map((q) => {
    const response = responseByQuestion.get(q.id);
    const answerBool = response?.answerBool ?? null;
    const answerText = response?.answerText ?? null;
    const state = { type: q.type, answerBool, answerText, requiresDocumentOnYes: q.requiresDocumentOnYes };
    return {
      questionId: q.id,
      label: q.label,
      type: q.type,
      requiresDocumentOnYes: q.requiresDocumentOnYes,
      documentLabel: q.documentLabel,
      sortOrder: q.sortOrder,
      answerBool,
      answerText,
      answered: isAnswered(state),
      needsDocument: needsDocument(state),
      documents: docsByQuestion.get(q.id) ?? [],
    };
  });

  const questionnaireComplete = states.every((s) => s.answered);
  const documentsComplete = states.every((s) => !s.needsDocument || s.documents.length > 0);

  return {
    hasRequirements: true,
    questionnaireComplete,
    documentsComplete,
    complete: questionnaireComplete && documentsComplete,
    questions: states,
  };
}

// Batch status (booleans only) for many bookings — used by list pages and the
// chase cron. Three queries total, no per-booking round-trips.
export async function getBookingRequirementStatuses(
  bookingIds: string[]
): Promise<Map<string, { hasRequirements: boolean; complete: boolean }>> {
  const result = new Map<string, { hasRequirements: boolean; complete: boolean }>();
  if (bookingIds.length === 0) return result;

  const bookingRows = await db
    .select({ id: bookings.id, requirementSetId: bookings.requirementSetId })
    .from(bookings)
    .where(inArray(bookings.id, bookingIds));

  for (const id of bookingIds) result.set(id, { hasRequirements: false, complete: true });

  const setIds = Array.from(
    new Set(bookingRows.map((b) => b.requirementSetId).filter((id): id is string => Boolean(id)))
  );
  if (setIds.length === 0) return result;

  const withSet = bookingRows.filter((b) => b.requirementSetId);
  const ids = withSet.map((b) => b.id);

  const [questions, responses, documents] = await Promise.all([
    db
      .select()
      .from(requirementQuestions)
      .where(and(inArray(requirementQuestions.setId, setIds), eq(requirementQuestions.active, true))),
    db
      .select()
      .from(bookingRequirementResponses)
      .where(inArray(bookingRequirementResponses.bookingId, ids)),
    db
      .select()
      .from(bookingRequirementDocuments)
      .where(inArray(bookingRequirementDocuments.bookingId, ids)),
  ]);

  const questionsBySet = new Map<string, typeof questions>();
  for (const q of questions) {
    const list = questionsBySet.get(q.setId) ?? [];
    list.push(q);
    questionsBySet.set(q.setId, list);
  }
  const responsesByBookingQuestion = new Map<string, (typeof responses)[number]>();
  for (const r of responses) responsesByBookingQuestion.set(`${r.bookingId}:${r.questionId}`, r);
  const docCount = new Map<string, number>();
  for (const d of documents) {
    const key = `${d.bookingId}:${d.questionId}`;
    docCount.set(key, (docCount.get(key) ?? 0) + 1);
  }

  for (const booking of withSet) {
    const setQuestions = questionsBySet.get(booking.requirementSetId!) ?? [];
    if (setQuestions.length === 0) {
      result.set(booking.id, { hasRequirements: false, complete: true });
      continue;
    }
    let complete = true;
    for (const q of setQuestions) {
      const response = responsesByBookingQuestion.get(`${booking.id}:${q.id}`);
      const answerBool = response?.answerBool ?? null;
      const answerText = response?.answerText ?? null;
      const answered = isAnswered({ type: q.type, answerBool, answerText });
      const requiresDoc = needsDocument({ type: q.type, requiresDocumentOnYes: q.requiresDocumentOnYes, answerBool });
      if (!answered || (requiresDoc && (docCount.get(`${booking.id}:${q.id}`) ?? 0) === 0)) {
        complete = false;
        break;
      }
    }
    result.set(booking.id, { hasRequirements: true, complete });
  }

  return result;
}
