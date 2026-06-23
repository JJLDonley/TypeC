import type {
  BlockStmt,
  ConstDecl,
  EnumDecl,
  Expression,
  FunctionDecl,
  InterfaceDecl,
  Param,
  Program,
  Statement,
  TypeAliasDecl,
  TypeRef,
} from "core/ast.ts";
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
      for (const interfaceDecl of program.interfaces ?? []) this.interfaceDecl(interfaceDecl);
      for (const unionDecl of program.taggedUnions ?? []) this.taggedUnionDecl(unionDecl);
      for (const enumDecl of program.enums ?? []) this.enumDecl(enumDecl);
      for (const constant of program.constants ?? []) this.constDecl(constant);
      for (const fn of program.functions) this.functionDecl(fn);
    });
  }

  private typeAliasDecl(typeAlias: TypeAliasDecl): void {
    this.line(`TypeAliasDecl ${typeAlias.name} = ${this.type(typeAlias.type)}`);
  }

  private interfaceDecl(interfaceDecl: InterfaceDecl): void {
    this.line(`InterfaceDecl ${interfaceDecl.name}`);
    this.indented(() => {
      for (const method of interfaceDecl.methods) {
        this.line(`InterfaceMethod ${method.name} -> ${this.type(method.returnType)}`);
        this.indented(() => this.params(method.params));
      }
    });
  }

  private taggedUnionDecl(unionDecl: NonNullable<Program["taggedUnions"]>[usize]): void {
    this.line(`TaggedUnionDecl ${unionDecl.name}`);
    this.indented(() => {
      for (const variant of unionDecl.variants) {
        const payload = variant.payload ? `: ${this.type(variant.payload)}` : "";
        this.line(`TaggedUnionVariant ${variant.name}${payload}`);
      }
    });
  }

  private enumDecl(enumDecl: EnumDecl): void {
    this.line(`EnumDecl ${enumDecl.name}`);
    this.indented(() => {
      for (const member of enumDecl.members) {
        this.line(`EnumMember ${member.name}`);
        const initializer = member.initializer;
        if (initializer) this.indented(() => this.expression(initializer));
      }
    });
  }

  private constDecl(constant: ConstDecl): void {
    this.line(`ConstDecl ${constant.name}: ${this.type(constant.type)}`);
    this.indented(() => this.expression(constant.initializer));
  }

  private functionDecl(fn: FunctionDecl): void {
    const generics = (fn.genericParams ?? []).map((param) => param.name).join(", ");
    const genericText = generics.length > 0 ? `<${generics}>` : "";
    this.line(
      `${fn.external ? "ExternFunctionDecl" : "FunctionDecl"} ${fn.name}${genericText} -> ${
        this.type(fn.returnType)
      }`,
    );
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
      case "DeferStmt":
        this.line("DeferStmt");
        this.indented(() => this.expression(statement.expression));
        return;
      case "ExpressionStmt":
        this.line("ExpressionStmt");
        this.indented(() => this.expression(statement.expression));
        return;
      case "BreakStmt":
        this.line("BreakStmt");
        return;
      case "VarDeclStmt":
        this.line(
          `${statement.mutable ? "Let" : "Const"} ${statement.name}: ${this.type(statement.type)}`,
        );
        this.indented(() => this.expression(statement.initializer));
        return;
      case "AssignmentStmt":
        this.line(`AssignmentStmt ${statement.name} ${statement.operator}`);
        this.indented(() => this.expression(statement.expression));
        return;
      case "IncDecStmt":
        this.line(`IncDecStmt ${statement.name} ${statement.operator}`);
        return;
      case "SwitchStmt":
        this.line("SwitchStmt");
        this.indented(() => {
          this.expression(statement.expression);
          for (const switchCase of statement.cases) {
            this.line("Case");
            this.indented(() => {
              for (const label of switchCase.labels) this.expression(label);
              for (const child of switchCase.statements) this.statement(child);
            });
          }
          if (statement.defaultCase) {
            const defaultCase = statement.defaultCase;
            this.line("Default");
            this.indented(() => {
              for (const child of defaultCase.statements) this.statement(child);
            });
          }
        });
        return;
      case "WhileStmt":
        this.line("WhileStmt");
        this.indented(() => {
          this.expression(statement.condition);
          this.block(statement.body);
        });
        return;
      case "DoWhileStmt":
        this.line("DoWhileStmt");
        this.indented(() => {
          this.block(statement.body);
          this.expression(statement.condition);
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
      case "UnaryExpr":
        this.line(`UnaryExpr ${expression.operator}`);
        this.indented(() => this.expression(expression.operand));
        return;
      case "BinaryExpr":
        this.line(`BinaryExpr ${expression.operator}`);
        this.indented(() => {
          this.expression(expression.left);
          this.expression(expression.right);
        });
        return;
      case "ConditionalExpr":
        this.line("ConditionalExpr");
        this.indented(() => {
          this.expression(expression.condition);
          this.expression(expression.whenTrue);
          this.expression(expression.whenFalse);
        });
        return;
      case "NullishCoalesceExpr":
        this.line(`NullishCoalesceExpr ${expression.operator}`);
        this.indented(() => {
          this.expression(expression.left);
          this.expression(expression.fallback);
        });
        return;
      case "CallExpr": {
        const typeArgs = expression.typeArgs?.map((typeArg) => this.type(typeArg)).join(", ") ?? "";
        const typeArgText = typeArgs.length > 0 ? `<${typeArgs}>` : "";
        this.line(`CallExpr ${expression.callee}${typeArgText}`);
        this.indented(() => {
          for (const arg of expression.args) this.expression(arg);
        });
        return;
      }
      case "MethodCallExpr":
        this.line(`MethodCallExpr ${expression.method}`);
        this.indented(() => {
          this.expression(expression.receiver);
          for (const arg of expression.args) this.expression(arg);
        });
        return;
      case "PostfixPointerExpr":
        this.line(`PostfixPointerExpr ${expression.operator}`);
        this.indented(() => this.expression(expression.operand));
        return;
      case "NonNullAssertExpr":
        this.line("NonNullAssertExpr");
        this.indented(() => this.expression(expression.operand));
        return;
      case "FieldAccessExpr":
        this.line(`FieldAccessExpr ${expression.field}`);
        this.indented(() => this.expression(expression.operand));
        return;
      case "OptionalFieldAccessExpr":
        this.line(`OptionalFieldAccessExpr ${expression.field}`);
        this.indented(() => this.expression(expression.operand));
        return;
      case "OptionalMethodCallExpr":
        this.line(`OptionalMethodCallExpr ${expression.method}`);
        this.indented(() => {
          this.expression(expression.receiver);
          for (const arg of expression.args) this.expression(arg);
        });
        return;
      case "OptionalIndexExpr":
        this.line("OptionalIndexExpr");
        this.indented(() => {
          this.expression(expression.operand);
          this.expression(expression.index);
        });
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
