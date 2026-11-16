// The HTML side of every email. Template bodies stay plain text that trustees
// edit in the admin; this file turns that text into a designed email:
//
//   "Label: value" lines        → a details panel
//   "Heading:" + lines           → a titled panel (amber for access info)
//   "Short heading" + lines      → a subheading with the lines under it
//   "1st ..." / "2nd ..." lines  → a winners list
//   a link on its own line       → a button, labelled for its job
//   the unsubscribe paragraph    → moved into the footer
//
// Structured extras (raffle artwork, facts, prizes, ticket numbers) come from
// the sender, since they don't exist in the text. The plain-text body is still
// sent alongside as the TextBody, unchanged.
//
// Email clients ignore most CSS, so this is tables and inline styles. Dark mode
// colours are classes overridden in a prefers-color-scheme block, which Apple
// Mail, iOS Mail and Outlook for Mac honour; other clients keep the light look.

export type EmailFact = { value: string; label: string };
export type EmailPrize = { rank: string; title: string; description?: string };
export type EmailPromoCard = { eyebrow: string; title: string; text: string; url: string; imageUrl?: string | null };

export type EmailExtras = {
  /** Inbox preview text. */
  preheader?: string;
  eyebrow?: string;
  headline?: string;
  hero?: { src: string; alt: string; href?: string };
  /** Shown as chips under the headline, e.g. ticket numbers. */
  chips?: string[];
  /** Up to three short facts in boxes, shown before the call to action. */
  facts?: EmailFact[];
  /** The main button. A body paragraph that is just this URL is dropped. */
  cta?: { label: string; url: string };
  prizes?: EmailPrize[];
  /** A tinted closing band inside the card. */
  closing?: { strong: string; text?: string };
  promo?: EmailPromoCard | null;
};

