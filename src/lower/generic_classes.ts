import type {
  CastArrayLiteralExpr,
  CastAssignmentStmt,
  CastBinaryExpr,
  CastBlockStmt,
  CastCallExpr,
  CastClassDecl,
  CastConditionalExpr,
  CastConstDecl,
  CastDoWhileStmt,
  CastExpression,
  CastForStmt,
  CastFunctionDecl,
  CastFunctionTypeRef,
  CastIfStmt,
  CastImportDecl,
  CastIndexExpr,
  CastInterfaceDecl,
  CastMethodCallExpr,
  CastNewExpr,
  CastNonNullAssertExpr,
  CastNullishCoalesceExpr,
  CastOptionalFieldAccessExpr,
  CastOptionalIndexExpr,
  CastOptionalMethodCallExpr,
  CastParam,
  CastPostfixPointerExpr,
  CastProgram,
  CastRecordLiteralExpr,
  CastRecordTypeRef,
  CastReturnStmt,
  CastStatement,
  CastSwitchStmt,
  CastTaggedUnionDecl,
  CastTypeAliasDecl,
  CastTypeRef,
  CastUnaryExpr,
  CastVarDeclStmt,
  CastWhileStmt,
} from "core/cast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import { typeName } from "core/type_ref.ts";
import { lowerTypeRef } from "lower/types.ts";

export type Str = string;
type b8 = boolean;
type usize = number;

type CastTypeSubstitutions = Map<Str, CastTypeRef>;

export function instantiateGenericClasses(program: CastProgram): CastProgram {
  const templates = genericClassTemplates(program.classes ?? []);
  const diagnostics = genericClassParamDiagnostics(program.classes ?? []);
  if (diagnostics.length > 0) throw new TypeCError(diagnostics);
  const concrete = concreteClassTemplates(program.classes ?? []);
  const instantiator = new GenericClassInstantiator(templates, concrete, program.interfaces ?? []);
  const rewritten = templates.size === 0 ? program : instantiator.rewriteProgram(program);
  const inheritance = resolveClassInheritance(rewritten.classes ?? []);
  if (inheritance.diagnostics.length > 0) throw new TypeCError(inheritance.diagnostics);
  const inherited = { ...rewritten, classes: inheritance.classes };
  const implementationDiagnostics = classImplementationDiagnostics(
    inherited.classes ?? [],
    inherited.interfaces ?? [],
  );
  if (implementationDiagnostics.length > 0) throw new TypeCError(implementationDiagnostics);
  return inherited;
}

function genericClassTemplates(classes: CastClassDecl[]): Map<Str, CastClassDecl> {
  const templates = new Map<Str, CastClassDecl>();
  for (const classDecl of classes) {
    if (isGenericClass(classDecl)) templates.set(classDecl.name, classDecl);
  }
  return templates;
}

function concreteClassTemplates(classes: CastClassDecl[]): Map<Str, CastClassDecl> {
  const concrete = new Map<Str, CastClassDecl>();
  for (const classDecl of classes) {
    if (!isGenericClass(classDecl)) concrete.set(classDecl.name, classDecl);
  }
  return concrete;
}

function isGenericClass(classDecl: CastClassDecl): b8 {
  return (classDecl.genericParams ?? []).length > 0;
}

function genericClassParamDiagnostics(classes: CastClassDecl[]): Diagnostic[] {
  return classes.flatMap(genericClassDuplicateParamDiagnostics);
}

