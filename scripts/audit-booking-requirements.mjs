// Read-only audit. Run with: node --env-file=.env.local scripts/audit-booking-requirements.mjs
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const queries = {
  templates: `select key, enabled, body from email_templates where key in ('booking_confirmation','manual_booking_confirmation','booking_requirements_customer','booking_requirements_manager')`,
  failures: `select template_key, related_entity_id, error, created_at from email_logs where status = 'failed' and template_key like 'booking%' order by created_at`,
  requirements: `select b.id, b.status, b.start_date, b.created_at, b.requirement_set_id,
    (select min(o.start_date) from booking_occurrences o where o.booking_id=b.id and o.status='confirmed' and o.start_date > now()) as next_occurrence,
    (select count(*)::int from requirement_questions q where q.set_id=b.requirement_set_id and q.active) as questions,
    (select count(*)::int from requirement_questions q left join booking_requirement_responses r on r.question_id=q.id and r.booking_id=b.id where q.set_id=b.requirement_set_id and q.active and ((q.type='yes_no' and r.answer_bool is not null) or (q.type='text' and length(trim(r.answer_text))>0))) as answered,
    (select count(*)::int from booking_requirement_documents d where d.booking_id=b.id) as documents,
    (select json_agg(json_build_object('status',l.status,'milestone',l.related_entity_id,'date',l.created_at,'messageId',l.provider_message_id)) from email_logs l where l.template_key='booking_requirements_customer' and l.related_entity_id like b.id || ':%') as reminders
    from bookings b where b.status='confirmed' and b.requirement_set_id is not null order by b.start_date`,
  offerings: `select name, requirement_set_id from booking_offerings`,
  missingSets: `select count(*)::int from bookings b join booking_offerings o on o.id=b.offering_id where b.status='confirmed' and b.requirement_set_id is null and o.requirement_set_id is not null`,
};
for (const [name, query] of Object.entries(queries)) {
  console.log(name, JSON.stringify(await sql.query(query), null, 2));
}
