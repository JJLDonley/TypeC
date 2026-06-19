type Str = string;

export function cArrayElementType(type: Str): Str | null {
  const match = type.match(/^(.+)\[[^\]]*\]$/);
  return match?.[1] ?? null;
}