function genericClassDuplicateParamDiagnostics(classDecl: CastClassDecl): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const names = new Set<Str>();
  for (const param of classDecl.genericParams ?? []) {
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

class GenericClassInstantiator {
  private emitted = new Map<Str, CastClassDecl>();

  constructor(
    private templates: Map<Str, CastClassDecl>,
    private concrete: Map<Str, CastClassDecl>,
    private interfaces: CastInterfaceDecl[],
  ) {}

  rewriteProgram(program: CastProgram): CastProgram {
    const classes = (program.classes ?? []).filter((classDecl) => !isGenericClass(classDecl));
    const rewritten: CastProgram = {
      ...program,
      typeAliases: program.typeAliases.map((typeAlias) => this.rewriteTypeAlias(typeAlias)),
      classes: classes.map((classDecl) => this.rewriteClass(classDecl)),
      interfaces: (program.interfaces ?? []).map((interfaceDecl) =>
        this.rewriteInterface(interfaceDecl)
      ),
      taggedUnions: (program.taggedUnions ?? []).map((unionDecl) =>
        this.rewriteTaggedUnion(unionDecl)
      ),
      constants: (program.constants ?? []).map((constant) => this.rewriteConst(constant)),
      functions: program.functions.map((fn) => this.rewriteFunction(fn)),
    };
    return { ...rewritten, classes: [...(rewritten.classes ?? []), ...this.instantiations()] };
  }

  private instantiations(): CastClassDecl[] {
    return [...this.emitted.values()];
  }

  private rewriteTypeAlias(typeAlias: CastTypeAliasDecl): CastTypeAliasDecl {
    return { ...typeAlias, type: this.rewriteTypeRef(typeAlias.type) };
  }

  private rewriteTaggedUnion(unionDecl: CastTaggedUnionDecl): CastTaggedUnionDecl {
    return {
      ...unionDecl,
      variants: unionDecl.variants.map((variant) => ({
        ...variant,
        payload: variant.payload ? this.rewriteTypeRef(variant.payload) : null,
      })),
    };
  }

  private rewriteClass(classDecl: CastClassDecl): CastClassDecl {
    return {
      ...classDecl,
      genericParams: [],
      extends: classDecl.extends ? this.rewriteTypeRef(classDecl.extends) : null,
      implements: classDecl.implements?.map((value) => this.rewriteTypeRef(value)) ?? [],
      fields: classDecl.fields.map((field) => ({
        ...field,
        type: this.rewriteTypeRef(field.type),
      })),
      constructorDecl: classDecl.constructorDecl
        ? {
          ...classDecl.constructorDecl,
          params: classDecl.constructorDecl.params.map((param) => this.rewriteParam(param)),
          body: this.rewriteBlock(classDecl.constructorDecl.body),
        }
        : null,
      methods: classDecl.methods.map((method) => ({
        ...method,
        params: method.params.map((param) => this.rewriteParam(param)),
        returnType: this.rewriteTypeRef(method.returnType),
        body: this.rewriteBlock(method.body),
      })),
    };
  }

  private rewriteInterface(interfaceDecl: CastInterfaceDecl): CastInterfaceDecl {
    return {
      ...interfaceDecl,
      methods: interfaceDecl.methods.map((method) => ({
        ...method,
        params: method.params.map((param) => this.rewriteParam(param)),
        returnType: this.rewriteTypeRef(method.returnType),
      })),
    };
  }

  private rewriteConst(constant: CastConstDecl): CastConstDecl {
    return { ...constant, type: this.rewriteTypeRef(constant.type) };
  }

  private rewriteFunction(fn: CastFunctionDecl): CastFunctionDecl {
    return {
      ...fn,
      params: fn.params.map((param) => this.rewriteParam(param)),
      returnType: this.rewriteTypeRef(fn.returnType),
      body: fn.body ? this.rewriteBlock(fn.body) : null,
    };
  }

  private rewriteParam(param: CastParam): CastParam {
    return { ...param, type: this.rewriteTypeRef(param.type) };
  }

  private rewriteBlock(block: CastBlockStmt): CastBlockStmt {
    return {
      ...block,
      statements: block.statements.map((statement) => this.rewriteStatement(statement)),
    };
  }

  private rewriteStatement(statement: CastStatement): CastStatement {
    switch (statement.kind) {
      case "EmptyStmt":
        return statement;
      case "ReturnStmt":
        return this.rewriteReturn(statement);
      case "DeferStmt":
        return { ...statement, expression: this.rewriteExpression(statement.expression) };
      case "ExpressionStmt":
        return { ...statement, expression: this.rewriteExpression(statement.expression) };
      case "BreakStmt":
        return statement;
      case "VarDeclStmt":
        return this.rewriteVarDecl(statement);
      case "AssignmentStmt":
        return this.rewriteAssignment(statement);
      case "IncDecStmt":
        return {
          ...statement,
          target: this.rewriteExpression(statement.target) as typeof statement.target,
        };
      case "SwitchStmt":
        return this.rewriteSwitch(statement);
      case "WhileStmt":
        return this.rewriteWhile(statement);
      case "DoWhileStmt":
        return this.rewriteDoWhile(statement);
      case "ForStmt":
        return this.rewriteFor(statement);
      case "IfStmt":
        return this.rewriteIf(statement);
    }
  }

  private rewriteReturn(statement: CastReturnStmt): CastReturnStmt {
    return {
      ...statement,
      expression: statement.expression ? this.rewriteExpression(statement.expression) : null,
    };
  }

  private rewriteVarDecl(statement: CastVarDeclStmt): CastVarDeclStmt {
    return {
      ...statement,
      type: this.rewriteTypeRef(statement.type),
      initializer: this.rewriteExpression(statement.initializer),
    };
  }

  private rewriteAssignment(statement: CastAssignmentStmt): CastAssignmentStmt {
    return {
      ...statement,
      target: this.rewriteExpression(statement.target) as CastAssignmentStmt["target"],
      expression: this.rewriteExpression(statement.expression),
    };
  }

  private rewriteSwitch(statement: CastSwitchStmt): CastSwitchStmt {
    return {
      ...statement,
      expression: this.rewriteExpression(statement.expression),
      cases: statement.cases.map((switchCase) => ({
        ...switchCase,
        labels: switchCase.labels.map((label) => this.rewriteExpression(label)),
        statements: switchCase.statements.map((child) => this.rewriteStatement(child)),
      })),
      defaultCase: statement.defaultCase
        ? {
          ...statement.defaultCase,
          statements: statement.defaultCase.statements.map((child) => this.rewriteStatement(child)),
        }
        : null,
    };
  }

  private rewriteWhile(statement: CastWhileStmt): CastWhileStmt {
    return {
      ...statement,
      condition: this.rewriteExpression(statement.condition),
      body: this.rewriteBlock(statement.body),
    };
  }

  private rewriteDoWhile(statement: CastDoWhileStmt): CastDoWhileStmt {
    return {
      ...statement,
      body: this.rewriteBlock(statement.body),
      condition: this.rewriteExpression(statement.condition),
    };
  }

  private rewriteFor(statement: CastForStmt): CastForStmt {
    return {
      ...statement,
      initializer: statement.initializer
        ? this.rewriteStatement(statement.initializer) as CastForStmt["initializer"]
        : null,
      condition: this.rewriteExpression(statement.condition),
      update: statement.update
        ? this.rewriteStatement(statement.update) as CastForStmt["update"]
        : null,
      body: this.rewriteBlock(statement.body),
    };
  }

  private rewriteIf(statement: CastIfStmt): CastIfStmt {
    return {
      ...statement,
      condition: this.rewriteExpression(statement.condition),
      thenBody: this.rewriteBlock(statement.thenBody),
      elseBody: statement.elseBody ? this.rewriteBlock(statement.elseBody) : null,
    };
  }

  private rewriteExpression(expression: CastExpression): CastExpression {
    switch (expression.kind) {
      case "IntegerLiteral":
      case "FloatLiteral":
      case "BoolLiteral":
      case "StringLiteral":
      case "IdentifierExpr":
        return expression;
      case "UnaryExpr":
        return this.rewriteUnary(expression);
      case "BinaryExpr":
        return this.rewriteBinary(expression);
      case "ConditionalExpr":
        return this.rewriteConditional(expression);
      case "NullishCoalesceExpr":
        return this.rewriteNullish(expression);
      case "CallExpr":
        return this.rewriteCall(expression);
      case "NewExpr":
        return this.rewriteNew(expression);
      case "MethodCallExpr":
        return this.rewriteMethodCall(expression);
      case "PostfixPointerExpr":
        return this.rewritePostfixPointer(expression);
      case "NonNullAssertExpr":
        return this.rewriteNonNullAssert(expression);
      case "FieldAccessExpr":
        return { ...expression, operand: this.rewriteExpression(expression.operand) };
      case "OptionalFieldAccessExpr":
        return this.rewriteOptionalFieldAccess(expression);
      case "OptionalMethodCallExpr":
        return this.rewriteOptionalMethodCall(expression);
      case "OptionalIndexExpr":
        return this.rewriteOptionalIndex(expression);
      case "RecordLiteralExpr":
        return this.rewriteRecordLiteral(expression);
      case "ArrayLiteralExpr":
        return this.rewriteArrayLiteral(expression);
      case "IndexExpr":
        return this.rewriteIndex(expression);
    }
  }

  private rewriteUnary(expression: CastUnaryExpr): CastUnaryExpr {
    return { ...expression, operand: this.rewriteExpression(expression.operand) };
  }

  private rewriteBinary(expression: CastBinaryExpr): CastBinaryExpr {
    return {
      ...expression,
      left: this.rewriteExpression(expression.left),
      right: this.rewriteExpression(expression.right),
    };
  }

  private rewriteConditional(expression: CastConditionalExpr): CastConditionalExpr {
    return {
      ...expression,
      condition: this.rewriteExpression(expression.condition),
      whenTrue: this.rewriteExpression(expression.whenTrue),
      whenFalse: this.rewriteExpression(expression.whenFalse),
    };
  }

  private rewriteNullish(expression: CastNullishCoalesceExpr): CastNullishCoalesceExpr {
    return {
      ...expression,
      left: this.rewriteExpression(expression.left),
      fallback: this.rewriteExpression(expression.fallback),
    };
  }

  private rewriteCall(expression: CastCallExpr): CastCallExpr {
    return {
      ...expression,
      typeArgs: expression.typeArgs?.map((typeArg) => this.rewriteTypeRef(typeArg)),
      args: expression.args.map((arg) => this.rewriteExpression(arg)),
    };
  }

  private rewriteNew(expression: CastNewExpr): CastNewExpr {
    const typeRef = this.rewriteTypeRef({
      kind: "NamedTypeRef",
      name: expression.className,
      typeArgs: expression.typeArgs,
      span: expression.span,
    });
    return {
      ...expression,
      className: typeRef.kind === "NamedTypeRef" ? typeRef.name : expression.className,
      typeArgs: [],
      args: expression.args.map((arg) => this.rewriteExpression(arg)),
    };
  }

  private rewriteMethodCall(expression: CastMethodCallExpr): CastMethodCallExpr {
    return {
      ...expression,
      receiver: this.rewriteExpression(expression.receiver),
      args: expression.args.map((arg) => this.rewriteExpression(arg)),
    };
  }

  private rewritePostfixPointer(expression: CastPostfixPointerExpr): CastPostfixPointerExpr {
    return { ...expression, operand: this.rewriteExpression(expression.operand) };
  }

  private rewriteNonNullAssert(expression: CastNonNullAssertExpr): CastNonNullAssertExpr {
    return { ...expression, operand: this.rewriteExpression(expression.operand) };
  }

  private rewriteOptionalFieldAccess(
    expression: CastOptionalFieldAccessExpr,
  ): CastOptionalFieldAccessExpr {
    return { ...expression, operand: this.rewriteExpression(expression.operand) };
  }

  private rewriteOptionalMethodCall(
    expression: CastOptionalMethodCallExpr,
  ): CastOptionalMethodCallExpr {
    return {
      ...expression,
      receiver: this.rewriteExpression(expression.receiver),
      args: expression.args.map((arg) => this.rewriteExpression(arg)),
    };
  }

  private rewriteOptionalIndex(expression: CastOptionalIndexExpr): CastOptionalIndexExpr {
    return {
      ...expression,
      operand: this.rewriteExpression(expression.operand),
      index: this.rewriteExpression(expression.index),
    };
  }

  private rewriteRecordLiteral(expression: CastRecordLiteralExpr): CastRecordLiteralExpr {
    return {
      ...expression,
      fields: expression.fields.map((field) => ({
        ...field,
        expression: this.rewriteExpression(field.expression),
      })),
    };
  }

  private rewriteArrayLiteral(expression: CastArrayLiteralExpr): CastArrayLiteralExpr {
    return {
      ...expression,
      elements: expression.elements.map((element) => this.rewriteExpression(element)),
    };
  }

  private rewriteIndex(expression: CastIndexExpr): CastIndexExpr {
    return {
      ...expression,
      operand: this.rewriteExpression(expression.operand),
      index: this.rewriteExpression(expression.index),
    };
  }

  private rewriteTypeRef(type: CastTypeRef): CastTypeRef {
    if (type.kind === "NamedTypeRef") return this.rewriteNamedTypeRef(type);
    return rewriteTypeChildren(type, (child) => this.rewriteTypeRef(child));
  }

  private rewriteNamedTypeRef(type: Extract<CastTypeRef, { kind: "NamedTypeRef" }>): CastTypeRef {
    const typeArgs = type.typeArgs?.map((typeArg) => this.rewriteTypeRef(typeArg)) ?? [];
    const template = this.templates.get(type.name);
    if (!template || typeArgs.length === 0) return { ...type, typeArgs };
    this.checkClassTypeArgCount(template, typeArgs, type.span);
    this.checkClassConstraints(template, typeArgs, type.span);
    const name = classInstantiationName(template.name, typeArgs);
    if (!this.emitted.has(name)) {
      this.emitted.set(name, this.createInstantiation(template, typeArgs, name));
    }
    return { kind: "NamedTypeRef", name, span: type.span };
  }

  private checkClassTypeArgCount(
    template: CastClassDecl,
    typeArgs: CastTypeRef[],
    span: CastTypeRef["span"],
  ): void {
    const expected = template.genericParams?.length ?? 0;
    if (typeArgs.length === expected) return;
    throw new TypeCError([{
      message: `Generic class '${template.name}' expects ${expected} type argument(s)`,
      span,
    }]);
  }

  private createInstantiation(
    template: CastClassDecl,
    typeArgs: CastTypeRef[],
    name: Str,
  ): CastClassDecl {
    const substitutions = classSubstitutions(template, typeArgs);
    const classDecl = this.rewriteClass({
      ...template,
      exported: false,
      name,
      genericParams: [],
      extends: template.extends ? substituteTypeRef(template.extends, substitutions) : null,
      implements: template.implements?.map((value) => substituteTypeRef(value, substitutions)) ??
        [],
      fields: template.fields.map((field) => ({
        ...field,
        type: substituteTypeRef(field.type, substitutions),
      })),
      constructorDecl: template.constructorDecl
        ? {
          ...template.constructorDecl,
          params: template.constructorDecl.params.map((param) =>
            substituteParam(param, substitutions)
          ),
          body: substituteBlock(template.constructorDecl.body, substitutions),
        }
        : null,
      methods: template.methods.map((method) => ({
        ...method,
        params: method.params.map((param) => substituteParam(param, substitutions)),
        returnType: substituteTypeRef(method.returnType, substitutions),
        body: substituteBlock(method.body, substitutions),
      })),
    });
    this.concrete.set(name, classDecl);
    return classDecl;
  }

  private checkClassConstraints(
    template: CastClassDecl,
    typeArgs: CastTypeRef[],
    span: CastTypeRef["span"],
  ): void {
    const diagnostics: Diagnostic[] = [];
    const params = template.genericParams ?? [];
    for (let index: usize = 0; index < params.length; index += 1) {
      const constraint = params[index].constraint;
      const typeArg = typeArgs[index];
      if (!constraint || !typeArg) continue;
      diagnostics.push(...this.checkClassConstraint(typeArg, constraint, span));
    }
    if (diagnostics.length > 0) throw new TypeCError(diagnostics);
  }

  private checkClassConstraint(
    typeArg: CastTypeRef,
    constraint: CastTypeRef,
    span: CastTypeRef["span"],
  ): Diagnostic[] {
    if (constraint.kind !== "NamedTypeRef" || typeArg.kind !== "NamedTypeRef") {
      return [{
        message: `Type '${typeName(lowerTypeRef(typeArg))}' does not satisfy constraint`,
        span,
      }];
    }
    const interfaceDecl = this.interfaces.find((candidate) => candidate.name === constraint.name);
    const classDecl = this.concrete.get(typeArg.name);
    if (!interfaceDecl || !classDecl) {
      return [{ message: `Type '${typeArg.name}' does not satisfy '${constraint.name}'`, span }];
    }
    return missingCastInterfaceMethods(classDecl, interfaceDecl, span);
  }
}

function rewriteTypeChildren(
  type: CastTypeRef,
  rewrite: (type: CastTypeRef) => CastTypeRef,
): CastTypeRef {
  switch (type.kind) {
    case "NamedTypeRef":
      return type;
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "SliceTypeRef":
    case "InferredArrayTypeRef":
      return { ...type, element: rewrite(type.element) };
    case "FixedArrayTypeRef":
      return { ...type, element: rewrite(type.element) };
    case "FunctionTypeRef":
      return rewriteFunctionType(type, rewrite);
    case "RecordTypeRef":
      return rewriteRecordType(type, rewrite);
  }
}

function rewriteFunctionType(
  type: CastFunctionTypeRef,
  rewrite: (type: CastTypeRef) => CastTypeRef,
): CastFunctionTypeRef {
  return {
    ...type,
    params: type.params.map((param) => ({ ...param, type: rewrite(param.type) })),
    returnType: rewrite(type.returnType),
  };
}

function rewriteRecordType(
  type: CastRecordTypeRef,
  rewrite: (type: CastTypeRef) => CastTypeRef,
): CastRecordTypeRef {
  return {
    ...type,
    fields: type.fields.map((field) => ({ ...field, type: rewrite(field.type) })),
  };
}

function classSubstitutions(
  template: CastClassDecl,
  typeArgs: CastTypeRef[],
): CastTypeSubstitutions {
  const substitutions = new Map<Str, CastTypeRef>();
  const params = template.genericParams ?? [];
  for (let index: usize = 0; index < params.length; index += 1) {
    const typeArg = typeArgs[index];
    if (typeArg) substitutions.set(params[index].name, typeArg);
  }
  return substitutions;
}

function substituteBlock(
  block: CastBlockStmt,
  substitutions: CastTypeSubstitutions,
): CastBlockStmt {
  return {
    ...block,
    statements: block.statements.map((statement) => substituteStatement(statement, substitutions)),
  };
}

function substituteStatement(
  statement: CastStatement,
  substitutions: CastTypeSubstitutions,
): CastStatement {
  switch (statement.kind) {
    case "EmptyStmt":
      return statement;
    case "ReturnStmt":
    case "DeferStmt":
    case "ExpressionStmt":
    case "BreakStmt":
    case "AssignmentStmt":
    case "IncDecStmt":
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
    case "IfStmt":
      return {
        ...statement,
        thenBody: substituteBlock(statement.thenBody, substitutions),
        elseBody: statement.elseBody ? substituteBlock(statement.elseBody, substitutions) : null,
      };
  }
}

function substituteParam(param: CastParam, substitutions: CastTypeSubstitutions): CastParam {
  return { ...param, type: substituteTypeRef(param.type, substitutions) };
}

function substituteTypeRef(type: CastTypeRef, substitutions: CastTypeSubstitutions): CastTypeRef {
  if (type.kind === "NamedTypeRef") return substitutions.get(type.name) ?? type;
  return rewriteTypeChildren(type, (child) => substituteTypeRef(child, substitutions));
}

interface ClassInheritanceResult {
  classes: CastClassDecl[];
  diagnostics: Diagnostic[];
}

function resolveClassInheritance(classes: CastClassDecl[]): ClassInheritanceResult {
  const resolver = new ClassInheritanceResolver(classes);
  return resolver.resolve();
}

class ClassInheritanceResolver {
  private diagnostics: Diagnostic[] = [];
  private resolved = new Map<Str, CastClassDecl>();
  private classMap: Map<Str, CastClassDecl>;

  constructor(private classes: CastClassDecl[]) {
    this.classMap = new Map(classes.map((classDecl) => [classDecl.name, classDecl]));
  }

  resolve(): ClassInheritanceResult {
    const resolved = this.classes.map((classDecl) => this.resolveClass(classDecl, []));
    return { classes: resolved, diagnostics: this.diagnostics };
  }

  private resolveClass(classDecl: CastClassDecl, stack: Str[]): CastClassDecl {
    const existing = this.resolved.get(classDecl.name);
    if (existing) return existing;
    if (stack.includes(classDecl.name)) {
      this.diagnostics.push({
        message: `Inheritance cycle involving '${classDecl.name}'`,
        span: classDecl.span,
      });
      return classDecl;
    }
    if (!classDecl.extends) {
      this.resolved.set(classDecl.name, classDecl);
      return classDecl;
    }
    const baseRef = classDecl.extends;
    if (baseRef.kind !== "NamedTypeRef" || (baseRef.typeArgs ?? []).length > 0) {
      this.diagnostics.push({
        message: "Class extends entries must be concrete class names",
        span: baseRef.span,
      });
      this.resolved.set(classDecl.name, classDecl);
      return classDecl;
    }
    const base = this.classMap.get(baseRef.name) ?? null;
    if (base === null) {
      this.diagnostics.push({
        message: `Unknown base class '${baseRef.name}'`,
        span: baseRef.span,
      });
      this.resolved.set(classDecl.name, classDecl);
      return classDecl;
    }
    const resolvedBase = this.resolveClass(base, [...stack, classDecl.name]);
    const inherited = this.inheritClass(classDecl, resolvedBase);
    this.resolved.set(classDecl.name, inherited);
    return inherited;
  }

  private inheritClass(classDecl: CastClassDecl, base: CastClassDecl): CastClassDecl {
    const ownFields = new Set(classDecl.fields.map((field) => field.name));
    const conflictingField = base.fields.find((field) => ownFields.has(field.name));
    if (conflictingField) {
      this.diagnostics.push({
        message:
          `Class '${classDecl.name}' field '${conflictingField.name}' conflicts with inherited field`,
        span: conflictingField.span,
      });
    }
    const ownMethods = new Set(classDecl.methods.map((method) => method.name));
    return {
      ...classDecl,
      fields: [...base.fields, ...classDecl.fields],
      methods: [
        ...base.methods.filter((method) => !ownMethods.has(method.name)),
        ...classDecl.methods,
      ],
    };
  }
}

function classImplementationDiagnostics(
  classes: CastClassDecl[],
  interfaces: CastInterfaceDecl[],
): Diagnostic[] {
  return classes.flatMap((classDecl) =>
    (classDecl.implements ?? []).flatMap((implemented) => {
      if (implemented.kind !== "NamedTypeRef") {
        return [{
          message: "Class implements entries must be interface names",
          span: implemented.span,
        }];
      }
      const interfaceDecl = interfaces.find((candidate) => candidate.name === implemented.name);
      if (!interfaceDecl) {
        return [{ message: `Unknown interface '${implemented.name}'`, span: implemented.span }];
      }
      return missingCastInterfaceMethods(classDecl, interfaceDecl, implemented.span);
    })
  );
}

function missingCastInterfaceMethods(
  classDecl: CastClassDecl,
  interfaceDecl: CastInterfaceDecl,
  span: CastTypeRef["span"],
): Diagnostic[] {
  return interfaceDecl.methods.flatMap((method) => {
    const classMethod = classDecl.methods.find((candidate) => candidate.name === method.name);
    if (classMethod && castMethodSignatureMatches(classMethod, method)) return [];
    return [{
      message:
        `Type '${classDecl.name}' does not satisfy '${interfaceDecl.name}': missing method '${method.name}'`,
      span,
    }];
  });
}

function castMethodSignatureMatches(
  classMethod: CastClassDecl["methods"][usize],
  interfaceMethod: CastInterfaceDecl["methods"][usize],
): b8 {
  if (classMethod.params.length !== interfaceMethod.params.length) return false;
  if (
    typeName(lowerTypeRef(classMethod.returnType)) !==
      typeName(lowerTypeRef(interfaceMethod.returnType))
  ) {
    return false;
  }
  return classMethod.params.every((param, index) =>
    typeName(lowerTypeRef(param.type)) ===
      typeName(lowerTypeRef(interfaceMethod.params[index].type))
  );
}

function classInstantiationName(name: Str, typeArgs: CastTypeRef[]): Str {
  return `${name}_${typeArgs.map(typeArgName).join("_")}`;
}

function typeArgName(typeArg: CastTypeRef): Str {
  return sanitizeTypeName(typeName(lowerTypeRef(typeArg)));
}

function sanitizeTypeName(name: Str): Str {
  return name.replaceAll(/[^A-Za-z0-9_]/g, "_");
}
