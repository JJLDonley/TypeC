type Str = string;
type u16 = number;

export function emitCStringLiteral(text: Str): Str {
  return `"${escapeCStringText(text)}"`;
}

export function emitCStringPointer(text: Str): Str {
  return `(u8*)${emitCStringLiteral(text)}`;
}

export function emitCStringVoidPointer(text: Str): Str {
  return `(void*)${emitCStringLiteral(text)}`;
}

function escapeCStringText(text: Str): Str {
  let escaped = "";
  for (const ch of text) escaped += escapeCStringChar(ch);
  return escaped;
}

function escapeCStringChar(ch: Str): Str {
  switch (ch) {
    case "\\":
      return "\\\\";
    case '"':
      return '\\"';
    case "\n":
      return "\\n";
    case "\r":
      return "\\r";
    case "\t":
      return "\\t";
  }
  return escapePrintableChar(ch);
}

function escapePrintableChar(ch: Str): Str {
  const code: u16 = ch.charCodeAt(0);
  if (code >= 32 && code <= 126) return ch;
  return `\\x${code.toString(16).padStart(2, "0")}`;
}
