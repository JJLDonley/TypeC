import type { Diagnostic } from "../diagnostics.ts";
import type { TypeRef } from "../ast.ts";
import { isArrayTypeRef, isVoidNamedType } from "checker/type_refs.ts";

type Str = string;

export function checkPointerElementType(type: Extract<TypeRef, { kind: "PointerTypeRef" }>): Diagnostic[] {
  if (!isArrayTypeRef(type.element)) return [];
  return [{ message: "Pointer type cannot target array type", span: type.span }];
}

export function checkReferenceElementType(type: Extract<TypeRef, { kind: "ReferenceTypeRef" }>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (isArrayTypeRef(type.element)) diagnostics.push({ message: "Reference type cannot target array type", span: type.span });
  if (isVoidNamedType(type.element)) diagnostics.push({ message: "Reference type cannot target void type", span: type.span });
  return diagnostics;
}

export function checkArrayElementType(type: Extract<TypeRef, { kind: "FixedArrayTypeRef" | "InferredArrayTypeRef" }>): Diagnostic[] {
  if (!isArrayTypeRef(type.element)) return [];
  return [{ message: "Array type cannot target array type", span: type.span }];
}

export function checkArraySize(sizeText: Str, type: Extract<TypeRef, { kind: "FixedArrayTypeRef" }>): Diagnostic[] {
  if (BigInt(sizeText) > 0n) return [];
  return [{ message: "Array size must be greater than zero", span: type.span }];
}
