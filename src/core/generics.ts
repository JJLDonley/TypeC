import type {
  BlockStmt,
  Expression,
  FunctionDecl,
  Param,
  Program,
  RecordField,
  Statement,
  TypeRef,
} from "core/ast.ts";
import {
  DUPLICATE_GENERIC_PARAMETER,
  GENERIC_CONSTRAINT_INTERFACE,
  GENERIC_CONSTRAINT_NAMED_INTERFACE,
  GENERIC_INSTANTIATION_CYCLE,
  GENERIC_INTERFACE_VALUE_TYPE,
  GENERIC_TYPE_ARGUMENT_ARITY,
  GENERIC_UNKNOWN_TYPE,
  UNKNOWN_GENERIC_FUNCTION,
} from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import { classMethodName } from "core/classes.ts";
import { checkGenericConstraints, type ConstraintContext } from "core/generic_constraints.ts";
import {
  inferGenericCallTypeArgsFromResult,
  inferGenericCallTypeArgsFromTypedArgs,
  inferGenericLocalContextTypeRef,
} from "core/generic_inference.ts";
import { optionalTypeElement } from "core/optional_types.ts";
import { primitiveTypes } from "core/token.ts";
import { typeName } from "core/type_ref.ts";

export type Str = string;
type b8 = boolean;
type usize = number;

const genericBuiltinCalls = new Set<Str>(["Some", "None"]);

type TypeSubstitutions = Map<Str, TypeRef>;

interface KnownConstraintDeclarations {
  typeAliases: Map<Str, TypeRef>;
  enums: NonNullable<Program["enums"]>;
  taggedUnions: NonNullable<Program["taggedUnions"]>;
}

export function instantiateGenerics(program: Program): Program {
  const templates = genericTemplates(program.functions);
  const diagnostics = genericDiagnostics(
    program.functions,
    templates,
    program.interfaces ?? [],
    {
      typeAliases: typeAliasMap(program.typeAliases),
      enums: program.enums ?? [],
      taggedUnions: program.taggedUnions ?? [],
    },
  );
  if (diagnostics.length > 0) throw new TypeCError(diagnostics);
  const ordinary = program.functions.filter((fn) => !isGenericFunction(fn));
  const instantiator = new GenericInstantiator(
    templates,
    {
      interfaces: program.interfaces ?? [],
      functions: program.functions,
      typeAliases: typeAliasMap(program.typeAliases),
    },
    typeAliasMap(program.typeAliases),
  );
  const functions = ordinary.map((fn) => instantiator.rewriteFunction(fn));
  return { ...program, functions: [...functions, ...instantiator.instantiations()] };
}

function genericDiagnostics(
  functions: FunctionDecl[],
  templates: Map<Str, FunctionDecl>,
  interfaces: Program["interfaces"],
  declarations: KnownConstraintDeclarations,
): Diagnostic[] {
  return [
    ...functions.flatMap((fn) => genericParamDiagnostics(fn, interfaces ?? [], declarations)),
    ...functions.flatMap((fn) =>
      genericCallDiagnostics(fn, templates, interfaces ?? [], declarations)
    ),
  ];
}

function genericParamDiagnostics(
  fn: FunctionDecl,
  interfaces: NonNullable<Program["interfaces"]>,
  declarations: KnownConstraintDeclarations,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const names = new Set<Str>();
  for (const param of fn.genericParams ?? []) {
    if (names.has(param.name)) {
      diagnostics.push({
        message: `Duplicate generic parameter '${param.name}'`,
        code: DUPLICATE_GENERIC_PARAMETER,
        span: param.span,
      });
    }
    names.add(param.name);
    diagnostics.push(...genericConstraintDeclarationDiagnostics(param, interfaces, declarations));
  }
  return diagnostics;
}

function genericConstraintDeclarationDiagnostics(
  param: NonNullable<FunctionDecl["genericParams"]>[usize],
  interfaces: NonNullable<Program["interfaces"]>,
  declarations: KnownConstraintDeclarations,
): Diagnostic[] {
  const constraint = param.constraint;
  if (constraint === null || constraint === undefined) return [];
  if (constraint.kind === "LiteralTypeRef" || constraint.kind === "RecordTypeRef") return [];
  if (constraint.kind !== "NamedTypeRef") {
    return [{
      message: `Generic constraint for '${param.name}' must be an interface`,
      code: GENERIC_CONSTRAINT_INTERFACE,
      span: constraint.span,
    }];
  }
  if (interfaces.some((interfaceDecl) => interfaceDecl.name === constraint.name)) return [];
  if (primitiveTypes.has(constraint.name)) return [];
  if (isKnownConstraintName(constraint.name, declarations)) {
    return [{
      message: `Generic constraint '${constraint.name}' must be an interface`,
      code: GENERIC_CONSTRAINT_NAMED_INTERFACE,
      span: constraint.span,
    }];
  }
  return [{
    message: `Unknown type '${constraint.name}'`,
    code: GENERIC_UNKNOWN_TYPE,
    span: constraint.span,
  }];
}

function isKnownConstraintName(name: Str, declarations: KnownConstraintDeclarations): b8 {
  return primitiveTypes.has(name) || declarations.typeAliases.has(name) ||
    hasEnumName(name, declarations.enums) || hasTaggedUnionName(name, declarations.taggedUnions);
}

