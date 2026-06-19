import type { Diagnostic } from "./diagnostics.ts";
import { TypeCError } from "./diagnostics.ts";
import type { Expression, FunctionDecl, Program, Statement, TypeRef } from "./ast.ts";
import { primitiveTypes } from "./token.ts";
import { isNamedType, typeName } from "./type_ref.ts";

export interface CheckedProgram extends Program {}

const numericTypes = new Set(["i8", "i16", "i32", "i64", "u8", "u16", "u32", "u64", "f32", "f64"]);

export function check(program: Program): CheckedProgram {
  const checker = new Checker(program);
  checker.check();
  return program;
}

class Checker {
  private diagnostics: Diagnostic[] = [];
  private functions = new Map<string, FunctionDecl>();

  constructor(private program: Program) {}

  check(): void {
    for (const fn of this.program.functions) {
      if (this.functions.has(fn.name)) this.error(`Duplicate function '${fn.name}'`, fn.span);
      this.functions.set(fn.name, fn);
      this.checkType(fn.returnType);
      for (const param of fn.params) this.checkType(param.type);
    }
    for (const fn of this.program.functions) this.checkFunction(fn);
    if (this.diagnostics.length > 0) throw new TypeCError(this.diagnostics);
  }

  private checkFunction(fn: FunctionDecl): void {
    const locals = new Map<string, string>();
    for (const param of fn.params) {
      if (locals.has(param.name)) this.error(`Duplicate parameter '${param.name}'`, param.span);
      locals.set(param.name, typeName(param.type));
    }

    let hasReturn = false;
    for (const stmt of fn.body.statements) {
      if (stmt.kind === "ReturnStmt") hasReturn = true;
      this.checkStatement(stmt, locals, typeName(fn.returnType));
    }
    if (typeName(fn.returnType) !== "void" && !hasReturn) this.error(`Function '${fn.name}' must return '${typeName(fn.returnType)}'`, fn.span);
  }

  private checkStatement(stmt: Statement, locals: Map<string, string>, returnType: string): void {
    switch (stmt.kind) {
      case "ReturnStmt": {
        const actual = this.typeOf(stmt.expression, locals);
        if (actual !== returnType) this.error(`Return type '${actual}' is not assignable to '${returnType}'`, stmt.span);
        break;
      }
      case "VarDeclStmt": {
        this.checkType(stmt.type);
        if (locals.has(stmt.name)) this.error(`Duplicate local '${stmt.name}'`, stmt.span);
        const actual = this.typeOf(stmt.initializer, locals);
        const expected = typeName(stmt.type);
        if (actual !== expected) this.error(`Initializer type '${actual}' is not assignable to '${expected}'`, stmt.span);
        locals.set(stmt.name, expected);
        break;
      }
    }
  }

  private typeOf(expr: Expression, locals: Map<string, string>): string {
    switch (expr.kind) {
      case "IntegerLiteral":
        return "i32";
      case "FloatLiteral":
        return "f64";
      case "IdentifierExpr": {
        const type = locals.get(expr.name);
        if (!type) {
          this.error(`Unknown identifier '${expr.name}'`, expr.span);
          return "<error>";
        }
        return type;
      }
      case "BinaryExpr": {
        const left = this.typeOf(expr.left, locals);
        const right = this.typeOf(expr.right, locals);
        if (left !== right) {
          this.error(`Cannot apply '${expr.operator}' to '${left}' and '${right}'`, expr.span);
          return "<error>";
        }
        if (!numericTypes.has(left)) this.error(`Operator '${expr.operator}' requires numeric operands`, expr.span);
        return left;
      }
      case "PostfixPointerExpr":
        this.error(`Pointer operator '${expr.operator}' is not supported until Phase 5 pointer checking`, expr.span);
        return "<error>";
      case "CallExpr": {
        const fn = this.functions.get(expr.callee);
        if (!fn) {
          this.error(`Unknown function '${expr.callee}'`, expr.span);
          return "<error>";
        }
        if (expr.args.length !== fn.params.length) this.error(`Function '${expr.callee}' expects ${fn.params.length} arguments, got ${expr.args.length}`, expr.span);
        for (let i = 0; i < Math.min(expr.args.length, fn.params.length); i++) {
          const actual = this.typeOf(expr.args[i]!, locals);
          const expected = typeName(fn.params[i]!.type);
          if (actual !== expected) this.error(`Argument ${i + 1} type '${actual}' is not assignable to '${expected}'`, expr.args[i]!.span);
        }
        return typeName(fn.returnType);
      }
    }
  }

  private checkType(type: TypeRef): void {
    if (!isNamedType(type)) return;
    if (!primitiveTypes.has(type.name)) this.error(`Unknown type '${type.name}'`, type.span);
  }

  private error(message: string, span: Diagnostic["span"]): void {
    this.diagnostics.push({ message, span });
  }
}
