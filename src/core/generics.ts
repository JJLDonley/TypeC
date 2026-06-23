import type {
  BlockStmt,
  Expression,
  FunctionDecl,
  Param,
  Program,
  Statement,
  TypeRef,
} from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import { typeName } from "core/type_ref.ts";

export type Str = string;
type b8 = boolean;
type usize = number;

type TypeSubstitutions = Map<Str, TypeRef>;

export function instantiateGenerics(program: Program): Program {
  const templates = genericTemplates(program.functions);
  const diagnostics = genericDiagnostics(program.functions, templates);
  if (diagnostics.length > 0) throw new TypeCError(diagnostics);
  const ordinary = program.functions.filter((fn) => !isGenericFunction(fn));
  const instantiator = new GenericInstantiator(templates);
  const functions = ordinary.map((fn) => instantiator.rewriteFunction(fn));
  return { ...program, functions: [...functions, ...instantiator.instantiations()] };
}

function genericDiagnostics(
  functions: FunctionDecl[],
  templates: Map<Str, FunctionDecl>,
): Diagnostic[] {
  return [
    ...functions.flatMap(genericParamDiagnostics),
    ...functions.flatMap((fn) => genericCallDiagnostics(fn, templates)),
  ];
}

function genericParamDiagnostics(fn: FunctionDecl): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const names = new Set<Str>();
  for (const param of fn.genericParams ?? []) {
    if (names.has(param.name)) {
      diagnostics.push({
        message: `Duplicate generic parameter '${param.name}'`,
        span: param.span,
      });
    }
    names.add(param.name);
  }
  return diagnostics;
}

function genericCallDiagnostics(
  fn: FunctionDecl,
  templates: Map<Str, FunctionDecl>,
): Diagnostic[] {
  if (!fn.body) return [];
  return statementListGenericCallDiagnostics(fn.body.statements, templates);
}

function statementListGenericCallDiagnostics(
  statements: Statement[],
  templates: Map<Str, FunctionDecl>,
): Diagnostic[] {
  return statements.flatMap((statement) => statementGenericCallDiagnostics(statement, templates));
}

function statementGenericCallDiagnostics(
  statement: Statement,
  templates: Map<Str, FunctionDecl>,
): Diagnostic[] {
  switch (statement.kind) {
    case "ReturnStmt":
      return statement.expression
        ? expressionGenericCallDiagnostics(statement.expression, templates)
        : [];
    case "ExpressionStmt":
      return expressionGenericCallDiagnostics(statement.expression, templates);
    case "BreakStmt":
      return [];
    case "VarDeclStmt":
      return expressionGenericCallDiagnostics(statement.initializer, templates);
    case "AssignmentStmt":
      return expressionGenericCallDiagnostics(statement.expression, templates);
    case "SwitchStmt":
      return [
        ...expressionGenericCallDiagnostics(statement.expression, templates),
        ...statement.cases.flatMap((switchCase) => [
          ...switchCase.labels.flatMap((label) =>
            expressionGenericCallDiagnostics(label, templates)
          ),
          ...statementListGenericCallDiagnostics(switchCase.statements, templates),
        ]),
        ...(statement.defaultCase
          ? statementListGenericCallDiagnostics(statement.defaultCase.statements, templates)
          : []),
      ];
    case "WhileStmt":
      return [
        ...expressionGenericCallDiagnostics(statement.condition, templates),
        ...statementListGenericCallDiagnostics(statement.body.statements, templates),
      ];
    case "IfStmt":
      return [
        ...expressionGenericCallDiagnostics(statement.condition, templates),
        ...statementListGenericCallDiagnostics(statement.thenBody.statements, templates),
        ...(statement.elseBody
          ? statementListGenericCallDiagnostics(statement.elseBody.statements, templates)
          : []),
      ];
  }
}

function expressionGenericCallDiagnostics(
  expr: Expression,
  templates: Map<Str, FunctionDecl>,
): Diagnostic[] {
  switch (expr.kind) {
    case "IntegerLiteral":
    case "FloatLiteral":
    case "BoolLiteral":
    case "StringLiteral":
    case "IdentifierExpr":
      return [];
    case "UnaryExpr":
      return expressionGenericCallDiagnostics(expr.operand, templates);
    case "BinaryExpr":
      return [
        ...expressionGenericCallDiagnostics(expr.left, templates),
        ...expressionGenericCallDiagnostics(expr.right, templates),
      ];
    case "CallExpr":
      return [
        ...genericCallArityDiagnostics(expr, templates),
        ...expr.args.flatMap((arg) => expressionGenericCallDiagnostics(arg, templates)),
      ];
    case "MethodCallExpr":
      return [
        ...expressionGenericCallDiagnostics(expr.receiver, templates),
        ...expr.args.flatMap((arg) => expressionGenericCallDiagnostics(arg, templates)),
      ];
    case "PostfixPointerExpr":
      return expressionGenericCallDiagnostics(expr.operand, templates);
    case "FieldAccessExpr":
      return expressionGenericCallDiagnostics(expr.operand, templates);
    case "RecordLiteralExpr":
      return expr.fields.flatMap((field) =>
        expressionGenericCallDiagnostics(field.expression, templates)
      );
    case "ArrayLiteralExpr":
      return expr.elements.flatMap((element) =>
        expressionGenericCallDiagnostics(element, templates)
      );
    case "IndexExpr":
      return [
        ...expressionGenericCallDiagnostics(expr.operand, templates),
        ...expressionGenericCallDiagnostics(expr.index, templates),
      ];
  }
}

