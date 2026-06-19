import { collectHeaderFunctions, type CHeaderFunction, type CHeaderParam } from "./c_header_ast.ts";
import { readClangHeaderAst } from "./c_header_clang.ts";
import { headerCompilerFlags } from "./c_header_flags.ts";
import { isTypeCIdentifier } from "./c_header_identifiers.ts";
import { mapCHeaderType } from "./c_header_types.ts";
import { TypeCError } from "./diagnostics.ts";
import { directoryOf, isPathWithinDir } from "./path.ts";

type Str = string;
type b8 = boolean;

export function generateExternsFromClangAst(ast: unknown, includeDir: Str | null = null): Str {
  const candidates = collectHeaderFunctions(ast).filter((fn) => isIncludedHeaderFunction(fn, includeDir));
  const functions = uniqueFunctions(unambiguousFunctions(candidates)).flatMap(formatSupportedFunction);
  return `${functions.join("\n")}${functions.length > 0 ? "\n" : ""}`;
}

export async function generateExternsFromHeader(headerPath: Str, compilerFlags: Str[] = [], projectDir: Str = Deno.cwd()): Promise<Str> {
  const ast = await readClangHeaderAst(headerPath, headerCompilerFlags(compilerFlags, projectDir));
  return generateExternsFromClangAst(ast, directoryOf(headerPath));
}

function uniqueFunctions(functions: CHeaderFunction[]): CHeaderFunction[] {
  const seen = new Set<Str>();
  const unique: CHeaderFunction[] = [];
  for (const fn of functions) {
    const key = functionKey(fn);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(fn);
  }
  return unique;
}

function unambiguousFunctions(functions: CHeaderFunction[]): CHeaderFunction[] {
  const signatures = functionSignatures(functions);
  return functions.filter((fn) => signatures.get(fn.name)?.size === 1);
}

function functionSignatures(functions: CHeaderFunction[]): Map<Str, Set<Str>> {
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

function isIncludedHeaderFunction(fn: CHeaderFunction, includeDir: Str | null): b8 {
  if (includeDir === null) return true;
  if (fn.sourceFile === null) return false;
  return isPathWithinDir(fn.sourceFile, includeDir);
}

function functionKey(fn: CHeaderFunction): Str {
  return `${fn.name}:${functionTypeCSignature(fn) ?? `unsupported:${fn.functionType}`}`;
}

function functionTypeCSignature(fn: CHeaderFunction): Str | null {
  try {
    const params = fn.params.map((param) => mapCHeaderType(param.type)).join(",");
    return `${mapCHeaderType(fn.returnType)}(${params})`;
  } catch (error) {
    if (error instanceof TypeCError) return null;
    throw error;
  }
}

function formatSupportedFunction(fn: CHeaderFunction): Str[] {
  try {
    if (isVariadicFunction(fn) || isUnprototypedFunction(fn) || hasFunctionPointerType(fn) || isStaticFunction(fn) || fn.hasBody || !isTypeCIdentifier(fn.name)) return [];
    return [formatFunction(fn)];
  } catch (error) {
    if (error instanceof TypeCError) return [];
    throw error;
  }
}

function isVariadicFunction(fn: CHeaderFunction): b8 {
  return fn.functionType.includes("...");
}

function isUnprototypedFunction(fn: CHeaderFunction): b8 {
  return fn.functionType.endsWith("()");
}

function hasFunctionPointerType(fn: CHeaderFunction): b8 {
  return fn.functionType.includes("(*") || fn.params.some((param) => param.type.includes("(*"));
}

function isStaticFunction(fn: CHeaderFunction): b8 {
  return fn.storageClass === "static";
}

function formatFunction(fn: CHeaderFunction): Str {
  const params = fn.params.map(formatParam).join(", ");
  return `extern function ${fn.name}(${params}): ${mapCHeaderType(fn.returnType)};`;
}

function formatParam(param: CHeaderParam): Str {
  return `${param.name}: ${mapCHeaderType(param.type)}`;
}

