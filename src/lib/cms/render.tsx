import { Fragment, type ReactNode } from "react";

export type TiptapMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type TiptapNode = {
  type: string;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
  attrs?: Record<string, unknown>;
};

export type TiptapJSON = TiptapNode;

function applyMarks(text: string, marks: TiptapMark[] | undefined, key: number): ReactNode {
  if (!marks || marks.length === 0) return text;
  return marks.reduce<ReactNode>((acc, mark, i) => {
    const k = `${key}-${i}`;
    switch (mark.type) {
      case "bold":
        return <strong key={k}>{acc}</strong>;
      case "italic":
        return <em key={k}>{acc}</em>;
      case "strike":
        return <s key={k}>{acc}</s>;
      case "code":
        return <code key={k}>{acc}</code>;
      case "underline":
        return <u key={k}>{acc}</u>;
      case "link": {
        const href = (mark.attrs?.href as string) ?? "#";
        const isExternal = /^https?:/i.test(href);
        return (
          <a
            key={k}
            href={href}
            {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="text-copper-600 hover:text-copper-700"
          >
            {acc}
          </a>
        );
      }
      default:
        return acc;
    }
  }, text);
}

function renderNode(node: TiptapNode, key: number): ReactNode {
  switch (node.type) {
    case "doc":
      return (
        <Fragment key={key}>
          {(node.content ?? []).map((child, i) => renderNode(child, i))}
        </Fragment>
      );
    case "paragraph":
      if (!node.content || node.content.length === 0) return null;
      return <p key={key}>{node.content.map((c, i) => renderNode(c, i))}</p>;
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 2), 1), 6);
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      const cls =
        level === 2
          ? "font-serif text-xl mb-3 mt-0 text-foreground"
          : level === 3
            ? "font-serif text-lg mb-2 mt-4 text-foreground"
            : "font-serif mb-2 mt-4 text-foreground";
      return (
        <Tag key={key} className={cls}>
          {(node.content ?? []).map((c, i) => renderNode(c, i))}
        </Tag>
      );
    }
    case "bulletList":
      return (
        <ul key={key} className="list-disc list-inside space-y-2 mt-3">
          {(node.content ?? []).map((c, i) => renderNode(c, i))}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="list-decimal list-inside space-y-2 mt-3">
          {(node.content ?? []).map((c, i) => renderNode(c, i))}
        </ol>
      );
    case "listItem": {
      // Tiptap wraps li children in <p>. Unwrap so list-inside numbering looks right.
      const children = node.content ?? [];
      if (
        children.length === 1 &&
        children[0].type === "paragraph" &&
        children[0].content
      ) {
        return (
          <li key={key}>
            {children[0].content.map((c, i) => renderNode(c, i))}
          </li>
        );
      }
      return <li key={key}>{children.map((c, i) => renderNode(c, i))}</li>;
    }
    case "blockquote":
      return (
        <blockquote
          key={key}
          className="border-l-4 border-border pl-4 italic"
        >
          {(node.content ?? []).map((c, i) => renderNode(c, i))}
        </blockquote>
      );
    case "horizontalRule":
      return <hr key={key} className="my-6 border-border" />;
    case "hardBreak":
      return <br key={key} />;
    case "image": {
      const src = node.attrs?.src as string | undefined;
      if (!src) return null;
      const alt = (node.attrs?.alt as string) ?? "";
      // eslint-disable-next-line @next/next/no-img-element
      return <img key={key} src={src} alt={alt} className="rounded-lg max-w-full" />;
    }
    case "text":
      return <Fragment key={key}>{applyMarks(node.text ?? "", node.marks, key)}</Fragment>;
    default:
      return null;
  }
}

function isEmptyDoc(json: TiptapJSON | undefined): boolean {
  if (!json) return true;
  if (json.type !== "doc") return false;
  const content = json.content ?? [];
  if (content.length === 0) return true;
  return content.every(
    (n) =>
      n.type === "paragraph" &&
      (!n.content ||
        n.content.length === 0 ||
        n.content.every((c) => c.type === "text" && !c.text))
  );
}

export function renderRichText(
  json: TiptapJSON | undefined,
  fallback: ReactNode = null
): ReactNode {
  if (isEmptyDoc(json)) return fallback;
  return renderNode(json as TiptapNode, 0);
}

function walkText(node: TiptapNode, out: string[]): void {
  if (node.type === "text" && typeof node.text === "string") {
    out.push(node.text);
    return;
  }
  if (node.content) {
    for (const child of node.content) walkText(child, out);
  }
}

export function renderInline(
  json: TiptapJSON | undefined,
  fallback = ""
): string {
  if (isEmptyDoc(json)) return fallback;
  const out: string[] = [];
  walkText(json as TiptapNode, out);
  const joined = out.join("").trim();
  return joined || fallback;
}

// ── Seed builders ──

export function doc(...nodes: TiptapNode[]): TiptapJSON {
  return { type: "doc", content: nodes };
}

export function paragraph(text: string, marks?: TiptapMark[]): TiptapNode {
  if (!text) return { type: "paragraph" };
  return {
    type: "paragraph",
    content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
  };
}

export function heading(level: 1 | 2 | 3 | 4 | 5 | 6, text: string): TiptapNode {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

export function bulletList(...items: string[]): TiptapNode {
  return {
    type: "bulletList",
    content: items.map((text) => ({
      type: "listItem",
      content: [paragraph(text)],
    })),
  };
}

export function inlineDoc(text: string): TiptapJSON {
  return doc(paragraph(text));
}

// Returns the plain-text contents of the first paragraph of a Tiptap doc.
// Useful for card summaries that should show just the lede.
export function firstParagraphText(
  json: TiptapJSON | undefined,
  fallback = ""
): string {
  if (!json || json.type !== "doc" || !json.content) return fallback;
  const para = json.content.find((n) => n.type === "paragraph");
  if (!para) return fallback;
  const out: string[] = [];
  walkText(para, out);
  return out.join("").trim() || fallback;
}
