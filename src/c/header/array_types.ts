type Str = string;
type b8 = boolean;

export type CArrayType = {
  element: Str;
  size: Str;
};

export type CArrayShape = {
  base: Str;
  sizes: Str[];
};

export type CPointerToArrayShape = CArrayShape;

export function cArrayElementType(type: Str): Str | null {
  return cArrayType(type)?.element ?? null;
}

export function cArrayType(type: Str): CArrayType | null {
  const shape = cArrayShape(type);
  if (shape === null) return null;
  const size = shape.sizes[0];
  const remainingSizes = shape.sizes.slice(1);
  const element = remainingSizes.length === 0
    ? shape.base
    : `${shape.base}${remainingSizes.map(arraySuffix).join("")}`;
  return { element, size };
}

export function cPointerToArrayShape(type: Str): CPointerToArrayShape | null {
  const match = type.match(/^(.+)\(\*\)((?:\[[^\]]*\])+)$/u);
  if (!match) return null;
  return cArrayShape(`${match[1]}${match[2]}`);
}

export function cArrayShape(type: Str): CArrayShape | null {
  const firstBracket = type.indexOf("[");
  if (firstBracket < 0) return null;
  const base = type.slice(0, firstBracket);
  const suffix = type.slice(firstBracket);
  const sizes = [...suffix.matchAll(/\[([^\]]*)\]/g)].map((match) => match[1]);
  if (sizes.length === 0) return null;
  if (sizes.join("").length + sizes.length * 2 !== suffix.length) return null;
  return { base, sizes };
}

export function isNestedCArrayType(type: Str): b8 {
  return (cArrayShape(type)?.sizes.length ?? 0) > 1;
}

export function isFixedCArraySize(size: Str): b8 {
  return /^[0-9]+$/.test(size);
}

export function isFullyFixedCArrayType(type: Str): b8 {
  return cArrayShape(type)?.sizes.every(isFixedCArraySize) ?? false;
}

export function typeCArrayType(base: Str, sizes: Str[]): Str {
  let type = base;
  for (let index = sizes.length - 1; index >= 0; index--) {
    type = `Array<${type}, ${sizes[index]}>`;
  }
  return type;
}

function arraySuffix(size: Str): Str {
  return `[${size}]`;
}
