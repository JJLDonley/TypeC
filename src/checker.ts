import type { Diagnostic, SourceSpan } from "./diagnostics.ts";
import { TypeCError } from "./diagnostics.ts";
import type { Expression, FunctionDecl, Statement, TypeRef } from "./ast.ts";
import type { ResolvedProgram } from "./rast.ts";
import type { TypedProgram, TypeName } from "./tast.ts";
import { primitiveTypes } from "./token.ts";
import { typeName } from "./type_ref.ts";

type Str = string;
type i32 = number;
type b8 = boolean;

export type CheckedProgram = TypedProgram;

const numericTypes = new Set<Str>(["i8", "i16", "i32", "i64", "u8", "u16", "u32", "u64", "f32", "f64"]);

export function check(program: ResolvedProgram): CheckedProgram {
  const checker = new Checker(program);
  return checker.check();
}

class Checker {
  private diagnostics: Diagnostic[] = [];
  private functions = new Map<Str, FunctionDecl>();
  private expressionTypes = new Map<Str, { type: TypeName }>();

  constructor(private program: ResolvedProgram) {}

  check(): CheckedProgram {
    this.collectFunctions();
    for (const fn of this.program.functions) this.checkFunction(fn);
    if (this.diagnostics.length > 0) throw new TypeCError(this.diagnostics);
    return { ...this.program, expressionTypes: this.expressionTypes };
  }

  private collectFunctions(): void {
    for (const fn of this.program.functions) {
      this.functions.set(fn.name, fn);
      this.checkType(fn.returnType);
      for (const param of fn.params) this.checkType(param.type);
    }
  }

  private checkFunction(fn: FunctionDecl): void {
    const locals = new Map<Str, TypeName>();
    for (const param of fn.params) locals.set(param.name, typeName(param.type));

    let hasReturn = false;
    const returnType = typeName(fn.returnType);
    for (const stmt of fn.body.statements) {
      if (stmt.kind === "ReturnStmt") hasReturn = true;
      this.checkStatement(stmt, locals, returnType);
    }
    if (returnType !== "void" && !hasReturn) this.error(`Function '${fn.name}' must return '${returnType}'`, fn.span);
  }

  private checkStatement(stmt: Statement, locals: Map<Str, TypeName>, returnType: TypeName): void {
    switch (stmt.kind) {
      case "ReturnStmt":
        this.checkReturn(stmt.expression, locals, returnType, stmt.span);
        return;
      case "VarDeclStmt":
        this.checkVarDecl(stmt, locals);
        return;
    }
  }

  private checkReturn(expr: Expression, locals: Map<Str, TypeName>, expected: TypeName, span: SourceSpan): void {
    const actual = this.typeOf(expr, locals);
    if (actual !== expected) this.error(`Return type '${actual}' is not assignable to '${expected}'`, span);
  }

  private checkVarDecl(stmt: Extract<Statement, { kind: "VarDeclStmt" }>, locals: Map<Str, TypeName>): void {
    this.checkType(stmt.type);
    const actual = this.typeOf(stmt.initializer, locals);
    const expected = typeName(stmt.type);
    if (actual !== expected) this.error(`Initializer type '${actual}' is not assignable to '${expected}'`, stmt.span);
    locals.set(stmt.name, expected);
  }

  private typeOf(expr: Expression, locals: Map<Str, TypeName>): TypeName {
    const type = this.computeType(expr, locals);
    this.expressionTypes.set(spanKey(expr.span), { type });
    return type;
  }

  private computeType(expr: Expression, locals: Map<Str, TypeName>): TypeName {
    switch (expr.kind) {
      case "IntegerLiteral":
        return "i32";
      case "FloatLiteral":
        return "f64";
      case "IdentifierExpr":
        return this.identifierType(expr.name, locals, expr.span);
      case "BinaryExpr":
        return this.binaryType(expr, locals);
      case "CallExpr":
        return this.callType(expr, locals);
      case "PostfixPointerExpr":
        return this.postfixPointerType(expr, locals);
    }
  }

  private identifierType(name: Str, locals: Map<Str, TypeName>, span: SourceSpan): TypeName {
    const type = locals.get(name);
    if (type) return type;
    this.error(`Unknown identifier '${name}'`, span);
    return "<error>";
  }

  private binaryType(expr: Extract<Expression, { kind: "BinaryExpr" }>, locals: Map<Str, TypeName>): TypeName {
    const left = this.typeOf(expr.left, locals);
    const right = this.typeOf(expr.right, locals);
    if (left !== right) {
      this.error(`Cannot apply '${expr.operator}' to '${left}' and '${right}'`, expr.span);
      return "<error>";
    }
    if (!numericTypes.has(left)) this.error(`Operator '${expr.operator}' requires numeric operands`, expr.span);
    return left;
  }

  private callType(expr: Extract<Expression, { kind: "CallExpr" }>, locals: Map<Str, TypeName>): TypeName {
    const fn = this.functions.get(expr.callee);
    if (!fn) {
      this.error(`Unknown function '${expr.callee}'`, expr.span);
      return "<error>";
    }

    this.checkCallArgs(expr.args, fn, locals, expr.span);
    return typeName(fn.returnType);
  }

  private checkCallArgs(args: Expression[], fn: FunctionDecl, locals: Map<Str, TypeName>, span: SourceSpan): void {
    if (args.length !== fn.params.length) this.error(`Function '${fn.name}' expects ${fn.params.length} arguments, got ${args.length}`, span);
    const count = Math.min(args.length, fn.params.length) as i32;
    for (let index = 0; index < count; index++) this.checkCallArg(args[index]!, fn, locals, index);
  }

  private checkCallArg(arg: Expression, fn: FunctionDecl, locals: Map<Str, TypeName>, index: i32): void {
    const actual = this.typeOf(arg, locals);
    const expected = typeName(fn.params[index]!.type);
    if (actual !== expected) this.error(`Argument ${index + 1} type '${actual}' is not assignable to '${expected}'`, arg.span);
  }

  private postfixPointerType(expr: Extract<Expression, { kind: "PostfixPointerExpr" }>, locals: Map<Str, TypeName>): TypeName {
    const operand = this.typeOf(expr.operand, locals);
    if (expr.operator === ".&") return `${operand}*`;
    if (isPointerType(operand)) return operand.slice(0, -1);
    this.error(`Cannot dereference non-pointer type '${operand}'`, expr.span);
    return "<error>";
  }

  private checkType(type: TypeRef): void {
    switch (type.kind) {
      case "NamedTypeRef":
        if (!primitiveTypes.has(type.name)) this.error(`Unknown type '${type.name}'`, type.span);
        return;
      case "PointerTypeRef":
      case "ReferenceTypeRef":
        this.checkType(type.element);
        return;
      case "FixedArrayTypeRef":
        this.checkType(type.element);
        this.checkArraySize(type.sizeText, type.span);
        return;
      case "InferredArrayTypeRef":
        this.checkType(type.element);
        this.error("Inferred array types require array initializers", type.span);
        return;
    }
  }

  private checkArraySize(sizeText: Str, span: SourceSpan): void {
    if (Number(sizeText) > 0) return;
    this.error(`Array size must be greater than zero`, span);
  }

  private error(message: Str, span: Diagnostic["span"]): void {
    this.diagnostics.push({ message, span });
  }
}

function isPointerType(type: TypeName): b8 {
  return type.endsWith("*");
}

function spanKey(span: SourceSpan): Str {
  return `${span.start.offset}:${span.end.offset}`;
}