function genericCallArityDiagnostics(
  expr: Extract<Expression, { kind: "CallExpr" }>,
  templates: Map<Str, FunctionDecl>,
): Diagnostic[] {
  const typeArgs = expr.typeArgs ?? [];
  if (typeArgs.length === 0) return [];
  const template = templates.get(expr.callee);
  if (!template) return [{ message: `Unknown generic function '${expr.callee}'`, span: expr.span }];
  const expected = template.genericParams?.length ?? 0;
  if (typeArgs.length === expected) return [];
  return [{
    message: `Generic function '${expr.callee}' expects ${expected} type argument(s)`,
    span: expr.span,
  }];
}

function genericTemplates(functions: FunctionDecl[]): Map<Str, FunctionDecl> {
  const templates = new Map<Str, FunctionDecl>();
  for (const fn of functions) if (isGenericFunction(fn)) templates.set(fn.name, fn);
  return templates;
}

function isGenericFunction(fn: FunctionDecl): b8 {
  return (fn.genericParams ?? []).length > 0;
}

class GenericInstantiator {
  private emitted = new Map<Str, FunctionDecl>();

  constructor(private templates: Map<Str, FunctionDecl>) {}

  rewriteFunction(fn: FunctionDecl): FunctionDecl {
    return { ...fn, body: fn.body ? this.rewriteBlock(fn.body) : null };
  }

  instantiations(): FunctionDecl[] {
    return [...this.emitted.values()];
  }

  private instantiateCall(expr: Extract<Expression, { kind: "CallExpr" }>): Expression {
    const typeArgs = expr.typeArgs ?? [];
    if (typeArgs.length === 0) {
      return {
        ...expr,
        args: expr.args.map((arg) => this.rewriteExpr(arg)),
      };
    }
    const template = this.templates.get(expr.callee);
    if (!template) return { ...expr, args: expr.args.map((arg) => this.rewriteExpr(arg)) };
    const name = instantiationName(template.name, typeArgs);
    if (!this.emitted.has(name)) {
      this.emitted.set(name, this.createInstantiation(template, typeArgs, name));
    }
    return {
      ...expr,
      callee: name,
      typeArgs: [],
      args: expr.args.map((arg) => this.rewriteExpr(arg)),
    };
  }

  private createInstantiation(
    template: FunctionDecl,
    typeArgs: TypeRef[],
    name: Str,
  ): FunctionDecl {
    const substitutions = genericSubstitutions(template, typeArgs);
    const body = template.body ? substituteBlock(template.body, substitutions) : null;
    const substituted: FunctionDecl = {
      ...template,
      exported: false,
      external: false,
      name,
      cName: name,
      genericParams: [],
      params: template.params.map((param) => substituteParam(param, substitutions)),
      returnType: substituteTypeRef(template.returnType, substitutions),
      body,
    };
    return this.rewriteFunction(substituted);
  }

  private rewriteBlock(block: BlockStmt): BlockStmt {
    return {
      ...block,
      statements: block.statements.map((statement) => this.rewriteStatement(statement)),
    };
  }

  private rewriteStatement(statement: Statement): Statement {
    switch (statement.kind) {
      case "ReturnStmt":
        return {
          ...statement,
          expression: statement.expression ? this.rewriteExpr(statement.expression) : null,
        };
      case "ExpressionStmt":
        return { ...statement, expression: this.rewriteExpr(statement.expression) };
      case "BreakStmt":
        return statement;
      case "VarDeclStmt":
        return { ...statement, initializer: this.rewriteExpr(statement.initializer) };
      case "AssignmentStmt":
        return { ...statement, expression: this.rewriteExpr(statement.expression) };
      case "SwitchStmt":
        return {
          ...statement,
          expression: this.rewriteExpr(statement.expression),
          cases: statement.cases.map((switchCase) => ({
            ...switchCase,
            labels: switchCase.labels.map((label) => this.rewriteExpr(label)),
            statements: switchCase.statements.map((child) => this.rewriteStatement(child)),
          })),
          defaultCase: statement.defaultCase
            ? {
              ...statement.defaultCase,
              statements: statement.defaultCase.statements.map((child) =>
                this.rewriteStatement(child)
              ),
            }
            : null,
        };
      case "WhileStmt":
        return {
          ...statement,
          condition: this.rewriteExpr(statement.condition),
          body: this.rewriteBlock(statement.body),
        };
      case "IfStmt":
        return {
          ...statement,
          condition: this.rewriteExpr(statement.condition),
          thenBody: this.rewriteBlock(statement.thenBody),
          elseBody: statement.elseBody ? this.rewriteBlock(statement.elseBody) : null,
        };
    }
  }