export type RenderEmailInput = {
  body: string;
  variables: Record<string, string | number | null | undefined>;
  extras?: EmailExtras;
  /** Button label for a URL that came from the named variable. */
  buttonLabel?: (variable: string) => string | undefined;
  appUrl: string;
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const C = {
  page: "#eef1e9",
  card: "#ffffff",
  border: "#dfe5d8",
  text: "#26301f",
  muted: "#6f7868",
  head: "#1f3312",
  eyebrow: "#9a5d12",
  panel: "#f3f6ef",
  panelBorder: "#e1e8d9",
  note: "#fdf6e6",
  noteBorder: "#f1dfb4",
  chipBorder: "#d29a3a",
  chipText: "#7a4a0e",
  button: "#2d5016",
  link: "#2d5016",
};

const DARK_CSS = `@media (prefers-color-scheme: dark){
  .bg{background:#121811!important}
  .card{background:#1b2219!important;border-color:#2c3628!important}
  .tx{color:#e4e9dd!important}
  .mu{color:#9aa592!important}
  .hd{color:#f2f5ee!important}
  .ey{color:#e3b45c!important}
  .panel{background:#232c20!important;border-color:#2f3a2b!important}
  .note{background:#2b2617!important;border-color:#4a3f1f!important}
  .rule{border-color:#2c3628!important}
  .btn{background:#5f9a36!important}
  .lk{color:#a9d27e!important}
  .chip{background:#2b2617!important;border-color:#a8813a!important;color:#f0d9a6!important}
  .logo-l{display:none!important}
  .logo-d{display:block!important;max-height:none!important;overflow:visible!important}
}`;

export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const URL_RE = /(https?:\/\/[^\s<>]+)/g;
const ONLY_URL_RE = /^https?:\/\/\S+$/;
const HAS_URL_RE = /https?:\/\//;
const PAIR_RE = /^([A-Z][A-Za-z ()'’/&-]{0,22}):\s+(\S.{0,90})$/;
const RANK_RE = /^(\d+(?:st|nd|rd|th))\b\s*(?:prize)?\s*[:·,-]?\s*(.+)$/i;

/** "https://site.org/raffles/x?y=1" → "site.org/raffles/x". */
function shortUrl(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "");
}

function absolute(url: string, appUrl: string) {
  return /^https?:\/\//.test(url) ? url : `${appUrl.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
}

// ---------- Components ----------

function text(t: string, size = 16, extra = "") {
  return `<p class="tx" style="margin:0 0 16px;font-family:${FONT};font-size:${size}px;line-height:1.6;color:${C.text};${extra}">${t}</p>`;
}

function eyebrow(t: string) {
  return `<p class="ey" style="margin:0 0 8px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${C.eyebrow};">${escapeHtml(t)}</p>`;
}

function headline(t: string) {
  return `<h1 class="hd h1" style="margin:0 0 16px;font-family:${SERIF};font-size:30px;line-height:1.15;font-weight:700;color:${C.head};">${escapeHtml(t)}</h1>`;
}

function subheading(t: string) {
  return `<h2 class="hd" style="margin:8px 0 10px;font-family:${SERIF};font-size:19px;line-height:1.3;font-weight:700;color:${C.head};">${escapeHtml(t)}</h2>`;
}

export function button(label: string, url: string, full = false) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" ${full ? 'width="100%"' : ""} style="margin:6px 0 22px;"><tr>
<td class="btn" align="center" style="background:${C.button};border-radius:10px;">
<a href="${escapeHtml(url)}" style="display:block;padding:15px 28px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function details(rows: [string, string][]) {
  const last = rows.length - 1;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="panel" style="background:${C.panel};border:1px solid ${C.panelBorder};border-radius:10px;margin:4px 0 20px;">
${rows
  .map(
    ([k, v], i) => `<tr><td class="mu" valign="top" style="padding:${i ? 7 : 15}px 0 ${i === last ? 15 : 7}px 18px;width:118px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${k}</td>
<td class="tx" valign="top" style="padding:${i ? 7 : 15}px 18px ${i === last ? 15 : 7}px 8px;font-family:${FONT};font-size:15px;line-height:1.5;font-weight:600;color:${C.text};">${v}</td></tr>`
  )
  .join("")}
</table>`;
}

function titledPanel(title: string, inner: string, tone: "plain" | "amber") {
  const amber = tone === "amber";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="${amber ? "note" : "panel"}" style="background:${amber ? C.note : C.panel};border:1px solid ${amber ? C.noteBorder : C.panelBorder};border-radius:10px;margin:4px 0 20px;"><tr><td style="padding:15px 18px 1px;">
<p class="ey" style="margin:0 0 6px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.eyebrow};">${escapeHtml(title)}</p>
${inner}</td></tr></table>`;
}

function rankedList(rows: [string, string][]) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 20px;">
${rows
  .map(
    ([rank, rest]) => `<tr><td valign="top" width="52" style="padding:0 12px 12px 0;width:52px;"><div class="chip" style="width:44px;height:44px;line-height:44px;text-align:center;border-radius:50%;background:${C.note};border:1.5px solid ${C.chipBorder};font-family:${SERIF};font-weight:700;font-size:15px;color:${C.chipText};">${escapeHtml(rank)}</div></td>
<td valign="middle" class="tx" style="padding:0 0 12px;font-family:${FONT};font-size:15px;line-height:1.5;color:${C.text};">${rest}</td></tr>`
  )
  .join("")}
</table>`;
}

function chips(values: string[]) {
  // Wraps naturally: each chip is an inline-block, so long runs flow onto
  // more lines on a phone instead of forcing the email wider.
  return `<div style="margin:2px 0 18px;font-size:0;line-height:0;">${values
    .map(
      (v) => `<span class="chip" style="display:inline-block;margin:0 8px 8px 0;padding:9px 14px;border:1.5px dashed ${C.chipBorder};border-radius:8px;background:${C.note};font-family:${SERIF};font-size:19px;line-height:1.2;font-weight:700;color:${C.chipText};letter-spacing:.02em;">${escapeHtml(v)}</span>`
    )
    .join("")}</div>`;
}

function facts(items: EmailFact[]) {
  const width = Math.floor(100 / items.length);
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 14px;"><tr>
${items
  .map(
    (f) => `<td class="stack stack-gap" width="${width}%" valign="top" style="padding:0 5px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="panel" style="background:${C.panel};border:1px solid ${C.panelBorder};border-radius:10px;"><tr><td style="padding:14px 14px 13px;">
<p class="hd" style="margin:0 0 3px;font-family:${SERIF};font-size:20px;line-height:1.2;font-weight:700;color:${C.head};">${escapeHtml(f.value)}</p>
<p class="mu" style="margin:0;font-family:${FONT};font-size:13px;line-height:1.4;color:${C.muted};">${escapeHtml(f.label)}</p></td></tr></table></td>`
  )
  .join("")}
</tr></table>`;
}

