type Str = string;
type b8 = boolean;

export interface JsonRecord {
  [key: Str]: unknown;
}

export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
