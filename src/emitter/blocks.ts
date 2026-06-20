type Str = string;

export function emitBracedBlock(header: Str, body: Str[], footer: Str = "}"): Str {
  return [header, ...body.map(indentLine), footer].join("\n  ");
}

export function emitIfElseBlock(header: Str, thenBody: Str[], elseBody: Str[]): Str {
  return [header, ...thenBody.map(indentLine), "} else {", ...elseBody.map(indentLine), "}"].join(
    "\n  ",
  );
}

function indentLine(line: Str): Str {
  return `  ${line}`;
}
