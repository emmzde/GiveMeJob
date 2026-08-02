type DescriptionBlock =
  | { kind: "heading"; text: string }
  | { items: string[]; kind: "list" }
  | { kind: "note"; text: string }
  | { kind: "paragraph"; text: string };

const listMarker = /^(?:[-*•]|\d+[.)])\s+/u;
const noteMarker = /^(?:NOTE|Примечание)\s*:\s*/iu;

function sentenceBlocks(text: string): DescriptionBlock[] {
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-ZА-ЯЁ])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (text.length > 240 && sentences.length >= 3) {
    return [
      { kind: "paragraph", text: sentences[0]! },
      { items: sentences.slice(1), kind: "list" },
    ];
  }
  return [{ kind: "paragraph", text }];
}

export function parseJobDescription(description: string): DescriptionBlock[] {
  const chunks = description
    .replace(/\r\n?/gu, "\n")
    .split(/\n{2,}/u)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.flatMap((chunk): DescriptionBlock[] => {
    if (noteMarker.test(chunk)) {
      return [{ kind: "note", text: chunk.replace(noteMarker, "").trim() }];
    }

    const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.every((line) => listMarker.test(line))) {
      return [{ items: lines.map((line) => line.replace(listMarker, "")), kind: "list" }];
    }

    if (lines.length >= 3) {
      const [first, ...rest] = lines;
      return [
        first && (first.endsWith(":") || (first.length < 70 && !/[.!?]$/u.test(first)))
          ? { kind: "heading", text: first.replace(/:$/u, "") }
          : { kind: "paragraph", text: first ?? "" },
        { items: rest.map((line) => line.replace(listMarker, "")), kind: "list" },
      ];
    }

    return sentenceBlocks(lines.join(" "));
  });
}
