import { readClangHeaderAst } from "./c_header_clang.ts";
import { headerCompilerFlags } from "./c_header_flags.ts";
import { isTypeCIdentifier, sanitizeHeaderParamName, uniqueHeaderParamName } from "./c_header_identifiers.ts";
import { mapCHeaderType } from "./c_header_types.ts";
import { TypeCError } from "./diagnostics.ts";
import { directoryOf, isPathWithinDir } from "./path.ts";

type Str = string;
type b8 = boolean;
type usize = number;

interface JsonRecord {
  [key: Str]: unknown;
}

interface CParam {
  name: Str;
  type: Str;
}

interface CFunction {
  name: Str;
  functionType: Str;
  returnType: Str;
  params: CParam[];
  sourceFile: Str | null;
  storageClass: Str | null;
  hasBody: b8;
}

export function generateExternsFromClangAst(ast: unknown, includeDir: Str | null = null): Str {
  const candidates = collectFunctions(ast).filter((fn) => isIncludedHeaderFunction(fn, includeDir));
  const functions = uniqueFunctions(unambiguousFunctions(candidates)).flatMap(formatSupportedFunction);
  return `${functions.join("\n")}${functions.length > 0 ? "\n" : ""}`;
}

export async function generateExternsFromHeader(headerPath: Str, compilerFlags: Str[] = [], projectDir: Str = Deno.cwd()): Promise<Str> {
  const ast = await readClangHeaderAst(headerPath, headerCompilerFlags(compilerFlags, projectDir));
  return generateExternsFromClangAst(ast, directoryOf(headerPath));
}

function collectFunctions(value: unknown): CFunction[] {
  const functions: CFunction[] = [];
  collectFunctionsInto(value, functions);
  return functions;
}

function uniqueFunctions(functions: CFunction[]): CFunction[] {
  const seen = new Set<Str>();
  const unique: CFunction[] = [];
  for (const fn of functions) {
    const key = functionKey(fn);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(fn);
  }
  return unique;
}

function unambiguousFunctions(functions: CFunction[]): CFunction[] {
  const signatures = functionSignatures(functions);
  return functions.filter((fn) => signatures.get(fn.name)?.size === 1);
}

function functionSignatures(functions: CFunction[]): Map<Str, Set<Str>> {
  const signatures = new Map<Str, Set<Str>>();
  for (const fn of functions) {
    const signature = functionTypeCSignature(fn);
    if (signature === null) continue;
    const types = signatures.get(fn.name) ?? new Set<Str>();
    types.add(signature);
    signatures.set(fn.name, types);
  }
  return signatures;
}

function isIncludedHeaderFunction(fn: CFunction, includeDir: Str | null): b8 {
  if (includeDir === null) return true;
  if (fn.sourceFile === null) return false;
  return isPathWithinDir(fn.sourceFile, includeDir);
}

function functionKey(fn: CFunction): Str {
  return `${fn.name}:${functionTypeCSignature(fn) ?? `unsupported:${fn.functionType}`}`;
}

function functionTypeCSignature(fn: CFunction): Str | null {
  try {
    const params = fn.params.map((param) => mapCHeaderType(param.type)).join(",");
    return `${mapCHeaderType(fn.returnType)}(${params})`;
  } catch (error) {
    if (error instanceof TypeCError) return null;
    throw error;
  }
}

function collectFunctionsInto(value: unknown, functions: CFunction[]): void {
  if (!isRecord(value)) return;
  if (value.kind === "FunctionDecl" && hasName(value) && hasType(value) && isHeaderDeclaration(value)) {
    const fn = readSupportedFunction(value);
    if (fn) functions.push(fn);
  }
  const inner = value.inner;
  if (Array.isArray(inner)) for (const child of inner) collectFunctionsInto(child, functions);
}

function readSupportedFunction(value: JsonRecord): CFunction | null {
  try {
    return readFunction(value);
  } catch (error) {
    if (error instanceof TypeCError) return null;
    throw error;
  }
}

function readFunction(value: JsonRecord): CFunction {
  const type = requireRecord(value.type, `Function '${value.name}' has no type`);
  const functionType = readText(type.qualType, `Function '${value.name}' has no type`);
  const params = readParams(value.inner);
  return { name: value.name as Str, functionType, returnType: readReturnType(functionType), params, sourceFile: readSourceFile(value), storageClass: readStorageClass(value), hasBody: hasFunctionBody(value) };
}

function readParams(value: unknown): CParam[] {
  if (!Array.isArray(value)) return [];
  const params: CParam[] = [];
  const names = new Set<Str>();
  for (const child of value) if (isParam(child)) params.push(readParam(child, params.length, names));
  return params;
}

function hasFunctionBody(value: JsonRecord): b8 {
  const inner = value.inner;
  return Array.isArray(inner) && inner.some(isCompoundStmt);
}

function readParam(value: JsonRecord, index: usize, names: Set<Str>): CParam {
  const type = requireRecord(value.type, "Parameter has no type");
  return { name: readParamName(value, index, names), type: readText(type.qualType, "Parameter has no type") };
}

function readParamName(value: JsonRecord, index: usize, names: Set<Str>): Str {
  const candidate = typeof value.name === "string" && value.name.length > 0 ? sanitizeHeaderParamName(value.name) : `arg${index}`;
  return uniqueHeaderParamName(candidate, names);
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

function readReturnType(type: Str): Str {
  const index = type.indexOf("(");
  if (index < 0) throw new TypeCError([{ message: `Unsupported function type '${type}'` }]);
  return type.slice(0, index).trim();
}

function formatSupportedFunction(fn: CFunction): Str[] {
  try {
    if (isVariadicFunction(fn) || isUnprototypedFunction(fn) || hasFunctionPointerType(fn) || isStaticFunction(fn) || fn.hasBody || !isTypeCIdentifier(fn.name)) return [];
    return [formatFunction(fn)];
  } catch (error) {
    if (error instanceof TypeCError) return [];
    throw error;
  }
}

function isVariadicFunction(fn: CFunction): b8 {
  return fn.functionType.includes("...");
}

function isUnprototypedFunction(fn: CFunction): b8 {
  return fn.functionType.endsWith("()");
}

function hasFunctionPointerType(fn: CFunction): b8 {
  return fn.functionType.includes("(*") || fn.params.some((param) => param.type.includes("(*"));
}

function isStaticFunction(fn: CFunction): b8 {
  return fn.storageClass === "static";
}

function formatFunction(fn: CFunction): Str {
  const params = fn.params.map(formatParam).join(", ");
  return `extern function ${fn.name}(${params}): ${mapCHeaderType(fn.returnType)};`;
}

function formatParam(param: CParam): Str {
  return `${param.name}: ${mapCHeaderType(param.type)}`;
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