function hasEnumName(name: Str, enums: NonNullable<Program["enums"]>): b8 {
  return enums.some((enumDecl) => enumDecl.name === name);
}

function hasTaggedUnionName(name: Str, taggedUnions: NonNullable<Program["taggedUnions"]>): b8 {
  return taggedUnions.some((unionDecl) => unionDecl.name === name);
}

interface GenericDiagnosticContext {
  templates: Map<Str, FunctionDecl>;
  interfaces: NonNullable<Program["interfaces"]>;
  declarations: KnownConstraintDeclarations;
}

function genericCallDiagnostics(
  fn: FunctionDecl,
  templates: Map<Str, FunctionDecl>,
  interfaces: NonNullable<Program["interfaces"]>,
  declarations: KnownConstraintDeclarations,
): Diagnostic[] {
  if (!fn.body) return [];
  return statementListGenericCallDiagnostics(fn.body.statements, {
    templates,
    interfaces,
    declarations,
  });
}

function statementListGenericCallDiagnostics(
  statements: Statement[],
  context: GenericDiagnosticContext,
): Diagnostic[] {
  return statements.flatMap((statement) => statementGenericCallDiagnostics(statement, context));
}

function statementGenericCallDiagnostics(
  statement: Statement,
  context: GenericDiagnosticContext,
): Diagnostic[] {
  switch (statement.kind) {
    case "EmptyStmt":
      return [];
    case "ReturnStmt":
      return statement.expression
        ? expressionGenericCallDiagnostics(statement.expression, context)
        : [];
    case "DeferStmt":
      return expressionGenericCallDiagnostics(statement.expression, context);
    case "ExpressionStmt":
      return expressionGenericCallDiagnostics(statement.expression, context);
    case "BreakStmt":
    case "ContinueStmt":
      return [];
    case "VarDeclStmt":
      return expressionGenericCallDiagnostics(statement.initializer, context);
    case "RecordRestStmt":
      return expressionGenericCallDiagnostics(statement.source, context);
    case "ArrayDestructureStmt":
      return expressionGenericCallDiagnostics(statement.source, context);
    case "AssignmentStmt":
      return [
        ...expressionGenericCallDiagnostics(statement.target, context),
        ...expressionGenericCallDiagnostics(statement.expression, context),
      ];
    case "IncDecStmt":
      return expressionGenericCallDiagnostics(statement.target, context);
    case "SwitchStmt":
      return [
        ...expressionGenericCallDiagnostics(statement.expression, context),
        ...statement.cases.flatMap((switchCase) => [
          ...switchCase.labels.flatMap((label) => expressionGenericCallDiagnostics(label, context)),
          ...statementListGenericCallDiagnostics(switchCase.statements, context),
        ]),
        ...(statement.defaultCase
          ? statementListGenericCallDiagnostics(statement.defaultCase.statements, context)
          : []),
      ];
    case "WhileStmt":
      return [
        ...expressionGenericCallDiagnostics(statement.condition, context),
        ...statementListGenericCallDiagnostics(statement.body.statements, context),
      ];
    case "DoWhileStmt":
      return [
        ...statementListGenericCallDiagnostics(statement.body.statements, context),
        ...expressionGenericCallDiagnostics(statement.condition, context),
      ];
    case "ForStmt":
      return [
        ...(statement.initializer
          ? statementGenericCallDiagnostics(statement.initializer, context)
          : []),
        ...expressionGenericCallDiagnostics(statement.condition, context),
        ...(statement.update ? statementGenericCallDiagnostics(statement.update, context) : []),
        ...statementListGenericCallDiagnostics(statement.body.statements, context),
      ];
    case "ForOfStmt":
    case "ForInStmt":
      return [
        ...expressionGenericCallDiagnostics(statement.iterable, context),
        ...statementListGenericCallDiagnostics(statement.body.statements, context),
      ];
    case "IfStmt":
      return [
        ...expressionGenericCallDiagnostics(statement.condition, context),
        ...statementListGenericCallDiagnostics(statement.thenBody.statements, context),
        ...(statement.elseBody
          ? statementListGenericCallDiagnostics(statement.elseBody.statements, context)
          : []),
      ];
  }
}