function prizes(list: EmailPrize[]) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="rule" style="border-top:1px solid #e6ebe0;"><tr><td style="padding-top:22px;">
${subheading(list.length === 1 ? "The prize" : "The prizes")}
${rankedList(
  list.map((p) => [
    p.rank,
    `<strong style="display:block;font-size:16px;margin-bottom:2px;">${escapeHtml(p.title)}</strong>${p.description ? `<span class="mu" style="color:${C.muted};font-size:14px;">${escapeHtml(p.description)}</span>` : ""}`,
  ])
)}
</td></tr></table>`;
}

function promoCard(promo: EmailPromoCard, appUrl: string) {
  const image = promo.imageUrl
    ? `<td width="120" valign="middle" style="width:120px;"><a href="${escapeHtml(promo.url)}"><img src="${escapeHtml(absolute(promo.imageUrl, appUrl))}" width="120" alt="" style="display:block;width:120px;height:auto;border:0;"></a></td>`
    : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="rule" style="border:1px solid #e6ebe0;border-radius:10px;overflow:hidden;margin:8px 0 20px;"><tr>
${image}
<td valign="middle" style="padding:12px 16px;">
<p class="ey" style="margin:0 0 2px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.eyebrow};">${escapeHtml(promo.eyebrow)}</p>
<p class="tx" style="margin:0;font-family:${FONT};font-size:14px;line-height:1.45;color:${C.text};"><a class="lk" href="${escapeHtml(promo.url)}" style="color:${C.link};font-weight:700;text-decoration:none;">${escapeHtml(promo.title)}</a>. ${escapeHtml(promo.text)}</p>
</td></tr></table>`;
}

// ---------- Body text → HTML ----------

type Ctx = RenderEmailInput & { urlVars: Map<string, string>; unsubscribeUrl?: string };

function inline(line: string, ctx: Ctx) {
  const html = line
    .split(URL_RE)
    .map((part, i) => {
      if (i % 2 === 0) return escapeHtml(part);
      const label = part === ctx.unsubscribeUrl ? "unsubscribe" : shortUrl(part);
      return `<a class="lk" href="${escapeHtml(part)}" style="color:${C.link};text-decoration:underline;">${escapeHtml(label)}</a>`;
    })
    .join("");
  // "Unsubscribe: <link>" reads better as a single "Unsubscribe" link.
  return html.replace(/Unsubscribe:\s*(<a [^>]*>)unsubscribe<\/a>/i, "$1Unsubscribe</a>");
}

function pairs(line: string): [string, string][] | null {
  const parts = line.split(" · ");
  const out: [string, string][] = [];
  for (const part of parts) {
    const m = part.match(PAIR_RE);
    if (!m || m[2].startsWith("//")) return null;
    out.push([m[1], m[2]]);
  }
  return out;
}

