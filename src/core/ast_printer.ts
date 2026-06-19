import type { BlockStmt, Expression, FunctionDecl, Param, Program, Statement, TypeAliasDecl, TypeRef } from "core/ast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type usize = number;

export function printAst(program: Program): Str {
  const printer = new AstPrinter();
  printer.program(program);
  return printer.finish();
}

class AstPrinter {
  private lines: Str[] = [];
  private depth: usize = 0;

  program(program: Program): void {
    this.line("Program");
    this.indented(() => {
      for (const typeAlias of program.typeAliases) this.typeAliasDecl(typeAlias);
      for (const fn of program.functions) this.functionDecl(fn);
    });
  }

  private typeAliasDecl(typeAlias: TypeAliasDecl): void {
    this.line(`TypeAliasDecl ${typeAlias.name} = ${this.type(typeAlias.type)}`);
  }

  private functionDecl(fn: FunctionDecl): void {
    this.line(`${fn.external ? "ExternFunctionDecl" : "FunctionDecl"} ${fn.name} -> ${this.type(fn.returnType)}`);
    this.indented(() => {
      this.params(fn.params);
      if (fn.body) this.block(fn.body);
    });
  }

  private params(params: Param[]): void {
    this.line("Params");
    this.indented(() => {
      for (const param of params) this.line(`Param ${param.name}: ${this.type(param.type)}`);
    });
  }

  private block(block: BlockStmt): void {
    this.line("BlockStmt");
    this.indented(() => {
      for (const statement of block.statements) this.statement(statement);
    });
  }

  private statement(statement: Statement): void {
    switch (statement.kind) {
      case "ReturnStmt":
        this.line("ReturnStmt");
        if (statement.expression) {
          const expression = statement.expression;
          this.indented(() => this.expression(expression));
        }
        return;
      case "ExpressionStmt":
        this.line("ExpressionStmt");
        this.indented(() => this.expression(statement.expression));
        return;
      case "VarDeclStmt":
        this.line(`${statement.mutable ? "Let" : "Const"} ${statement.name}: ${this.type(statement.type)}`);
        this.indented(() => this.expression(statement.initializer));
        return;
      case "AssignmentStmt":
        this.line(`AssignmentStmt ${statement.name}`);
        this.indented(() => this.expression(statement.expression));
        return;
      case "WhileStmt":
        this.line("WhileStmt");
        this.indented(() => {
          this.expression(statement.condition);
          this.block(statement.body);
        });
        return;
      case "IfStmt":
        this.line("IfStmt");
        this.indented(() => {
          this.expression(statement.condition);
          this.block(statement.thenBody);
          if (statement.elseBody) this.block(statement.elseBody);
        });
        return;
    }
  }

  private expression(expression: Expression): void {
    switch (expression.kind) {
      case "IntegerLiteral":
        this.line(`IntegerLiteral ${expression.text}`);
        return;
      case "FloatLiteral":
        this.line(`FloatLiteral ${expression.text}`);
        return;
      case "BoolLiteral":
        this.line(`BoolLiteral ${expression.text}`);
        return;
      case "StringLiteral":
        this.line(`StringLiteral ${expression.text}`);
        return;
      case "IdentifierExpr":
        this.line(`IdentifierExpr ${expression.name}`);
        return;
      case "BinaryExpr":
        this.line(`BinaryExpr ${expression.operator}`);
        this.indented(() => {
          this.expression(expression.left);
          this.expression(expression.right);
        });
        return;
      case "CallExpr":
        this.line(`CallExpr ${expression.callee}`);
        this.indented(() => {
          for (const arg of expression.args) this.expression(arg);
        });
        return;
      case "PostfixPointerExpr":
        this.line(`PostfixPointerExpr ${expression.operator}`);
        this.indented(() => this.expression(expression.operand));
        return;
      case "FieldAccessExpr":
        this.line(`FieldAccessExpr ${expression.field}`);
        this.indented(() => this.expression(expression.operand));
        return;
      case "RecordLiteralExpr":
        this.line("RecordLiteralExpr");
        this.indented(() => {
          for (const field of expression.fields) {
            this.line(`Field ${field.name}`);
            this.indented(() => this.expression(field.expression));
          }
        });
        return;
      case "ArrayLiteralExpr":
        this.line("ArrayLiteralExpr");
        this.indented(() => {
          for (const element of expression.elements) this.expression(element);
        });
        return;
      case "IndexExpr":
        this.line("IndexExpr");
        this.indented(() => {
          this.expression(expression.operand);
          this.expression(expression.index);
        });
        return;
    }
  }

  private type(type: TypeRef): Str {
    return typeName(type);
  }

  private indented(action: () => void): void {
    this.depth++;
    action();
    this.depth--;
  }

  private line(text: Str): void {
    this.lines.push(`${"  ".repeat(this.depth)}${text}`);
  }

  finish(): Str {
    return this.lines.join("\n");
  }
}
