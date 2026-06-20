type Str = string;
type b8 = boolean;

export type CArrayType = {
  element: Str;
  size: Str;
};

export function cArrayElementType(type: Str): Str | null {
  return cArrayType(type)?.element ?? null;
}

export function cArrayType(type: Str): CArrayType | null {
  const match = type.match(/^(.+)\[([^\]]*)\]$/);
  if (!match) return null;
  return { element: match[1], size: match[2] };
}

export function isFixedCArraySize(size: Str): b8 {
  return /^[0-9]+$/.test(size);
}
