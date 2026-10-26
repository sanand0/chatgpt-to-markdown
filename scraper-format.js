/** Markdown primitives shared by the archive converters and their browser bookmarklets. */
export const yamlEscape = (value) =>
  String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ");

/** Exports have UTC timestamps; the browser bookmarklets use browser-local offsets. */
export function isoDate(value) {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric = Number(value);
  const date = new Date(Number.isFinite(numeric) ? numeric * (Math.abs(numeric) < 1e12 ? 1000 : 1) : value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function frontmatter(title, date, source) {
  return `---\ntitle: "${yamlEscape(title)}"\n${date ? `date: ${date}\n` : ""}source: "${yamlEscape(source)}"\n---\n\n`;
}

export function codeFence(value, language = "") {
  const code = String(value ?? "").replace(/\n+$/, "");
  const runs = [...code.matchAll(/`+/g)].map((match) => match[0].length);
  const tick = "`".repeat(Math.max(3, ...runs.map((length) => length + 1)));
  return `${tick}${String(language || "").toLowerCase()}\n${code}\n${tick}`;
}

export function details(summary, body) {
  return `<details>\n<summary>${String(summary ?? "").replace(/\n/g, " ")}</summary>\n\n${body.trim()}\n\n</details>`;
}
