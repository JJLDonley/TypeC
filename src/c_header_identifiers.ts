import { keywords, primitiveTypes } from "./token.ts";

type Str = string;
type b8 = boolean;
type usize = number;

export function isTypeCIdentifier(name: Str): b8 {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !keywords.has(name) && !primitiveTypes.has(name);
}

export function sanitizeHeaderParamName(name: Str): Str {
  const replaced = name.replace(/[^A-Za-z0-9_]/g, "_");
  const prefixed = /^[A-Za-z_]/.test(replaced) ? replaced : `arg_${replaced}`;
  if (!isTypeCIdentifier(prefixed)) return `arg_${prefixed}`;
  return prefixed;
}

export function uniqueHeaderParamName(name: Str, names: Set<Str>): Str {
  if (!names.has(name)) {
    names.add(name);
    return name;
  }
  let index: usize = 1;
  while (names.has(`${name}_${index}`)) index += 1;
  const unique = `${name}_${index}`;
  names.add(unique);
  return unique;
}