  private rewriteExpr(expr: Expression): Expression {
    switch (expr.kind) {
      case "IntegerLiteral":
      case "FloatLiteral":
      case "BoolLiteral":
      case "StringLiteral":
      case "IdentifierExpr":
        return expr;
      case "UnaryExpr":
        return { ...expr, operand: this.rewriteExpr(expr.operand) };
      case "BinaryExpr":
        return { ...expr, left: this.rewriteExpr(expr.left), right: this.rewriteExpr(expr.right) };
      case "CallExpr":
        return this.instantiateCall(expr);
      case "MethodCallExpr":
        return {
          ...expr,
          receiver: this.rewriteExpr(expr.receiver),
          args: expr.args.map((arg) => this.rewriteExpr(arg)),
        };
      case "PostfixPointerExpr":
        return { ...expr, operand: this.rewriteExpr(expr.operand) };
      case "FieldAccessExpr":
        return { ...expr, operand: this.rewriteExpr(expr.operand) };
      case "RecordLiteralExpr":
        return {
          ...expr,
          fields: expr.fields.map((field) => ({
            ...field,
            expression: this.rewriteExpr(field.expression),
          })),
        };
      case "ArrayLiteralExpr":
        return { ...expr, elements: expr.elements.map((element) => this.rewriteExpr(element)) };
      case "IndexExpr":
        return {
          ...expr,
          operand: this.rewriteExpr(expr.operand),
          index: this.rewriteExpr(expr.index),
        };
    }
  }
}

function genericSubstitutions(template: FunctionDecl, typeArgs: TypeRef[]): TypeSubstitutions {
  const substitutions = new Map<Str, TypeRef>();
  const params = template.genericParams ?? [];
  for (let index: usize = 0; index < params.length; index += 1) {
    const typeArg = typeArgs[index];
    if (typeArg) substitutions.set(params[index].name, typeArg);
  }
  return substitutions;
}

function substituteBlock(block: BlockStmt, substitutions: TypeSubstitutions): BlockStmt {
  return {
    ...block,
    statements: block.statements.map((statement) => substituteStatement(statement, substitutions)),
  };
}

function substituteStatement(statement: Statement, substitutions: TypeSubstitutions): Statement {
  switch (statement.kind) {
    case "ReturnStmt":
    case "ExpressionStmt":
    case "BreakStmt":
    case "AssignmentStmt":
      return statement;
    case "VarDeclStmt":
      return { ...statement, type: substituteTypeRef(statement.type, substitutions) };
    case "SwitchStmt":
      return {
        ...statement,
        cases: statement.cases.map((switchCase) => ({
          ...switchCase,
          statements: switchCase.statements.map((child) =>
            substituteStatement(child, substitutions)
          ),
        })),
        defaultCase: statement.defaultCase
          ? {
            ...statement.defaultCase,
            statements: statement.defaultCase.statements.map((child) =>
              substituteStatement(child, substitutions)
            ),
          }
          : null,
      };
    case "WhileStmt":
      return { ...statement, body: substituteBlock(statement.body, substitutions) };
    case "IfStmt":
      return {
        ...statement,
        thenBody: substituteBlock(statement.thenBody, substitutions),
        elseBody: statement.elseBody ? substituteBlock(statement.elseBody, substitutions) : null,
      };
  }
}

function substituteParam(param: Param, substitutions: TypeSubstitutions): Param {
  return { ...param, type: substituteTypeRef(param.type, substitutions) };
}

function substituteTypeRef(type: TypeRef, substitutions: TypeSubstitutions): TypeRef {
  switch (type.kind) {
    case "NamedTypeRef":
      return substitutions.get(type.name) ?? type;
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SliceTypeRef":
    case "InferredArrayTypeRef":
      return { ...type, element: substituteTypeRef(type.element, substitutions) };
    case "FixedArrayTypeRef":
      return { ...type, element: substituteTypeRef(type.element, substitutions) };
    case "FunctionTypeRef":
      return {
        ...type,
        params: type.params.map((param) => substituteParam(param, substitutions)),
        returnType: substituteTypeRef(type.returnType, substitutions),
      };
    case "RecordTypeRef":
      return {
        ...type,
        fields: type.fields.map((field) => ({
          ...field,
          type: substituteTypeRef(field.type, substitutions),
        })),
      };
  }
}

function instantiationName(name: Str, typeArgs: TypeRef[]): Str {
  return `${name}_${typeArgs.map(typeArgName).join("_")}`;
}

function typeArgName(typeArg: TypeRef): Str {
  return sanitizeTypeName(typeName(typeArg));
}

function sanitizeTypeName(name: Str): Str {
  return name.replaceAll(/[^A-Za-z0-9_]/g, "_");
}