/** Lines in order: runs of label/value lines become a panel, the rest text. */
function renderLines(lines: string[], ctx: Ctx, hideRow?: RegExp): string {
  if (lines.length > 0 && lines.every((l) => RANK_RE.test(l))) {
    return rankedList(lines.map((l) => {
      const m = l.match(RANK_RE)!;
      return [m[1].toLowerCase(), inline(m[2], ctx)];
    }));
  }
  const out: string[] = [];
  let rows: [string, string][] = [];
  let prose: string[] = [];
  const flushRows = () => {
    const shown = rows.filter(([k]) => !hideRow?.test(k));
    if (shown.length) out.push(details(shown.map(([k, v]) => [escapeHtml(k), inline(v, ctx)])));
    rows = [];
  };
  const flushProse = () => {
    if (prose.length) out.push(text(prose.map((l) => (l.startsWith("- ") ? `•&nbsp;${inline(l.slice(2), ctx)}` : inline(l, ctx))).join("<br>")));
    prose = [];
  };
  for (const line of lines) {
    const p = pairs(line);
    if (p) {
      flushProse();
      rows.push(...p);
    } else {
      flushRows();
      prose.push(line);
    }
  }
  flushRows();
  flushProse();
  return out.join("");
}

function isShortHeading(line: string) {
  return line.length <= 34 && /^[A-Z]/.test(line) && !/[.,!?;:]$/.test(line) && !HAS_URL_RE.test(line) && !PAIR_RE.test(line);
}

export function renderBody(ctx: Ctx, hideRow?: RegExp) {
  const { body, variables, extras } = ctx;
  const footerNotes: string[] = [];
  const blocks: string[] = [];
  const promoText = typeof variables.rafflePromo === "string" ? variables.rafflePromo.trim() : "";
  const smallPrint = typeof variables.smallPrint === "string" ? variables.smallPrint.trim() : "";

  for (const raw of body.split(/\n{2,}/)) {
    const para = raw.trim();
    if (!para) continue;

    if (ctx.unsubscribeUrl && para.includes(ctx.unsubscribeUrl) && !para.includes("\n")) {
      footerNotes.push(inline(para, ctx));
      continue;
    }
    if (ONLY_URL_RE.test(para)) {
      if (para === extras?.cta?.url) continue;
      const variable = ctx.urlVars.get(para);
      blocks.push(button((variable && ctx.buttonLabel?.(variable)) || "Open link", para));
      continue;
    }
    // The promo card is drawn after the main button instead.
    if (promoText && para === promoText && extras?.promo) continue;
    if (smallPrint && para === smallPrint) {
      blocks.push(text(inline(para, ctx), 13, `color:${C.muted};`).replace('class="tx"', 'class="mu"'));
      continue;
    }

    const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
    const [first, ...rest] = lines;
    if (rest.length && /^[A-Z][^:]{0,40}:$/.test(first)) {
      blocks.push(titledPanel(first.slice(0, -1), renderLines(rest, ctx, hideRow), /access/i.test(first) ? "amber" : "plain"));
      continue;
    }
    if (rest.length && isShortHeading(first)) {
      blocks.push(subheading(first) + renderLines(rest, ctx, hideRow));
      continue;
    }
    blocks.push(renderLines(lines, ctx, hideRow));
  }
  return { html: blocks.join("\n"), footerNotes };
}

// ---------- The whole email ----------

