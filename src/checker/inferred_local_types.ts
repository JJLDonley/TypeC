import { LOCAL_TYPE_INFERENCE } from "core/diagnostic_codes.ts";
import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { optionalTypeNameElement, parseFunctionTypeName } from "checker/type_name_shapes.ts";

export type Str = string;
type b8 = boolean;

const INFERABLE_PRIMITIVES = new Set<Str>([
  "i8",
  "i16",
  "i32",
  "i64",
  "u8",
  "u16",
  "u32",
  "u64",
  "usize",
  "f32",
  "f64",
  "b8",
  "bool",
]);

export interface InferredLocalTypeCheck {
  diagnostics: Diagnostic[];
  inferable: b8;
}

export function checkInferredLocalType(type: TypeName, span: SourceSpan): InferredLocalTypeCheck {
  if (isInferableLocalType(type)) return { diagnostics: [], inferable: true };
  return {
    diagnostics: [{
      message: `Cannot infer local variable type '${type}' without an annotation`,
      code: LOCAL_TYPE_INFERENCE,
      span,
    }],
    inferable: false,
  };
}

export function normalizeInferredLocalType(type: TypeName): TypeName {
  return type === "bool" ? "b8" : type;
}

function isInferableLocalType(type: TypeName): b8 {
  if (INFERABLE_PRIMITIVES.has(type)) return true;
  if (parseFunctionTypeName(type) !== null) return true;
  if (isInferableOptionalType(type)) return true;
  return isIdentifierTypeName(type);
}

function isInferableOptionalType(type: TypeName): b8 {
  const element = optionalTypeNameElement(type);
  if (element === null) return false;
  return isInferableLocalType(element);
}

function isIdentifierTypeName(type: TypeName): b8 {
  if (type.length === 0) return false;
  for (const unit of type) {
    if (isIdentifierUnit(unit)) continue;
    return false;
  }
  return true;
}

function isIdentifierUnit(unit: Str): b8 {
  return (unit >= "A" && unit <= "Z") ||
    (unit >= "a" && unit <= "z") ||
    (unit >= "0" && unit <= "9") ||
    unit === "_";
}
