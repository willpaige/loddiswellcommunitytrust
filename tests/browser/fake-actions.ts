import type { BookingRequirementDetail } from '@/lib/booking-requirements';
declare global { interface Window { failNextSave: boolean; failNextUpload: boolean; uploadedBytes: number; } }
const empty: BookingRequirementDetail = { hasRequirements: true, questionnaireComplete: false, documentsComplete: true, complete: false, questions: [
  { questionId: 'insurance', label: 'Insurance needed?', type: 'yes_no', requiresDocumentOnYes: true, documentLabel: 'Insurance document', sortOrder: 0, answerBool: null, answerText: null, answered: false, needsDocument: false, documents: [] },
  { questionId: 'purpose', label: 'Purpose', type: 'text', requiresDocumentOnYes: false, documentLabel: null, sortOrder: 1, answerBool: null, answerText: null, answered: false, needsDocument: false, documents: [] },
] };
let detail: BookingRequirementDetail = JSON.parse(localStorage.getItem('requirements') || JSON.stringify(empty));
export const initialDetail = structuredClone(detail);
function persist() {
  for (const q of detail.questions) { q.answered = q.type === 'yes_no' ? q.answerBool !== null : !!q.answerText?.trim(); q.needsDocument = q.requiresDocumentOnYes && q.answerBool === true; }
  detail.questionnaireComplete = detail.questions.every(q => q.answered);
  detail.documentsComplete = detail.questions.every(q => !q.needsDocument || !!q.documents.length);
  detail.complete = detail.questionnaireComplete && detail.documentsComplete;
  localStorage.setItem('requirements', JSON.stringify(detail)); return structuredClone(detail);
}
export async function saveRequirementAnswers(form: FormData) {
  await new Promise(resolve => setTimeout(resolve, 30));
  if (window.failNextSave) { window.failNextSave = false; throw new Error('offline'); }
  for (const q of detail.questions) if (form.has(`answer_${q.questionId}`)) {
    const value = String(form.get(`answer_${q.questionId}`));
    if (q.type === 'yes_no') q.answerBool = value === 'yes' ? true : value === 'no' ? false : null;
    else q.answerText = value.trim();
  }
  return persist();
}
export async function uploadRequirementDocument(form: FormData) {
  const q = detail.questions.find(q => q.questionId === form.get('questionId'))!;
  q.documents.push({ id: 'doc', fileUrl: String(form.get('url')), fileName: String(form.get('fileName')), uploadedAt: new Date() }); return persist();
}
export async function deleteRequirementDocument() { detail.questions.forEach(q => q.documents = []); return persist(); }
