import { TypeCError } from "./diagnostics.ts";

type Str = string;
type b8 = boolean;
type usize = number;

type JsonRecord = Record<Str, unknown>;

interface CParam {
  name: Str;
  type: Str;
}

interface CFunction {
  name: Str;
  functionType: Str;
  returnType: Str;
  params: CParam[];
}

const typeMap = new Map<Str, Str>([
  ["void", "void"],
  ["int8_t", "i8"],
  ["int16_t", "i16"],
  ["int32_t", "i32"],
  ["int64_t", "i64"],
  ["uint8_t", "u8"],
  ["uint16_t", "u16"],
  ["uint32_t", "u32"],
  ["uint64_t", "u64"],
  ["i8", "i8"],
  ["i16", "i16"],
  ["i32", "i32"],
  ["i64", "i64"],
  ["u8", "u8"],
  ["u16", "u16"],
  ["u32", "u32"],
  ["u64", "u64"],
  ["float", "f32"],
  ["double", "f64"],
  ["bool", "b8"],
  ["_Bool", "b8"],
  ["size_t", "usize"],
]);

export function generateExternsFromClangAst(ast: unknown): Str {
  const functions = uniqueFunctions(collectFunctions(ast)).flatMap(formatSupportedFunction);
  return `${functions.join("\n")}${functions.length > 0 ? "\n" : ""}`;
}

export async function generateExternsFromHeader(headerPath: Str, compilerFlags: Str[] = [], projectDir: Str = Deno.cwd()): Promise<Str> {
  const output = await runClangAstDump(headerPath, headerCompilerFlags(compilerFlags, projectDir));
  if (!output.ok) throw new TypeCError([{ message: `clang failed while reading '${headerPath}': ${output.stderr}` }]);
  return generateExternsFromClangAst(parseClangJson(output.stdout));
}

async function runClangAstDump(headerPath: Str, compilerFlags: Str[]): Promise<{ ok: b8; stdout: Str; stderr: Str }> {
  const command = new Deno.Command("clang", {
    args: ["-x", "c", "-Xclang", "-ast-dump=json", "-fsyntax-only", ...compilerFlags, headerPath],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const decoder = new TextDecoder();
  return { ok: output.success, stdout: decoder.decode(output.stdout), stderr: decoder.decode(output.stderr).trim() };
}

function headerCompilerFlags(flags: Str[], projectDir: Str): Str[] {
  return flags.filter(isHeaderCompilerFlag).map((flag) => normalizeHeaderCompilerFlag(flag, projectDir));
}

function isHeaderCompilerFlag(flag: Str): b8 {
  return flag.startsWith("-I") || flag.startsWith("-D") || flag.startsWith("-U") || flag.startsWith("-isystem");
}

function normalizeHeaderCompilerFlag(flag: Str, projectDir: Str): Str {
  if (flag.startsWith("-I")) return normalizeJoinedPathFlag(flag, "-I", projectDir);
  if (flag.startsWith("-isystem")) return normalizeJoinedPathFlag(flag, "-isystem", projectDir);
  return flag;
}

function normalizeJoinedPathFlag(flag: Str, prefix: Str, projectDir: Str): Str {
  if (flag.length <= prefix.length) return flag;
  const path = flag.slice(prefix.length);
  if (path.startsWith("/")) return flag;
  return `${prefix}${projectDir}/${path}`;
}

function parseClangJson(text: Str): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new TypeCError([{ message: "clang did not emit valid JSON" }]);
  }
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

function functionKey(fn: CFunction): Str {
  return `${fn.name}:${fn.functionType}`;
}

function collectFunctionsInto(value: unknown, functions: CFunction[]): void {
  if (!isRecord(value)) return;
  if (value.kind === "FunctionDecl" && hasName(value) && hasType(value) && isHeaderDeclaration(value)) {
    functions.push(readFunction(value));
  }
  const inner = value.inner;
  if (Array.isArray(inner)) for (const child of inner) collectFunctionsInto(child, functions);
}

function readFunction(value: JsonRecord): CFunction {
  const type = requireRecord(value.type, `Function '${value.name}' has no type`);
  const functionType = readText(type.qualType, `Function '${value.name}' has no type`);
  const params = readParams(value.inner);
  return { name: value.name as Str, functionType, returnType: readReturnType(functionType), params };
}

function readParams(value: unknown): CParam[] {
  if (!Array.isArray(value)) return [];
  const params: CParam[] = [];
  for (const child of value) if (isParam(child)) params.push(readParam(child, params.length));
  return params;
}

function readParam(value: JsonRecord, index: usize): CParam {
  const type = requireRecord(value.type, "Parameter has no type");
  return { name: readParamName(value, index), type: readText(type.qualType, "Parameter has no type") };
}

function readParamName(value: JsonRecord, index: usize): Str {
  if (typeof value.name === "string" && value.name.length > 0) return value.name;
  return `arg${index}`;
}

function readReturnType(type: Str): Str {
  const marker = " (";
  const index = type.indexOf(marker);
  if (index < 0) throw new TypeCError([{ message: `Unsupported function type '${type}'` }]);
  return type.slice(0, index);
}

function formatSupportedFunction(fn: CFunction): Str[] {
  try {
    if (isVariadicFunction(fn)) return [];
    return [formatFunction(fn)];
  } catch (error) {
    if (error instanceof TypeCError) return [];
    throw error;
  }
}

function isVariadicFunction(fn: CFunction): b8 {
  return fn.functionType.includes("...");
}

function formatFunction(fn: CFunction): Str {
  const params = fn.params.map(formatParam).join(", ");
  return `extern function ${fn.name}(${params}): ${mapCType(fn.returnType)};`;
}

function formatParam(param: CParam): Str {
  return `${param.name}: ${mapCType(param.type)}`;
}

function mapCType(type: Str): Str {
  const normalized = normalizeCType(type);
  if (normalized.endsWith("*")) return `${mapCType(normalized.slice(0, -1))}*`;
  const mapped = typeMap.get(normalized);
  if (mapped) return mapped;
  throw new TypeCError([{ message: `Unsupported C type '${type}'` }]);
}

function normalizeCType(type: Str): Str {
  return type.replace(/\bconst\b/g, "").replace(/\bvolatile\b/g, "").replace(/\s*\*\s*/g, "*").replace(/\s+/g, " ").trim();
}

function isHeaderDeclaration(value: JsonRecord): b8 {
  return value.isImplicit !== true && value.isUsed !== false;
}

function isParam(value: unknown): value is JsonRecord {
  return isRecord(value) && value.kind === "ParmVarDecl";
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
