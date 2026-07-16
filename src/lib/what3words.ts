export function formatWhat3words(value: string | null | undefined) {
  if (!value) return null;

  const words = value.trim().replace(/^\/{3}/, "");
  const parts = words.split(".");
  if (parts.length !== 3 || parts.some((part) => !part) || /[\s/]/.test(words)) {
    return null;
  }

  return {
    label: `///${words}`,
    url: `https://what3words.com/${encodeURIComponent(words)}`,
  };
}
