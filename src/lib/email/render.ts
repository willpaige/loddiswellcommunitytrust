function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Render text templates safely, making form and sign-in destinations clickable
// in HTML clients instead of depending on each client to auto-detect URLs.
export function renderBodyTextAsHtml(body: string) {
  return body.split(/\n{2,}/).map(paragraph => {
    const parts = paragraph.trim().split(/(https?:\/\/[^\s<>]+)/g);
    const html = parts.map((part, index) => index % 2
      ? `<a href="${escapeHtml(part)}">${escapeHtml(part)}</a>`
      : escapeHtml(part).replace(/\n/g, "<br>")) .join("");
    return html ? `<p>${html}</p>` : "";
  }).join("");
}