function expressionGenericCallDiagnostics(
  expr: Expression,
  context: GenericDiagnosticContext,
): Diagnostic[] {
  switch (expr.kind) {
    case "IntegerLiteral":
    case "FloatLiteral":
    case "BoolLiteral":
    case "StringLiteral":
    case "ZeroValueExpr":
    case "IdentifierExpr":
      return [];
    case "ArrowFunctionExpr":
      return expressionGenericCallDiagnostics(expr.body, context);
    case "UnaryExpr":
      return expressionGenericCallDiagnostics(expr.operand, context);
    case "BinaryExpr":
      return [
        ...expressionGenericCallDiagnostics(expr.left, context),
        ...expressionGenericCallDiagnostics(expr.right, context),
      ];
    case "ConditionalExpr":
      return [
        ...expressionGenericCallDiagnostics(expr.condition, context),
        ...expressionGenericCallDiagnostics(expr.whenTrue, context),
        ...expressionGenericCallDiagnostics(expr.whenFalse, context),
      ];
    case "NullishCoalesceExpr":
      return [
        ...expressionGenericCallDiagnostics(expr.left, context),
        ...expressionGenericCallDiagnostics(expr.fallback, context),
      ];
    case "CastExpr":
    case "SatisfiesExpr":
      return expressionGenericCallDiagnostics(expr.expression, context);
    case "CallExpr":
      return [
        ...genericCallArityDiagnostics(expr, context.templates),
        ...explicitGenericCallTypeArgDiagnostics(expr, context),
        ...expr.args.flatMap((arg) => expressionGenericCallDiagnostics(arg, context)),
      ];
    case "NewExpr":
      return expr.args.flatMap((arg) => expressionGenericCallDiagnostics(arg, context));
    case "MethodCallExpr":
      return [
        ...expressionGenericCallDiagnostics(expr.receiver, context),
        ...expr.args.flatMap((arg) => expressionGenericCallDiagnostics(arg, context)),
      ];
    case "PostfixPointerExpr":
    case "NonNullAssertExpr":
      return expressionGenericCallDiagnostics(expr.operand, context);
    case "FieldAccessExpr":
    case "OptionalFieldAccessExpr":
      return expressionGenericCallDiagnostics(expr.operand, context);
    case "OptionalMethodCallExpr":
      return [
        ...expressionGenericCallDiagnostics(expr.receiver, context),
        ...expr.args.flatMap((arg) => expressionGenericCallDiagnostics(arg, context)),
      ];
    case "OptionalIndexExpr":
      return [
        ...expressionGenericCallDiagnostics(expr.operand, context),
        ...expressionGenericCallDiagnostics(expr.index, context),
      ];
    case "RecordLiteralExpr":
      return expr.fields.flatMap((field) =>
        expressionGenericCallDiagnostics(field.expression, context)
      );
    case "ArrayLiteralExpr":
      return expr.elements.flatMap((element) => expressionGenericCallDiagnostics(element, context));
    case "IndexExpr":
      return [
        ...expressionGenericCallDiagnostics(expr.operand, context),
        ...expressionGenericCallDiagnostics(expr.index, context),
      ];
  }
}

function explicitGenericCallTypeArgDiagnostics(
  expr: Extract<Expression, { kind: "CallExpr" }>,
  context: GenericDiagnosticContext,
): Diagnostic[] {
  if ((expr.typeArgs ?? []).length === 0 || genericBuiltinCalls.has(expr.callee)) return [];
  if (!context.templates.has(expr.callee)) return [];
  return (expr.typeArgs ?? []).flatMap((typeArg) =>
    explicitGenericTypeArgDiagnostics(typeArg, context)
  );
}

function explicitGenericTypeArgDiagnostics(
  typeArg: TypeRef,
  context: GenericDiagnosticContext,
): Diagnostic[] {
  if (typeArg.kind !== "NamedTypeRef") return [];
  if (context.interfaces.some((interfaceDecl) => interfaceDecl.name === typeArg.name)) {
    return [{
      message: `Interface value type '${typeArg.name}' is not implemented`,
      code: GENERIC_INTERFACE_VALUE_TYPE,
      span: typeArg.span,
    }];
  }
  if (isKnownExplicitGenericTypeArg(typeArg.name, context.declarations)) return [];
  return [{
    message: `Unknown type '${typeArg.name}'`,
    code: GENERIC_UNKNOWN_TYPE,
    span: typeArg.span,
  }];
}

function isKnownExplicitGenericTypeArg(name: Str, declarations: KnownConstraintDeclarations): b8 {
  return primitiveTypes.has(name) || declarations.typeAliases.has(name) ||
    hasEnumName(name, declarations.enums) || hasTaggedUnionName(name, declarations.taggedUnions);
}

