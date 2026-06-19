import { readHeaderFunction } from "c/header/function.ts";
import { type JsonRecord, isJsonRecord } from "json/record.ts";
import { isFalseJsonFlag, isJsonArray, isJsonText, isNonEmptyJsonText, isTruthyJsonFlag } from "json/values.ts";

type Str = string;
type b8 = boolean;

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
  if (!isJsonRecord(value)) return;
  if (value.kind === "FunctionDecl" && hasName(value) && hasType(value) && isHeaderDeclaration(value)) {
    const fn = readHeaderFunction(value);
    if (fn) functions.push(fn);
  }
  const inner = value.inner;
  if (isJsonArray(inner)) for (const child of inner) collectHeaderFunctionsInto(child, functions);
}

function isHeaderDeclaration(value: JsonRecord): b8 {
  return !isTruthyJsonFlag(value.isImplicit) && !isFalseJsonFlag(value.isUsed);
}

function hasName(value: JsonRecord): b8 {
  return isNonEmptyJsonText(value.name);
}

function hasType(value: JsonRecord): b8 {
  return isJsonRecord(value.type) && isJsonText(value.type.qualType);
}


