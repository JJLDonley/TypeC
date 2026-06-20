type Str = string;

export function normalizeCHeaderType(type: Str): Str {
  return type
    .replace(/\bconst\b/g, "")
    .replace(/\bvolatile\b/g, "")
    .replace(/\brestrict\b/g, "")
    .replace(/\b__restrict\b/g, "")
    .replace(/\b__restrict__\b/g, "")
    .replace(/\b_Nonnull\b/g, "")
    .replace(/\b_Nullable\b/g, "")
    .replace(/\b_Null_unspecified\b/g, "")
    .replace(/\s*\(\s*\*\s*\)\s*/g, "(*)")
    .replace(/\s*\*\s*/g, "*")
    .replace(/\s*\[\s*/g, "[")
    .replace(/\s*\]\s*/g, "]")
    .replace(/\s+/g, " ")
    .trim();
}
