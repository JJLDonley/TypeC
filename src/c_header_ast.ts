import { sanitizeHeaderParamName, uniqueHeaderParamName } from "./c_header_identifiers.ts";
import { TypeCError } from "./diagnostics.ts";

type Str = string;
type b8 = boolean;
type usize = number;

interface JsonRecord {
  [key: Str]: unknown;
}

export interface CHeaderParam {
  name: Str;
  type: Str;
}

export interface CHeaderFunction {
  name: Str;
  functionType: Str;
  returnType: Str;
  params: CHeaderParam[];
  sourceFile: Str | null;
  storageClass: Str | null;
  hasBody: b8;
}

export function collectHeaderFunctions(value: unknown): CHeaderFunction[] {
  const functions: CHeaderFunction[] = [];
  collectHeaderFunctionsInto(value, functions);
  return functions;
}

function collectHeaderFunctionsInto(value: unknown, functions: CHeaderFunction[]): void {
  if (!isRecord(value)) return;
  if (value.kind === "FunctionDecl" && hasName(value) && hasType(value) && isHeaderDeclaration(value)) {
    const fn = readSupportedFunction(value);
    if (fn) functions.push(fn);
  }
  const inner = value.inner;
  if (Array.isArray(inner)) for (const child of inner) collectHeaderFunctionsInto(child, functions);
}

function readSupportedFunction(value: JsonRecord): CHeaderFunction | null {
  try {
    return readFunction(value);
  } catch (error) {
    if (error instanceof TypeCError) return null;
    throw error;
  }
}

function readFunction(value: JsonRecord): CHeaderFunction {
  const type = requireRecord(value.type, `Function '${value.name}' has no type`);
  const functionType = readText(type.qualType, `Function '${value.name}' has no type`);
  const params = readParams(value.inner);
  return { name: value.name as Str, functionType, returnType: readReturnType(functionType), params, sourceFile: readSourceFile(value), storageClass: readStorageClass(value), hasBody: hasFunctionBody(value) };
}

function readParams(value: unknown): CHeaderParam[] {
  if (!Array.isArray(value)) return [];
  const params: CHeaderParam[] = [];
  const names = new Set<Str>();
  for (const child of value) if (isParam(child)) params.push(readParam(child, params.length, names));
  return params;
}

function readParam(value: JsonRecord, index: usize, names: Set<Str>): CHeaderParam {
  const type = requireRecord(value.type, "Parameter has no type");
  return { name: readParamName(value, index, names), type: readText(type.qualType, "Parameter has no type") };
}

function readParamName(value: JsonRecord, index: usize, names: Set<Str>): Str {
  const candidate = typeof value.name === "string" && value.name.length > 0 ? sanitizeHeaderParamName(value.name) : `arg${index}`;
  return uniqueHeaderParamName(candidate, names);
}

function readReturnType(type: Str): Str {
  const index = type.indexOf("(");
  if (index < 0) throw new TypeCError([{ message: `Unsupported function type '${type}'` }]);
  return type.slice(0, index).trim();
}

function readSourceFile(value: JsonRecord): Str | null {
  const loc = value.loc;
  if (!isRecord(loc)) return null;
  if (typeof loc.file === "string") return loc.file;
  const includedFrom = loc.includedFrom;
  if (!isRecord(includedFrom)) return null;
  if (typeof includedFrom.file === "string") return includedFrom.file;
  return null;
}

function readStorageClass(value: JsonRecord): Str | null {
  if (typeof value.storageClass === "string") return value.storageClass;
  return null;
}

function hasFunctionBody(value: JsonRecord): b8 {
  const inner = value.inner;
  return Array.isArray(inner) && inner.some(isCompoundStmt);
}

function isHeaderDeclaration(value: JsonRecord): b8 {
  return value.isImplicit !== true && value.isUsed !== false;
}

function isParam(value: unknown): value is JsonRecord {
  return isRecord(value) && value.kind === "ParmVarDecl";
}

function isCompoundStmt(value: unknown): b8 {
  return isRecord(value) && value.kind === "CompoundStmt";
}

function hasName(value: JsonRecord): b8 {
  return typeof value.name === "string" && value.name.length > 0;
}

function hasType(value: JsonRecord): b8 {
  return isRecord(value.type) && typeof value.type.qualType === "string";
}

function requireRecord(value: unknown, message: Str): JsonRecord {
  if (isRecord(value)) return value;
  throw new TypeCError([{ message }]);
}

function readText(value: unknown, message: Str): Str {
  if (typeof value === "string") return value;
  throw new TypeCError([{ message }]);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
