import {
  TYPE_ARRAY_SIZE,
  TYPE_POINTER_ARRAY_TARGET,
  TYPE_REFERENCE_ARRAY_TARGET,
  TYPE_REFERENCE_VOID_TARGET,
} from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeRef } from "core/ast.ts";
import { isArrayTypeRef, isVoidNamedType } from "checker/type_refs.ts";

type Str = string;

export function checkPointerElementType(
  type: Extract<TypeRef, { kind: "PointerTypeRef" | "SafePointerTypeRef" }>,
): Diagnostic[] {
  if (!isArrayTypeRef(type.element)) return [];
  return [{
    message: "Pointer type cannot target array type",
    code: TYPE_POINTER_ARRAY_TARGET,
    span: type.span,
  }];
}

export function checkReferenceElementType(
  type: Extract<TypeRef, { kind: "ReferenceTypeRef" }>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (isArrayTypeRef(type.element)) {
    diagnostics.push({
      message: "Reference type cannot target array type",
      code: TYPE_REFERENCE_ARRAY_TARGET,
      span: type.span,
    });
  }
  if (isVoidNamedType(type.element)) {
    diagnostics.push({
      message: "Reference type cannot target void type",
      code: TYPE_REFERENCE_VOID_TARGET,
      span: type.span,
    });
  }
  return diagnostics;
}

export function checkArrayElementType(
  _type: Extract<TypeRef, { kind: "FixedArrayTypeRef" | "InferredArrayTypeRef" }>,
): Diagnostic[] {
  return [];
}

export function checkArraySize(
  sizeText: Str,
  type: Extract<TypeRef, { kind: "FixedArrayTypeRef" }>,
): Diagnostic[] {
  if (BigInt(sizeText) > 0n) return [];
  return [{
    message: "Array size must be greater than zero",
    code: TYPE_ARRAY_SIZE,
    span: type.span,
  }];
}
