type Str = string;
type b8 = boolean;
type usize = number;

export function stripHeaderTrailingComment(text: Str): Str {
  const index = trailingHeaderCommentIndex(text);
  if (index === null) return text.trimEnd();
  return text.slice(0, index).trimEnd();
}

function trailingHeaderCommentIndex(text: Str): usize | null {
  let quoted: b8 = false;
  for (let index: usize = 0; index < text.length - 1; index += 1) {
    quoted = nextQuotedState(quoted, text[index]);
    if (quoted || text[index] !== "/") continue;
    if (startsHeaderComment(text, index)) return index;
  }
  return null;
}

function nextQuotedState(quoted: b8, char: Str): b8 {
  if (char !== '"') return quoted;
  return !quoted;
}

function startsHeaderComment(text: Str, index: usize): b8 {
  const next = text[index + 1];
  return next === "/" || next === "*";
}