export function renderEmailHtml(input: RenderEmailInput) {
  const { extras = {}, variables, appUrl } = input;
  const urlVars = new Map<string, string>();
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === "string" && ONLY_URL_RE.test(value.trim())) urlVars.set(value.trim(), key);
  }
  const unsubscribeUrl = typeof variables.unsubscribeUrl === "string" && variables.unsubscribeUrl ? variables.unsubscribeUrl : undefined;
  const ctx: Ctx = { ...input, urlVars, unsubscribeUrl };
  const { html: bodyHtml, footerNotes } = renderBody(ctx, extras.chips?.length ? /ticket numbers?/i : undefined);
  const site = appUrl.replace(/\/$/, "");
  const pad = "padding-left:36px;padding-right:36px;";

  const hero = extras.hero
    ? `<a href="${escapeHtml(extras.hero.href ?? site)}"><img src="${escapeHtml(absolute(extras.hero.src, appUrl))}" width="600" alt="${escapeHtml(extras.hero.alt)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></a>`
    : "";

  const inner = `${hero}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td class="pad" style="${pad}padding-top:${hero ? 28 : 34}px;padding-bottom:8px;">
${extras.eyebrow ? eyebrow(extras.eyebrow) : ""}
${extras.headline ? headline(extras.headline) : ""}
${extras.chips?.length ? chips(extras.chips) : ""}
${bodyHtml}
</td></tr>
${extras.facts?.length ? `<tr><td class="pad" style="padding:0 31px 4px;">${facts(extras.facts)}</td></tr>` : ""}
${extras.cta ? `<tr><td class="pad" style="${pad}">${button(extras.cta.label, extras.cta.url, !!extras.facts?.length)}</td></tr>` : ""}
${extras.prizes?.length ? `<tr><td class="pad" style="${pad}padding-bottom:12px;">${prizes(extras.prizes)}</td></tr>` : ""}
${extras.promo ? `<tr><td class="pad" style="${pad}padding-bottom:16px;">${promoCard(extras.promo, appUrl)}</td></tr>` : ""}
${
  extras.closing
    ? `<tr><td class="pad panel" style="${pad}padding-top:20px;padding-bottom:20px;background:${C.panel};border-top:1px solid ${C.panelBorder};">
<p class="tx" style="margin:0;font-family:${FONT};font-size:14px;line-height:1.55;color:${C.text};"><strong>${escapeHtml(extras.closing.strong)}</strong>${extras.closing.text ? ` <span class="mu" style="color:${C.muted};">${escapeHtml(extras.closing.text)}</span>` : ""}</p></td></tr>`
    : `<tr><td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>`
}
</table>`;

  const footer = `<strong style="font-weight:600;">Loddiswell Playing Fields &amp; Village Hall Trust</strong><br>
The Village Hall, South Brent Road, Loddiswell, Kingsbridge TQ7 4RH<br>
<a class="lk" href="${escapeHtml(site)}" style="color:${C.link};text-decoration:underline;">${escapeHtml(shortUrl(site))}</a> · Questions? Just reply to this email.${footerNotes.map((n) => `<br><br>${n}`).join("")}`;

  const preheader = extras.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(extras.preheader)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<style>
  body{margin:0;padding:0}
  .logo-d{display:none;max-height:0;overflow:hidden}
  @media (max-width:600px){
    .pad{padding-left:22px!important;padding-right:22px!important}
    .stack{display:block!important;width:100%!important;box-sizing:border-box}
    .stack-gap{padding:0 0 10px 0!important}
    .h1{font-size:26px!important}
  }
  ${DARK_CSS}
</style></head>
<body class="bg" style="margin:0;background:${C.page};">
${preheader}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="bg" style="background:${C.page};">
<tr><td align="center" style="padding:28px 12px 40px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
<tr><td style="padding:0 4px 18px;">
<a href="${escapeHtml(site)}"><img class="logo-l" src="${site}/loddiswell-community-trust-logo.png" width="190" alt="Loddiswell Community Trust" style="display:block;width:190px;height:auto;border:0;"><img class="logo-d" src="${site}/loddiswell-community-trust-logo-light.png" width="190" alt="" style="width:190px;height:auto;border:0;"></a>
</td></tr>
<tr><td class="card" style="background:${C.card};border:1px solid ${C.border};border-radius:14px;overflow:hidden;">
${inner}
</td></tr>
<tr><td class="mu" style="padding:22px 8px 0;font-family:${FONT};font-size:12.5px;line-height:1.6;color:${C.muted};">
${footer}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