function genericCallArityDiagnostics(
  expr: Extract<Expression, { kind: "CallExpr" }>,
  templates: Map<Str, FunctionDecl>,
): Diagnostic[] {
  const typeArgs = expr.typeArgs ?? [];
  if (typeArgs.length === 0 || genericBuiltinCalls.has(expr.callee)) return [];
  const template = templates.get(expr.callee);
  if (!template) {
    return [{
      message: `Unknown generic function '${expr.callee}'`,
      code: UNKNOWN_GENERIC_FUNCTION,
      span: expr.span,
    }];
  }
  const expected = template.genericParams?.length ?? 0;
  if (typeArgs.length === expected) return [];
  return [{
    message: `Generic function '${expr.callee}' expects ${expected} type argument(s)`,
    code: GENERIC_TYPE_ARGUMENT_ARITY,
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
  private active = new Set<Str>();
  private functions: Map<Str, FunctionDecl>;

  constructor(
    private templates: Map<Str, FunctionDecl>,
    private constraints: ConstraintContext,
    private aliases: Map<Str, TypeRef>,
  ) {
    this.functions = new Map(constraints.functions.map((fn) => [fn.name, fn]));
  }

  rewriteFunction(fn: FunctionDecl): FunctionDecl {
    const locals = localTypeMap(fn.params);
    return { ...fn, body: fn.body ? this.rewriteBlock(fn.body, fn.returnType, locals) : null };
  }

  instantiations(): FunctionDecl[] {
    return [...this.emitted.values()];
  }

  private instantiateCall(
    expr: Extract<Expression, { kind: "CallExpr" }>,
    inferredTypeArgs: TypeRef[] | null = null,
    locals: Map<Str, TypeRef> = new Map(),
  ): Expression {
    const typeArgs = callTypeArgs(
      expr,
      inferredTypeArgs ?? this.inferCallTypeArgsFromArgs(expr, locals),
    );
    if (typeArgs.length === 0) {
      return { ...expr, args: this.rewriteCallArgs(expr.callee, expr.args, locals) };
    }
    const template = this.templates.get(expr.callee);
    if (!template) return { ...expr, args: this.rewriteCallArgs(expr.callee, expr.args, locals) };
    this.checkConstraints(template, typeArgs, expr.span);
    const name = instantiationName(template.name, typeArgs);
    if (!this.emitted.has(name)) {
      this.checkInstantiationCycle(template.name, name, expr.span);
      this.active.add(name);
      try {
        const instantiation = this.createInstantiation(template, typeArgs, name);
        this.emitted.set(name, instantiation);
        this.functions.set(name, instantiation);
      } finally {
        this.active.delete(name);
      }
    }
    return {
      ...expr,
      callee: name,
      typeArgs: [],
      args: this.rewriteCallArgs(name, expr.args, locals),
    };
  }

  private checkInstantiationCycle(
    templateName: Str,
    name: Str,
    span: Expression["span"],
  ): void {
    if (!this.active.has(name)) return;
    throw new TypeCError([{
      message: `Recursive generic instantiation cycle involving function '${templateName}'`,
      code: GENERIC_INSTANTIATION_CYCLE,
      span,
    }]);
  }

  private checkConstraints(
    template: FunctionDecl,
    typeArgs: TypeRef[],
    span: Expression["span"],
  ): void {
    const diagnostics = checkGenericConstraints(
      template.genericParams ?? [],
      typeArgs,
      this.constraints,
      span,
      { kind: "function", name: template.name },
    );
    if (diagnostics.length > 0) throw new TypeCError(diagnostics);
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

  private rewriteBlock(
    block: BlockStmt,
    returnType: TypeRef,
    locals: Map<Str, TypeRef>,
  ): BlockStmt {
    const scoped = new Map(locals);
    return { ...block, statements: this.rewriteStatements(block.statements, returnType, scoped) };
  }

  private rewriteStatements(
    statements: Statement[],
    returnType: TypeRef,
    locals: Map<Str, TypeRef>,
  ): Statement[] {
    const scoped = new Map(locals);
    return statements.map((statement) => this.rewriteStatement(statement, returnType, scoped));
  }

  private rewriteStatement(
    statement: Statement,
    returnType: TypeRef,
    locals: Map<Str, TypeRef>,
  ): Statement {
    switch (statement.kind) {
      case "EmptyStmt":
        return statement;
      case "ReturnStmt":
        return {
          ...statement,
          expression: statement.expression
            ? this.rewriteExprWithExpectedType(statement.expression, returnType, locals)
            : null,
        };
      case "DeferStmt":
        return { ...statement, expression: this.rewriteExpr(statement.expression, locals) };
      case "ExpressionStmt":
        return { ...statement, expression: this.rewriteExpr(statement.expression, locals) };
      case "BreakStmt":
      case "ContinueStmt":
        return statement;
      case "VarDeclStmt": {
        const rewritten = {
          ...statement,
          initializer: this.rewriteExprWithExpectedType(
            statement.initializer,
            statement.type,
            locals,
          ),
        };
        const localType = statement.type ??
          localContextType(rewritten.initializer, this.functions);
        if (localType !== null) locals.set(statement.name, localType);
        return rewritten;
      }
      case "RecordRestStmt":
        return { ...statement, source: this.rewriteExpr(statement.source, locals) };
      case "ArrayDestructureStmt":
        return { ...statement, source: this.rewriteExpr(statement.source, locals) };
      case "AssignmentStmt": {
        const target = this.rewriteExpr(statement.target, locals) as typeof statement.target;
        return {
          ...statement,
          target,
          expression: this.rewriteExprWithExpectedType(
            statement.expression,
            assignmentTargetType(target, locals, this.aliases),
            locals,
          ),
        };
      }
      case "IncDecStmt":
        return {
          ...statement,
          target: this.rewriteExpr(statement.target, locals) as typeof statement.target,
        };
      case "SwitchStmt":
        return {
          ...statement,
          expression: this.rewriteExpr(statement.expression, locals),
          cases: statement.cases.map((switchCase) => ({
            ...switchCase,
            labels: switchCase.labels.map((label) => this.rewriteExpr(label, locals)),
            statements: this.rewriteStatements(switchCase.statements, returnType, locals),
          })),
          defaultCase: statement.defaultCase
            ? {
              ...statement.defaultCase,
              statements: this.rewriteStatements(
                statement.defaultCase.statements,
                returnType,
                locals,
              ),
            }
            : null,
        };
      case "WhileStmt":
        return {
          ...statement,
          condition: this.rewriteExpr(statement.condition, locals),
          body: this.rewriteBlock(statement.body, returnType, locals),
        };
      case "DoWhileStmt":
        return {
          ...statement,
          body: this.rewriteBlock(statement.body, returnType, locals),
          condition: this.rewriteExpr(statement.condition, locals),
        };
      case "ForStmt": {
        const scoped = new Map(locals);
        return {
          ...statement,
          initializer: statement.initializer
            ? this.rewriteStatement(
              statement.initializer,
              returnType,
              scoped,
            ) as typeof statement.initializer
            : null,
          condition: this.rewriteExpr(statement.condition, scoped),
          update: statement.update
            ? this.rewriteStatement(statement.update, returnType, scoped) as typeof statement.update
            : null,
          body: this.rewriteBlock(statement.body, returnType, scoped),
        };
      }
      case "ForOfStmt":
      case "ForInStmt":
        return {
          ...statement,
          iterable: this.rewriteExpr(statement.iterable, locals),
          body: this.rewriteBlock(statement.body, returnType, locals),
        };
      case "IfStmt":
        return {
          ...statement,
          condition: this.rewriteExpr(statement.condition, locals),
          thenBody: this.rewriteBlock(statement.thenBody, returnType, locals),
          elseBody: statement.elseBody
            ? this.rewriteBlock(statement.elseBody, returnType, locals)
            : null,
        };
    }
  }

  private rewriteExprWithExpectedType(
    expr: Expression,
    expected: TypeRef | null,
    locals: Map<Str, TypeRef>,
  ): Expression {
    if (expected === null) return this.rewriteExpr(expr, locals);
    if (expr.kind === "CallExpr") {
      const typeArgs = this.inferCallTypeArgsFromResult(expr, expected);
      return this.instantiateCall(expr, typeArgs, locals);
    }
    if (expr.kind === "RecordLiteralExpr") {
      return this.rewriteRecordLiteralWithExpectedType(expr, expected, locals);
    }
    if (expr.kind === "ArrayLiteralExpr") {
      return this.rewriteArrayLiteralWithExpectedType(expr, expected, locals);
    }
    if (expr.kind === "ConditionalExpr") {
      return this.rewriteConditionalWithExpectedType(expr, expected, locals);
    }
    return this.rewriteExpr(expr, locals);
  }

  private rewriteConditionalWithExpectedType(
    expr: Extract<Expression, { kind: "ConditionalExpr" }>,
    expected: TypeRef,
    locals: Map<Str, TypeRef>,
  ): Expression {
    return {
      ...expr,
      condition: this.rewriteExpr(expr.condition, locals),
      whenTrue: this.rewriteExprWithExpectedType(expr.whenTrue, expected, locals),
      whenFalse: this.rewriteExprWithExpectedType(expr.whenFalse, expected, locals),
    };
  }

  private rewriteRecordLiteralWithExpectedType(
    expr: Extract<Expression, { kind: "RecordLiteralExpr" }>,
    expected: TypeRef,
    locals: Map<Str, TypeRef>,
  ): Expression {
    const record = expectedRecordType(expected, this.aliases);
    if (record === null) return this.rewriteExpr(expr, locals);
    return {
      ...expr,
      fields: expr.fields.map((field) => {
        if (field.kind === "Spread") {
          return { ...field, expression: this.rewriteExpr(field.expression, locals) };
        }
        return {
          ...field,
          expression: this.rewriteExprWithExpectedType(
            field.expression,
            record.fields.find((candidate) => candidate.name === field.name)?.type ?? null,
            locals,
          ),
        };
      }),
    };
  }

  private rewriteArrayLiteralWithExpectedType(
    expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>,
    expected: TypeRef,
    locals: Map<Str, TypeRef>,
  ): Expression {
    return {
      ...expr,
      elements: expr.elements.map((item, index) =>
        this.rewriteExprWithExpectedType(item, expectedElementType(expected, index), locals)
      ),
    };
  }

  private rewriteCallArgs(
    callee: Str,
    args: Expression[],
    locals: Map<Str, TypeRef>,
  ): Expression[] {
    const fn = this.functions.get(callee) ?? null;
    return args.map((arg, index) =>
      this.rewriteExprWithExpectedType(arg, fn?.params[index]?.type ?? null, locals)
    );
  }

  private inferCallTypeArgsFromResult(
    expr: Extract<Expression, { kind: "CallExpr" }>,
    expected: TypeRef,
  ): TypeRef[] | null {
    if ((expr.typeArgs ?? []).length > 0) return null;
    const template = this.templates.get(expr.callee) ?? null;
    if (template === null) return null;
    return inferGenericCallTypeArgsFromResult(template, expected);
  }

  private inferCallTypeArgsFromArgs(
    expr: Extract<Expression, { kind: "CallExpr" }>,
    locals: Map<Str, TypeRef>,
  ): TypeRef[] | null {
    if ((expr.typeArgs ?? []).length > 0) return null;
    const template = this.templates.get(expr.callee) ?? null;
    if (template === null) return null;
    return inferGenericCallTypeArgsFromTypedArgs(
      template,
      expr.args,
      (arg) => argumentType(arg, locals, this.aliases, this.functions),
    );
  }

  private rewriteMethodCall(
    expr: Extract<Expression, { kind: "MethodCallExpr" }>,
    locals: Map<Str, TypeRef>,
  ): Expression {
    return {
      ...expr,
      receiver: this.rewriteExpr(expr.receiver, locals),
      args: expr.args.map((arg, index) =>
        this.rewriteExprWithExpectedType(arg, this.methodParamType(expr, index, locals), locals)
      ),
    };
  }

  private methodParamType(
    expr: Extract<Expression, { kind: "MethodCallExpr" }>,
    index: usize,
    locals: Map<Str, TypeRef>,
  ): TypeRef | null {
    const namespaceParam = namespaceMethodParamType(expr, index, locals, this.functions);
    if (namespaceParam !== null) return namespaceParam;
    const receiver = assignmentTargetType(expr.receiver, locals, this.aliases);
    if (receiver?.kind !== "NamedTypeRef") return null;
    return this.functions.get(classMethodName(receiver.name, expr.method))?.params[index + 1]
      ?.type ?? null;
  }

  private rewriteNullishCoalesce(
    expr: Extract<Expression, { kind: "NullishCoalesceExpr" }>,
    locals: Map<Str, TypeRef>,
  ): Expression {
    return {
      ...expr,
      left: this.rewriteExpr(expr.left, locals),
      fallback: this.rewriteExprWithExpectedType(
        expr.fallback,
        nullishFallbackType(expr.left, locals, this.aliases),
        locals,
      ),
    };
  }

  private rewriteExpr(expr: Expression, locals: Map<Str, TypeRef>): Expression {
    switch (expr.kind) {
      case "IntegerLiteral":
      case "FloatLiteral":
      case "BoolLiteral":
      case "StringLiteral":
      case "ZeroValueExpr":
      case "IdentifierExpr":
        return expr;
      case "ArrowFunctionExpr":
        return { ...expr, body: this.rewriteExpr(expr.body, locals) };
      case "UnaryExpr":
        return { ...expr, operand: this.rewriteExpr(expr.operand, locals) };
      case "BinaryExpr":
        return {
          ...expr,
          left: this.rewriteExpr(expr.left, locals),
          right: this.rewriteExpr(expr.right, locals),
        };
      case "ConditionalExpr":
        return {
          ...expr,
          condition: this.rewriteExpr(expr.condition, locals),
          whenTrue: this.rewriteExpr(expr.whenTrue, locals),
          whenFalse: this.rewriteExpr(expr.whenFalse, locals),
        };
      case "NullishCoalesceExpr":
        return this.rewriteNullishCoalesce(expr, locals);
      case "CastExpr":
      case "SatisfiesExpr":
        return { ...expr, expression: this.rewriteExpr(expr.expression, locals) };
      case "CallExpr":
        return this.instantiateCall(expr, null, locals);
      case "NewExpr":
        return { ...expr, args: expr.args.map((arg) => this.rewriteExpr(arg, locals)) };
      case "MethodCallExpr":
        return this.rewriteMethodCall(expr, locals);
      case "PostfixPointerExpr":
      case "NonNullAssertExpr":
        return { ...expr, operand: this.rewriteExpr(expr.operand, locals) };
      case "FieldAccessExpr":
      case "OptionalFieldAccessExpr":
        return { ...expr, operand: this.rewriteExpr(expr.operand, locals) };
      case "OptionalMethodCallExpr":
        return {
          ...expr,
          receiver: this.rewriteExpr(expr.receiver, locals),
          args: expr.args.map((arg) => this.rewriteExpr(arg, locals)),
        };
      case "OptionalIndexExpr":
        return {
          ...expr,
          operand: this.rewriteExpr(expr.operand, locals),
          index: this.rewriteExpr(expr.index, locals),
        };
      case "RecordLiteralExpr":
        return {
          ...expr,
          fields: expr.fields.map((field) => ({
            ...field,
            expression: this.rewriteExpr(field.expression, locals),
          })),
        };
      case "ArrayLiteralExpr":
        return {
          ...expr,
          elements: expr.elements.map((element) => this.rewriteExpr(element, locals)),
        };
      case "IndexExpr":
        return {
          ...expr,
          operand: this.rewriteExpr(expr.operand, locals),
          index: this.rewriteExpr(expr.index, locals),
        };
    }
  }
}

function typeAliasMap(aliases: Program["typeAliases"]): Map<Str, TypeRef> {
  return new Map(aliases.map((alias) => [alias.name, alias.type]));
}

function localTypeMap(params: Param[]): Map<Str, TypeRef> {
  return new Map(params.map((param) => [param.name, param.type]));
}

function localContextType(
  expr: Expression,
  functions: Map<Str, FunctionDecl>,
): TypeRef | null {
  if (expr.kind === "IdentifierExpr") return functionTypeRef(functions.get(expr.name) ?? null);
  if (expr.kind === "CallExpr") return functions.get(expr.callee)?.returnType ?? null;
  if (expr.kind === "NewExpr") {
    return { kind: "NamedTypeRef", name: expr.className, span: expr.span };
  }
  if (expr.kind === "RecordLiteralExpr") {
    return localRecordContextType(expr, functions) ?? inferGenericLocalContextTypeRef(expr);
  }
  if (expr.kind === "ArrayLiteralExpr") {
    return localArrayContextType(expr, functions) ?? inferGenericLocalContextTypeRef(expr);
  }
  return inferGenericLocalContextTypeRef(expr);
}

function localArrayContextType(
  expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>,
  functions: Map<Str, FunctionDecl>,
): TypeRef | null {
  if (expr.elements.length === 0) return null;
  const first = localContextType(expr.elements[0]!, functions);
  if (first === null) return null;
  for (const element of expr.elements.slice(1)) {
    const type = localContextType(element, functions);
    if (type === null || typeName(type) !== typeName(first)) return null;
  }
  return {
    kind: "FixedArrayTypeRef",
    element: first,
    sizeText: `${expr.elements.length}`,
    span: expr.span,
  };
}

function localRecordContextType(
  expr: Extract<Expression, { kind: "RecordLiteralExpr" }>,
  functions: Map<Str, FunctionDecl>,
): TypeRef | null {
  const fields: RecordField[] = [];
  for (const field of expr.fields) {
    if (field.kind === "Spread") return null;
    const type = localContextType(field.expression, functions);
    if (type === null) return null;
    fields.push({ name: field.name, type, span: field.span });
  }
  return { kind: "RecordTypeRef", fields, span: expr.span };
}

function namespaceMethodParamType(
  expr: Extract<Expression, { kind: "MethodCallExpr" }>,
  index: usize,
  locals: Map<Str, TypeRef>,
  functions: Map<Str, FunctionDecl>,
): TypeRef | null {
  if (expr.receiver.kind !== "IdentifierExpr") return null;
  if (locals.has(expr.receiver.name)) return null;
  return functions.get(`${expr.receiver.name}.${expr.method}`)?.params[index]?.type ?? null;
}

function nullishFallbackType(
  left: Expression,
  locals: Map<Str, TypeRef>,
  aliases: Map<Str, TypeRef>,
): TypeRef | null {
  const type = assignmentTargetType(left, locals, aliases);
  return type === null ? null : optionalTypeElement(type);
}

function assignmentTargetType(
  target: Expression,
  locals: Map<Str, TypeRef>,
  aliases: Map<Str, TypeRef>,
): TypeRef | null {
  if (target.kind === "IdentifierExpr") return locals.get(target.name) ?? null;
  if (target.kind === "FieldAccessExpr") return fieldTargetType(target, locals, aliases);
  if (target.kind === "IndexExpr") return indexTargetType(target, locals, aliases);
  return null;
}

function indexTargetType(
  target: Extract<Expression, { kind: "IndexExpr" }>,
  locals: Map<Str, TypeRef>,
  aliases: Map<Str, TypeRef>,
): TypeRef | null {
  const operand = assignmentTargetType(target.operand, locals, aliases);
  return operand === null ? null : indexedElementType(operand, target.index);
}

function fieldTargetType(
  target: Extract<Expression, { kind: "FieldAccessExpr" }>,
  locals: Map<Str, TypeRef>,
  aliases: Map<Str, TypeRef>,
): TypeRef | null {
  const record = recordTargetType(target.operand, locals, aliases);
  return record?.fields.find((field) => field.name === target.field)?.type ?? null;
}

function recordTargetType(
  target: Expression,
  locals: Map<Str, TypeRef>,
  aliases: Map<Str, TypeRef>,
): Extract<TypeRef, { kind: "RecordTypeRef" }> | null {
  const targetType = assignmentTargetType(target, locals, aliases);
  if (targetType === null) return null;
  return expectedRecordType(targetType, aliases);
}

function expectedRecordType(
  type: TypeRef,
  aliases: Map<Str, TypeRef>,
): Extract<TypeRef, { kind: "RecordTypeRef" }> | null {
  if (type.kind === "RecordTypeRef") return type;
  if (type.kind !== "NamedTypeRef") return null;
  const alias = aliases.get(type.name) ?? null;
  return alias?.kind === "RecordTypeRef" ? alias : null;
}

function expectedElementType(type: TypeRef, index: usize): TypeRef | null {
  if (type.kind === "TupleTypeRef") return type.elements[index] ?? null;
  return expectedArrayElementType(type);
}

function indexedElementType(type: TypeRef, index: Expression): TypeRef | null {
  if (type.kind !== "TupleTypeRef") return expectedArrayElementType(type);
  if (index.kind !== "IntegerLiteral") return null;
  if (index.value < 0n || index.value >= BigInt(type.elements.length)) return null;
  return type.elements[Number(index.value)] ?? null;
}

function expectedArrayElementType(type: TypeRef): TypeRef | null {
  switch (type.kind) {
    case "FixedArrayTypeRef":
    case "InferredArrayTypeRef":
    case "SliceTypeRef":
      return type.element;
    default:
      return null;
  }
}

function argumentType(
  expr: Expression,
  locals: Map<Str, TypeRef>,
  aliases: Map<Str, TypeRef>,
  functions: Map<Str, FunctionDecl>,
): TypeRef | null {
  if (expr.kind === "IdentifierExpr") {
    return locals.get(expr.name) ?? functionTypeRef(functions.get(expr.name) ?? null);
  }
  if (expr.kind === "FieldAccessExpr") return fieldTargetType(expr, locals, aliases);
  if (expr.kind === "IndexExpr") return indexTargetType(expr, locals, aliases);
  if (expr.kind === "CallExpr") return functions.get(expr.callee)?.returnType ?? null;
  if (expr.kind === "NonNullAssertExpr") {
    return nonNullAssertTargetType(expr, locals, aliases, functions);
  }
  if (expr.kind === "PostfixPointerExpr") {
    return postfixPointerArgumentType(expr, locals, aliases, functions);
  }
  return null;
}

function nonNullAssertTargetType(
  expr: Extract<Expression, { kind: "NonNullAssertExpr" }>,
  locals: Map<Str, TypeRef>,
  aliases: Map<Str, TypeRef>,
  functions: Map<Str, FunctionDecl>,
): TypeRef | null {
  const operand = argumentOperandType(expr.operand, locals, aliases, functions);
  return operand === null ? null : optionalTypeElement(operand);
}

function postfixPointerArgumentType(
  expr: Extract<Expression, { kind: "PostfixPointerExpr" }>,
  locals: Map<Str, TypeRef>,
  aliases: Map<Str, TypeRef>,
  functions: Map<Str, FunctionDecl>,
): TypeRef | null {
  const operand = argumentOperandType(expr.operand, locals, aliases, functions);
  if (operand === null) return null;
  if (expr.operator === ".&") {
    return { kind: "ReferenceTypeRef", element: operand, span: expr.span };
  }
  return pointerLikeElementType(operand);
}

function argumentOperandType(
  expr: Expression,
  locals: Map<Str, TypeRef>,
  aliases: Map<Str, TypeRef>,
  functions: Map<Str, FunctionDecl>,
): TypeRef | null {
  return assignmentTargetType(expr, locals, aliases) ??
    argumentType(expr, locals, aliases, functions);
}

function pointerLikeElementType(type: TypeRef): TypeRef | null {
  switch (type.kind) {
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
      return type.element;
    default:
      return null;
  }
}

function functionTypeRef(fn: FunctionDecl | null): TypeRef | null {
  if (fn === null) return null;
  return {
    kind: "FunctionTypeRef",
    params: fn.params,
    returnType: fn.returnType,
    span: fn.span,
  };
}

function callTypeArgs(
  expr: Extract<Expression, { kind: "CallExpr" }>,
  inferredTypeArgs: TypeRef[] | null,
): TypeRef[] {
  const explicit = expr.typeArgs ?? [];
  if (explicit.length > 0) return explicit;
  return inferredTypeArgs ?? [];
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
    case "EmptyStmt":
      return statement;
    case "ReturnStmt":
    case "DeferStmt":
    case "ExpressionStmt":
    case "BreakStmt":
    case "ContinueStmt":
    case "AssignmentStmt":
    case "IncDecStmt":
      return statement;
    case "VarDeclStmt":
      return {
        ...statement,
        type: statement.type ? substituteTypeRef(statement.type, substitutions) : null,
      };
    case "RecordRestStmt":
    case "ArrayDestructureStmt":
      return statement;
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
    case "DoWhileStmt":
      return { ...statement, body: substituteBlock(statement.body, substitutions) };
    case "ForStmt":
      return {
        ...statement,
        initializer: statement.initializer
          ? substituteStatement(
            statement.initializer,
            substitutions,
          ) as typeof statement.initializer
          : null,
        update: statement.update
          ? substituteStatement(statement.update, substitutions) as typeof statement.update
          : null,
        body: substituteBlock(statement.body, substitutions),
      };
    case "ForOfStmt":
    case "ForInStmt":
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
    case "NamedTypeRef": {
      const substituted = substitutions.get(type.name) ?? null;
      if (substituted !== null) return substituted;
      const typeArgs = type.typeArgs?.map((typeArg) => substituteTypeRef(typeArg, substitutions));
      return typeArgs === undefined ? type : { ...type, typeArgs };
    }
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
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
    case "TupleTypeRef":
      return {
        ...type,
        elements: type.elements.map((element) => substituteTypeRef(element, substitutions)),
      };
    case "UnionTypeRef":
      return {
        ...type,
        members: type.members.map((member) => substituteTypeRef(member, substitutions)),
      };
    case "IntersectionTypeRef":
      return {
        ...type,
        members: type.members.map((member) => substituteTypeRef(member, substitutions)),
      };
    case "ConditionalTypeRef":
      return {
        ...type,
        checkType: substituteTypeRef(type.checkType, substitutions),
        extendsType: substituteTypeRef(type.extendsType, substitutions),
        trueType: substituteTypeRef(type.trueType, substitutions),
        falseType: substituteTypeRef(type.falseType, substitutions),
      };
    case "IndexedAccessTypeRef":
      return { ...type, objectType: substituteTypeRef(type.objectType, substitutions) };
    case "MappedTypeRef":
      return {
        ...type,
        sourceType: substituteTypeRef(type.sourceType, substitutions),
        valueType: substituteTypeRef(type.valueType, substitutions),
      };
    case "LiteralTypeRef":
    case "TypeofTypeRef":
      return type;
    case "KeyofTypeRef":
      return { ...type, target: substituteTypeRef(type.target, substitutions) };
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
