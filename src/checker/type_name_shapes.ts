import type { TypeName } from "core/tast.ts";

type Str = string;
type b8 = boolean;
type i32 = number;
type IntLiteralValue = bigint;

export interface ArrayTypeNameShape {
  element: TypeName;
  length: IntLiteralValue | null;
}

export interface SliceTypeNameShape {
  element: TypeName;
}

export interface SafePointerTypeNameShape {
  element: TypeName;
}

export interface TupleTypeNameShape {
  elements: TypeName[];
}

export interface FunctionParamTypeNameShape {
  name: Str;
  type: TypeName;
}

export interface FunctionTypeNameShape {
  params: FunctionParamTypeNameShape[];
  returnType: TypeName;
}

export function optionalTypeNameElement(type: TypeName): TypeName | null {
  if (!type.endsWith("?")) return null;
  const element = type.slice(0, -1);
  return element.length > 0 ? element : null;
}

export function parseArrayTypeName(type: TypeName): ArrayTypeNameShape | null {
  const match = type.match(/^(.+)\[(\d*)\]$/);
  if (!match) return null;
  return { element: match[1], length: match[2] ? BigInt(match[2]) : null };
}

export function parseSliceTypeName(type: TypeName): SliceTypeNameShape | null {
  const match = type.match(/^Slice<(.+)>$/);
  if (!match) return null;
  return { element: match[1] };
}

export function parseSafePointerTypeName(type: TypeName): SafePointerTypeNameShape | null {
  const match = type.match(/^SafePtr<(.+)>$/);
  if (!match) return null;
  return { element: match[1] };
}

export function parseTupleTypeName(type: TypeName): TupleTypeNameShape | null {
  if (!type.startsWith("[") || !type.endsWith("]")) return null;
  const body = type.slice(1, -1).trim();
  if (body.length === 0) return { elements: [] };
  return { elements: splitTopLevel(body, ",") };
}

export function parseFunctionTypeName(type: TypeName): FunctionTypeNameShape | null {
  const arrow = findTopLevelArrow(type);
  if (arrow === null || !type.startsWith("(")) return null;
  const paramsEnd = arrow - 1;
  if (type[paramsEnd] !== ")") return null;
  return {
    params: parseFunctionParamTypeNames(type.slice(1, paramsEnd).trim()),
    returnType: type.slice(arrow + 4).trim(),
  };
}

function parseFunctionParamTypeNames(params: Str): FunctionParamTypeNameShape[] {
  if (params === "") return [];
  return splitTopLevel(params, ",").map(parseFunctionParamTypeName);
}

function parseFunctionParamTypeName(param: Str): FunctionParamTypeNameShape {
  const separator = findTopLevelCharacter(param, ":");
  if (separator === null) return { name: "", type: param.trim() };
  return { name: param.slice(0, separator).trim(), type: param.slice(separator + 1).trim() };
}

function findTopLevelArrow(type: Str): i32 | null {
  let depth = 0;
  for (let index: i32 = 0; index < type.length - 3; index++) {
    depth = nextTypeNestingDepth(type[index]!, depth);
    if (depth === 0 && type.slice(index, index + 4) === " => ") return index;
  }
  return null;
}

export function splitTopLevel(text: Str, separator: Str): Str[] {
  const parts: Str[] = [];
  let start = 0;
  let depth = 0;
  for (let index: i32 = 0; index < text.length; index++) {
    depth = nextTypeNestingDepth(text[index]!, depth);
    if (depth === 0 && text[index] === separator) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts;
}

function findTopLevelCharacter(text: Str, character: Str): i32 | null {
  let depth = 0;
  for (let index: i32 = 0; index < text.length; index++) {
    depth = nextTypeNestingDepth(text[index]!, depth);
    if (depth === 0 && text[index] === character) return index;
  }
  return null;
}

function nextTypeNestingDepth(character: Str, depth: i32): i32 {
  if (character === "(" || character === "<" || character === "[") return depth + 1;
  if (character === ")" || character === ">" || character === "]") return depth - 1;
  return depth;
}

export function isPointerLikeTypeName(type: TypeName): b8 {
  return type.endsWith("*") || type.endsWith("&") || parseSafePointerTypeName(type) !== null;
}

export function pointeeTypeName(type: TypeName): TypeName {
  const safePointer = parseSafePointerTypeName(type);
  if (safePointer !== null) return safePointer.element;
  return type.slice(0, -1);
}
