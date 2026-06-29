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
  CastEnumDecl,
  CastExpression,
  CastForInStmt,
  CastForOfStmt,
  CastForStmt,
  CastFunctionDecl,
  CastFunctionTypeRef,
  CastIfStmt,
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
  CastStructDecl,
  CastSwitchStmt,
  CastTaggedUnionDecl,
  CastTypeAliasDecl,
  CastTypeRef,
  CastUnaryExpr,
  CastVarDeclStmt,
  CastWhileStmt,
} from "core/cast.ts";
import {
  CLASS_CONSTRAINT_UNSATISFIED,
  CLASS_DUPLICATE_GENERIC_PARAMETER,
  CLASS_EXTENDS_TARGET,
  CLASS_GENERIC_CONSTRAINT_INTERFACE,
  CLASS_GENERIC_CONSTRAINT_UNKNOWN_TYPE,
  CLASS_IMPLEMENTS_TARGET,
  CLASS_INHERITANCE_CYCLE,
  CLASS_INHERITED_FIELD_CONFLICT,
  CLASS_INTERFACE_METHOD_MISSING,
  CLASS_INTERFACE_VALUE_TYPE,
  CLASS_TYPE_ARGUMENT_ARITY,
  CLASS_UNKNOWN_BASE,
  CLASS_UNKNOWN_INTERFACE,
  CLASS_UNKNOWN_TYPE_ARGUMENT,
  GENERIC_INSTANTIATION_CYCLE,
} from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import { primitiveTypes } from "core/token.ts";
import { typeName } from "core/type_ref.ts";
import {
  inferGenericClassArgumentTypeRef,
  inferGenericClassNewTypeArgsFromArgs,
  inferGenericClassNewTypeArgsFromExpected,
} from "lower/generic_class_inference.ts";
import { lowerTypeRef } from "lower/types.ts";

export type Str = string;
type b8 = boolean;
type usize = number;

type CastTypeSubstitutions = Map<Str, CastTypeRef>;
type LocalTypes = Map<Str, CastTypeRef>;

interface KnownClassConstraintDeclarations {
  typeAliases: Map<Str, CastTypeRef>;
  classes: CastClassDecl[];
  structs: CastStructDecl[];
  enums: CastEnumDecl[];
  taggedUnions: CastTaggedUnionDecl[];
}

interface FieldEntry {
  name: Str;
  type: CastTypeRef;
}

interface FieldSource {
  fields: FieldEntry[];
}

interface ClassConstraintSubject {
  className: Str;
  paramName: Str;
}

export function instantiateGenericClasses(program: CastProgram): CastProgram {
  const templates = genericClassTemplates(program.classes ?? []);
  const typeAliases = castTypeAliasMap(program.typeAliases);
  const diagnostics = genericClassParamDiagnostics(
    program.classes ?? [],
    program.interfaces ?? [],
    {
      typeAliases,
      classes: program.classes ?? [],
      structs: program.structs ?? [],
      enums: program.enums ?? [],
      taggedUnions: program.taggedUnions ?? [],
    },
  );
  if (diagnostics.length > 0) throw new TypeCError(diagnostics);
  const concrete = concreteClassTemplates(program.classes ?? []);
  const instantiator = new GenericClassInstantiator(
    templates,
    concrete,
    program.interfaces ?? [],
    typeAliases,
    program.structs ?? [],
    program.enums ?? [],
    program.taggedUnions ?? [],
  );
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

function genericClassParamDiagnostics(
  classes: CastClassDecl[],
  interfaces: CastInterfaceDecl[],
  declarations: KnownClassConstraintDeclarations,
): Diagnostic[] {
  return classes.flatMap((classDecl) =>
    genericClassDeclarationDiagnostics(classDecl, interfaces, declarations)
  );
}

function genericClassDeclarationDiagnostics(
  classDecl: CastClassDecl,
  interfaces: CastInterfaceDecl[],
  declarations: KnownClassConstraintDeclarations,
): Diagnostic[] {
  return [
    ...genericClassDuplicateParamDiagnostics(classDecl),
    ...genericClassConstraintDiagnostics(classDecl, interfaces, declarations),
  ];
}

function genericClassConstraintDiagnostics(
  classDecl: CastClassDecl,
  interfaces: CastInterfaceDecl[],
  declarations: KnownClassConstraintDeclarations,
): Diagnostic[] {
  return (classDecl.genericParams ?? []).flatMap((param) =>
    genericClassConstraintDiagnostic(param, interfaces, declarations)
  );
}

function genericClassConstraintDiagnostic(
  param: NonNullable<CastClassDecl["genericParams"]>[usize],
  interfaces: CastInterfaceDecl[],
  declarations: KnownClassConstraintDeclarations,
): Diagnostic[] {
  const constraint = param.constraint;
  if (constraint === null || constraint === undefined) return [];
  if (constraint.kind === "LiteralTypeRef" || constraint.kind === "RecordTypeRef") return [];
  if (constraint.kind !== "NamedTypeRef") {
    return [{
      message: `Generic constraint for '${param.name}' must be an interface`,
      code: CLASS_GENERIC_CONSTRAINT_INTERFACE,
      span: constraint.span,
    }];
  }
  if (interfaces.some((interfaceDecl) => interfaceDecl.name === constraint.name)) return [];
  if (isKnownClassConstraintName(constraint.name, declarations)) return [];
  return [{
    message: `Unknown type '${constraint.name}'`,
    code: CLASS_GENERIC_CONSTRAINT_UNKNOWN_TYPE,
    span: constraint.span,
  }];
}

function isKnownClassConstraintName(
  name: Str,
  declarations: KnownClassConstraintDeclarations,
): b8 {
  return primitiveTypes.has(name) || declarations.typeAliases.has(name) ||
    hasClassName(name, declarations.classes) || hasStructName(name, declarations.structs) ||
    hasCastEnumName(name, declarations.enums) ||
    hasCastTaggedUnionName(name, declarations.taggedUnions);
}

function hasClassName(name: Str, classes: CastClassDecl[]): b8 {
  return classes.some((classDecl) => classDecl.name === name);
}

function hasStructName(name: Str, structs: CastStructDecl[]): b8 {
  return structs.some((structDecl) => structDecl.name === name);
}

function hasCastEnumName(name: Str, enums: CastEnumDecl[]): b8 {
  return enums.some((enumDecl) => enumDecl.name === name);
}

function hasCastTaggedUnionName(name: Str, taggedUnions: CastTaggedUnionDecl[]): b8 {
  return taggedUnions.some((unionDecl) => unionDecl.name === name);
}

function functionMap(functions: CastFunctionDecl[]): Map<Str, CastFunctionDecl> {
  return new Map(functions.map((fn) => [fn.name, fn]));
}

function localTypeMap(params: CastParam[]): LocalTypes {
  return new Map(params.map((param) => [param.name, param.type]));
}

function assignmentTargetType(
  target: CastExpression,
  locals: LocalTypes,
  classes: Map<Str, CastClassDecl>,
): CastTypeRef | null {
  if (target.kind === "IdentifierExpr") return locals.get(target.name) ?? null;
  if (target.kind === "FieldAccessExpr") return fieldAssignmentTargetType(target, locals, classes);
  if (target.kind === "IndexExpr") return indexAssignmentTargetType(target, locals, classes);
  if (target.kind === "PostfixPointerExpr") {
    return dereferenceAssignmentTargetType(target, locals, classes);
  }
  return null;
}

function dereferenceAssignmentTargetType(
  target: Extract<CastExpression, { kind: "PostfixPointerExpr" }>,
  locals: LocalTypes,
  classes: Map<Str, CastClassDecl>,
): CastTypeRef | null {
  if (target.operator !== ".*") return null;
  const operand = assignmentTargetType(target.operand, locals, classes);
  return operand === null ? null : pointerLikeElementType(operand);
}

function indexAssignmentTargetType(
  target: Extract<CastExpression, { kind: "IndexExpr" }>,
  locals: LocalTypes,
  classes: Map<Str, CastClassDecl>,
): CastTypeRef | null {
  const operand = assignmentTargetType(target.operand, locals, classes);
  return operand === null ? null : indexedElementType(operand, target.index);
}

function fieldAssignmentTargetType(
  target: Extract<CastExpression, { kind: "FieldAccessExpr" }>,
  locals: LocalTypes,
  classes: Map<Str, CastClassDecl>,
): CastTypeRef | null {
  const fieldSource = fieldSourceType(target.operand, locals, classes);
  return fieldSource?.fields.find((field) => field.name === target.field)?.type ?? null;
}

function fieldSourceType(
  target: CastExpression,
  locals: LocalTypes,
  classes: Map<Str, CastClassDecl>,
): FieldSource | null {
  const targetType = assignmentTargetType(target, locals, classes);
  if (targetType?.kind === "RecordTypeRef") return targetType;
  if (targetType?.kind !== "NamedTypeRef") return null;
  return classes.get(targetType.name) ?? null;
}

function nullishFallbackType(
  left: CastExpression,
  locals: LocalTypes,
  classes: Map<Str, CastClassDecl>,
): CastTypeRef | null {
  const type = assignmentTargetType(left, locals, classes);
  return type === null ? null : optionalTypeElement(type);
}

function optionalTypeElement(type: CastTypeRef): CastTypeRef | null {
  if (type.kind !== "NamedTypeRef" || type.name !== "Optional") return null;
  const typeArgs = type.typeArgs ?? [];
  return typeArgs.length === 1 ? typeArgs[0] : null;
}

function expectedElementType(type: CastTypeRef, index: usize): CastTypeRef | null {
  if (type.kind === "TupleTypeRef") return type.elements[index] ?? null;
  return expectedArrayElementType(type);
}

function indexedElementType(type: CastTypeRef, index: CastExpression): CastTypeRef | null {
  if (type.kind !== "TupleTypeRef") return expectedArrayElementType(type);
  if (index.kind !== "IntegerLiteral") return null;
  if (index.value < 0n || index.value >= BigInt(type.elements.length)) return null;
  return type.elements[Number(index.value)] ?? null;
}

function expectedArrayElementType(type: CastTypeRef): CastTypeRef | null {
  switch (type.kind) {
    case "FixedArrayTypeRef":
    case "InferredArrayTypeRef":
    case "SliceTypeRef":
      return type.element;
    default:
      return null;
  }
}

function localInferredType(
  expression: CastExpression,
  locals: LocalTypes,
  classes: Map<Str, CastClassDecl>,
  functions: Map<Str, CastFunctionDecl>,
): CastTypeRef | null {
  return localArgumentType(expression, locals, classes, functions);
}

function localArgumentType(
  expression: CastExpression,
  locals: LocalTypes,
  classes: Map<Str, CastClassDecl>,
  functions: Map<Str, CastFunctionDecl>,
): CastTypeRef | null {
  if (expression.kind === "IdentifierExpr") return locals.get(expression.name) ?? null;
  if (expression.kind === "FieldAccessExpr") {
    return fieldAssignmentTargetType(expression, locals, classes);
  }
  if (expression.kind === "IndexExpr") {
    return indexAssignmentTargetType(expression, locals, classes);
  }
  if (expression.kind === "NewExpr") {
    return { kind: "NamedTypeRef", name: expression.className, span: expression.span };
  }
  if (expression.kind === "CallExpr") return functions.get(expression.callee)?.returnType ?? null;
  if (expression.kind === "NonNullAssertExpr") {
    return nonNullAssertArgumentType(expression, locals, classes, functions);
  }
  if (expression.kind === "PostfixPointerExpr") {
    return postfixPointerArgumentType(expression, locals, classes, functions);
  }
  return inferGenericClassArgumentTypeRef(expression);
}

function nonNullAssertArgumentType(
  expression: Extract<CastExpression, { kind: "NonNullAssertExpr" }>,
  locals: LocalTypes,
  classes: Map<Str, CastClassDecl>,
  functions: Map<Str, CastFunctionDecl>,
): CastTypeRef | null {
  const operand = localArgumentOperandType(expression.operand, locals, classes, functions);
  return operand === null ? null : optionalTypeElement(operand);
}

function postfixPointerArgumentType(
  expression: Extract<CastExpression, { kind: "PostfixPointerExpr" }>,
  locals: LocalTypes,
  classes: Map<Str, CastClassDecl>,
  functions: Map<Str, CastFunctionDecl>,
): CastTypeRef | null {
  const operand = localArgumentOperandType(expression.operand, locals, classes, functions);
  if (operand === null) return null;
  if (expression.operator === ".&") {
    return { kind: "ReferenceTypeRef", element: operand, span: expression.span };
  }
  return pointerLikeElementType(operand);
}

function localArgumentOperandType(
  expression: CastExpression,
  locals: LocalTypes,
  classes: Map<Str, CastClassDecl>,
  functions: Map<Str, CastFunctionDecl>,
): CastTypeRef | null {
  return assignmentTargetType(expression, locals, classes) ??
    localArgumentType(expression, locals, classes, functions);
}

function pointerLikeElementType(type: CastTypeRef): CastTypeRef | null {
  switch (type.kind) {
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
      return type.element;
    default:
      return null;
  }
}

function castTypeAliasMap(typeAliases: CastTypeAliasDecl[]): Map<Str, CastTypeRef> {
  return new Map(
    typeAliases.map((typeAlias): [Str, CastTypeRef] => [typeAlias.name, typeAlias.type]),
  );
}

function genericClassDuplicateParamDiagnostics(classDecl: CastClassDecl): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const names = new Set<Str>();
  for (const param of classDecl.genericParams ?? []) {
    if (names.has(param.name)) {
      diagnostics.push({
        message: `Duplicate generic parameter '${param.name}'`,
        code: CLASS_DUPLICATE_GENERIC_PARAMETER,
        span: param.span,
      });
    }
    names.add(param.name);
  }
  return diagnostics;
}

class GenericClassInstantiator {
  private emitted = new Map<Str, CastClassDecl>();
  private active = new Set<Str>();
  private functions = new Map<Str, CastFunctionDecl>();

  constructor(
    private templates: Map<Str, CastClassDecl>,
    private concrete: Map<Str, CastClassDecl>,
    private interfaces: CastInterfaceDecl[],
    private typeAliases: Map<Str, CastTypeRef>,
    private structs: CastStructDecl[],
    private enums: CastEnumDecl[],
    private taggedUnions: CastTaggedUnionDecl[],
  ) {}

  rewriteProgram(program: CastProgram): CastProgram {
    this.functions = functionMap(program.functions);
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
    return {
      ...typeAlias,
      genericParams: typeAlias.genericParams?.map((param) => ({
        ...param,
        constraint: param.constraint ? this.rewriteTypeRef(param.constraint) : null,
      })),
      type: this.rewriteTypeRef(typeAlias.type),
    };
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
        initializer: field.initializer
          ? this.rewriteExpressionWithExpectedType(field.initializer, field.type, new Map())
          : null,
      })),
      constructorDecl: classDecl.constructorDecl
        ? {
          ...classDecl.constructorDecl,
          params: classDecl.constructorDecl.params.map((param) => this.rewriteParam(param)),
          body: this.rewriteBlock(
            classDecl.constructorDecl.body,
            null,
            localTypeMap(classDecl.constructorDecl.params),
          ),
        }
        : null,
      methods: classDecl.methods.map((method) => ({
        ...method,
        params: method.params.map((param) => this.rewriteParam(param)),
        returnType: this.rewriteTypeRef(method.returnType),
        body: this.rewriteBlock(method.body, method.returnType, localTypeMap(method.params)),
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
    return {
      ...constant,
      type: this.rewriteTypeRef(constant.type),
      initializer: this.rewriteExpressionWithExpectedType(
        constant.initializer,
        constant.type,
        new Map(),
      ),
    };
  }

  private rewriteFunction(fn: CastFunctionDecl): CastFunctionDecl {
    return {
      ...fn,
      params: fn.params.map((param) => this.rewriteParam(param)),
      returnType: this.rewriteTypeRef(fn.returnType),
      body: fn.body ? this.rewriteBlock(fn.body, fn.returnType, localTypeMap(fn.params)) : null,
    };
  }

  private rewriteParam(param: CastParam): CastParam {
    return { ...param, type: this.rewriteTypeRef(param.type) };
  }

  private rewriteBlock(
    block: CastBlockStmt,
    returnType: CastTypeRef | null = null,
    locals: LocalTypes = new Map(),
  ): CastBlockStmt {
    const scoped = new Map(locals);
    return {
      ...block,
      statements: block.statements.map((statement) =>
        this.rewriteStatement(statement, returnType, scoped)
      ),
    };
  }

  private rewriteStatement(
    statement: CastStatement,
    returnType: CastTypeRef | null = null,
    locals: LocalTypes = new Map(),
  ): CastStatement {
    switch (statement.kind) {
      case "EmptyStmt":
        return statement;
      case "ReturnStmt":
        return this.rewriteReturn(statement, returnType);
      case "DeferStmt":
        return { ...statement, expression: this.rewriteExpression(statement.expression, locals) };
      case "ExpressionStmt":
        return { ...statement, expression: this.rewriteExpression(statement.expression, locals) };
      case "BreakStmt":
      case "ContinueStmt":
        return statement;
      case "VarDeclStmt":
        return this.rewriteVarDecl(statement, locals);
      case "RecordRestStmt":
        return { ...statement, source: this.rewriteExpression(statement.source, locals) };
      case "ArrayDestructureStmt":
        return { ...statement, source: this.rewriteExpression(statement.source, locals) };
      case "AssignmentStmt":
        return this.rewriteAssignment(statement, locals);
      case "IncDecStmt":
        return {
          ...statement,
          target: this.rewriteExpression(statement.target, locals) as typeof statement.target,
        };
      case "SwitchStmt":
        return this.rewriteSwitch(statement, returnType, locals);
      case "WhileStmt":
        return this.rewriteWhile(statement, returnType, locals);
      case "DoWhileStmt":
        return this.rewriteDoWhile(statement, returnType, locals);
      case "ForStmt":
        return this.rewriteFor(statement, returnType, locals);
      case "ForOfStmt":
        return this.rewriteForOf(statement, returnType, locals);
      case "ForInStmt":
        return this.rewriteForIn(statement, returnType, locals);
      case "IfStmt":
        return this.rewriteIf(statement, returnType, locals);
    }
  }

  private rewriteReturn(
    statement: CastReturnStmt,
    returnType: CastTypeRef | null,
  ): CastReturnStmt {
    return {
      ...statement,
      expression: statement.expression
        ? this.rewriteExpressionWithExpectedType(statement.expression, returnType, new Map())
        : null,
    };
  }

  private rewriteVarDecl(statement: CastVarDeclStmt, locals: LocalTypes): CastVarDeclStmt {
    const rewritten = {
      ...statement,
      type: statement.type ? this.rewriteTypeRef(statement.type) : null,
      initializer: this.rewriteExpressionWithExpectedType(
        statement.initializer,
        statement.type,
        locals,
      ),
    };
    const localType = statement.type ??
      localInferredType(rewritten.initializer, locals, this.concrete, this.functions);
    if (localType !== null) locals.set(statement.name, localType);
    return rewritten;
  }

  private rewriteAssignment(
    statement: CastAssignmentStmt,
    locals: LocalTypes,
  ): CastAssignmentStmt {
    const target = this.rewriteExpression(statement.target, locals) as CastAssignmentStmt["target"];
    return {
      ...statement,
      target,
      expression: this.rewriteExpressionWithExpectedType(
        statement.expression,
        assignmentTargetType(statement.target, locals, this.concrete),
        locals,
      ),
    };
  }

  private rewriteSwitch(
    statement: CastSwitchStmt,
    returnType: CastTypeRef | null,
    locals: LocalTypes,
  ): CastSwitchStmt {
    return {
      ...statement,
      expression: this.rewriteExpression(statement.expression, locals),
      cases: statement.cases.map((switchCase) => ({
        ...switchCase,
        labels: switchCase.labels.map((label) => this.rewriteExpression(label, locals)),
        statements: switchCase.statements.map((child) =>
          this.rewriteStatement(child, returnType, new Map(locals))
        ),
      })),
      defaultCase: statement.defaultCase
        ? {
          ...statement.defaultCase,
          statements: statement.defaultCase.statements.map((child) =>
            this.rewriteStatement(child, returnType, new Map(locals))
          ),
        }
        : null,
    };
  }

  private rewriteWhile(
    statement: CastWhileStmt,
    returnType: CastTypeRef | null,
    locals: LocalTypes,
  ): CastWhileStmt {
    return {
      ...statement,
      condition: this.rewriteExpression(statement.condition, locals),
      body: this.rewriteBlock(statement.body, returnType, locals),
    };
  }

  private rewriteDoWhile(
    statement: CastDoWhileStmt,
    returnType: CastTypeRef | null,
    locals: LocalTypes,
  ): CastDoWhileStmt {
    return {
      ...statement,
      body: this.rewriteBlock(statement.body, returnType, locals),
      condition: this.rewriteExpression(statement.condition, locals),
    };
  }

  private rewriteFor(
    statement: CastForStmt,
    returnType: CastTypeRef | null,
    locals: LocalTypes,
  ): CastForStmt {
    const scoped = new Map(locals);
    return {
      ...statement,
      initializer: statement.initializer
        ? this.rewriteStatement(
          statement.initializer,
          returnType,
          scoped,
        ) as CastForStmt["initializer"]
        : null,
      condition: this.rewriteExpression(statement.condition, scoped),
      update: statement.update
        ? this.rewriteStatement(statement.update, returnType, scoped) as CastForStmt["update"]
        : null,
      body: this.rewriteBlock(statement.body, returnType, scoped),
    };
  }

  private rewriteForOf(
    statement: CastForOfStmt,
    returnType: CastTypeRef | null,
    locals: LocalTypes,
  ): CastForOfStmt {
    return {
      ...statement,
      iterable: this.rewriteExpression(statement.iterable, locals),
      body: this.rewriteBlock(statement.body, returnType, locals),
    };
  }

  private rewriteForIn(
    statement: CastForInStmt,
    returnType: CastTypeRef | null,
    locals: LocalTypes,
  ): CastForInStmt {
    return {
      ...statement,
      iterable: this.rewriteExpression(statement.iterable, locals),
      body: this.rewriteBlock(statement.body, returnType, locals),
    };
  }

  private rewriteIf(
    statement: CastIfStmt,
    returnType: CastTypeRef | null,
    locals: LocalTypes,
  ): CastIfStmt {
    return {
      ...statement,
      condition: this.rewriteExpression(statement.condition, locals),
      thenBody: this.rewriteBlock(statement.thenBody, returnType, locals),
      elseBody: statement.elseBody
        ? this.rewriteBlock(statement.elseBody, returnType, locals)
        : null,
    };
  }

  private rewriteExpressionWithExpectedType(
    expression: CastExpression,
    expected: CastTypeRef | null,
    locals: LocalTypes,
  ): CastExpression {
    if (expected === null) return this.rewriteExpression(expression, locals);
    if (expression.kind === "NewExpr") {
      return this.rewriteExpression(inferNewExpressionTypeArgs(expression, expected), locals);
    }
    if (expression.kind === "RecordLiteralExpr") {
      return this.rewriteRecordLiteralWithExpectedType(expression, expected, locals);
    }
    if (expression.kind === "ArrayLiteralExpr") {
      return this.rewriteArrayLiteralWithExpectedType(expression, expected, locals);
    }
    if (expression.kind === "ConditionalExpr") {
      return this.rewriteConditionalWithExpectedType(expression, expected, locals);
    }
    return this.rewriteExpression(expression, locals);
  }

  private rewriteConditionalWithExpectedType(
    expression: CastConditionalExpr,
    expected: CastTypeRef,
    locals: LocalTypes,
  ): CastConditionalExpr {
    return {
      ...expression,
      condition: this.rewriteExpression(expression.condition, locals),
      whenTrue: this.rewriteExpressionWithExpectedType(expression.whenTrue, expected, locals),
      whenFalse: this.rewriteExpressionWithExpectedType(expression.whenFalse, expected, locals),
    };
  }

  private rewriteRecordLiteralWithExpectedType(
    expression: CastRecordLiteralExpr,
    expected: CastTypeRef,
    locals: LocalTypes,
  ): CastRecordLiteralExpr {
    if (expected.kind !== "RecordTypeRef") return this.rewriteRecordLiteral(expression, locals);
    return {
      ...expression,
      fields: expression.fields.map((field) => {
        if (field.kind === "Spread") {
          return { ...field, expression: this.rewriteExpression(field.expression, locals) };
        }
        return {
          ...field,
          expression: this.rewriteExpressionWithExpectedType(
            field.expression,
            expected.fields.find((candidate) => candidate.name === field.name)?.type ?? null,
            locals,
          ),
        };
      }),
    };
  }

  private rewriteArrayLiteralWithExpectedType(
    expression: CastArrayLiteralExpr,
    expected: CastTypeRef,
    locals: LocalTypes,
  ): CastArrayLiteralExpr {
    return {
      ...expression,
      elements: expression.elements.map((item, index) =>
        this.rewriteExpressionWithExpectedType(item, expectedElementType(expected, index), locals)
      ),
    };
  }

  private inferNewExpressionTypeArgsFromArgs(
    expression: CastNewExpr,
    locals: LocalTypes,
  ): CastNewExpr {
    const template = this.templates.get(expression.className) ?? null;
    if (template === null) return expression;
    const typeArgs = inferGenericClassNewTypeArgsFromArgs(
      template,
      expression,
      (arg) => localArgumentType(arg, locals, this.concrete, this.functions),
    );
    return typeArgs === null ? expression : { ...expression, typeArgs };
  }

  private rewriteExpression(
    expression: CastExpression,
    locals: LocalTypes = new Map(),
  ): CastExpression {
    switch (expression.kind) {
      case "IntegerLiteral":
      case "FloatLiteral":
      case "BoolLiteral":
      case "ZeroValueExpr":
      case "StringLiteral":
      case "IdentifierExpr":
        return expression;
      case "ArrowFunctionExpr":
        return { ...expression, body: this.rewriteExpression(expression.body, locals) };
      case "UnaryExpr":
        return this.rewriteUnary(expression, locals);
      case "BinaryExpr":
        return this.rewriteBinary(expression, locals);
      case "ConditionalExpr":
        return this.rewriteConditional(expression, locals);
      case "NullishCoalesceExpr":
        return this.rewriteNullish(expression, locals);
      case "CastExpr":
      case "SatisfiesExpr":
        return { ...expression, expression: this.rewriteExpression(expression.expression, locals) };
      case "CallExpr":
        return this.rewriteCall(expression, locals);
      case "NewExpr":
        return this.rewriteNew(expression, locals);
      case "MethodCallExpr":
        return this.rewriteMethodCall(expression, locals);
      case "PostfixPointerExpr":
        return this.rewritePostfixPointer(expression, locals);
      case "NonNullAssertExpr":
        return this.rewriteNonNullAssert(expression, locals);
      case "FieldAccessExpr":
        return { ...expression, operand: this.rewriteExpression(expression.operand, locals) };
      case "OptionalFieldAccessExpr":
        return this.rewriteOptionalFieldAccess(expression, locals);
      case "OptionalMethodCallExpr":
        return this.rewriteOptionalMethodCall(expression, locals);
      case "OptionalIndexExpr":
        return this.rewriteOptionalIndex(expression, locals);
      case "RecordLiteralExpr":
        return this.rewriteRecordLiteral(expression, locals);
      case "ArrayLiteralExpr":
        return this.rewriteArrayLiteral(expression, locals);
      case "IndexExpr":
        return this.rewriteIndex(expression, locals);
    }
  }

  private rewriteUnary(expression: CastUnaryExpr, locals: LocalTypes): CastUnaryExpr {
    return { ...expression, operand: this.rewriteExpression(expression.operand, locals) };
  }

  private rewriteBinary(expression: CastBinaryExpr, locals: LocalTypes): CastBinaryExpr {
    return {
      ...expression,
      left: this.rewriteExpression(expression.left, locals),
      right: this.rewriteExpression(expression.right, locals),
    };
  }

  private rewriteConditional(
    expression: CastConditionalExpr,
    locals: LocalTypes,
  ): CastConditionalExpr {
    return {
      ...expression,
      condition: this.rewriteExpression(expression.condition, locals),
      whenTrue: this.rewriteExpression(expression.whenTrue, locals),
      whenFalse: this.rewriteExpression(expression.whenFalse, locals),
    };
  }

  private rewriteNullish(
    expression: CastNullishCoalesceExpr,
    locals: LocalTypes,
  ): CastNullishCoalesceExpr {
    return {
      ...expression,
      left: this.rewriteExpression(expression.left, locals),
      fallback: this.rewriteExpressionWithExpectedType(
        expression.fallback,
        nullishFallbackType(expression.left, locals, this.concrete),
        locals,
      ),
    };
  }

  private rewriteCall(expression: CastCallExpr, locals: LocalTypes): CastCallExpr {
    return {
      ...expression,
      typeArgs: expression.typeArgs?.map((typeArg) => this.rewriteTypeRef(typeArg)),
      args: expression.args.map((arg, index) =>
        this.rewriteExpressionWithExpectedType(
          arg,
          this.callParamType(expression.callee, index),
          locals,
        )
      ),
    };
  }

  private callParamType(callee: Str, index: usize): CastTypeRef | null {
    return this.functions.get(callee)?.params[index]?.type ?? null;
  }

  private rewriteNew(expression: CastNewExpr, locals: LocalTypes): CastNewExpr {
    const inferred = this.inferNewExpressionTypeArgsFromArgs(expression, locals);
    const typeRef = this.rewriteTypeRef({
      kind: "NamedTypeRef",
      name: inferred.className,
      typeArgs: inferred.typeArgs,
      span: inferred.span,
    });
    return {
      ...inferred,
      className: typeRef.kind === "NamedTypeRef" ? typeRef.name : inferred.className,
      typeArgs: [],
      args: inferred.args.map((arg) => this.rewriteExpression(arg, locals)),
    };
  }

  private rewriteMethodCall(
    expression: CastMethodCallExpr,
    locals: LocalTypes,
  ): CastMethodCallExpr {
    return {
      ...expression,
      receiver: this.rewriteExpression(expression.receiver, locals),
      args: expression.args.map((arg) => this.rewriteExpression(arg, locals)),
    };
  }

  private rewritePostfixPointer(
    expression: CastPostfixPointerExpr,
    locals: LocalTypes,
  ): CastPostfixPointerExpr {
    return { ...expression, operand: this.rewriteExpression(expression.operand, locals) };
  }

  private rewriteNonNullAssert(
    expression: CastNonNullAssertExpr,
    locals: LocalTypes,
  ): CastNonNullAssertExpr {
    return { ...expression, operand: this.rewriteExpression(expression.operand, locals) };
  }

  private rewriteOptionalFieldAccess(
    expression: CastOptionalFieldAccessExpr,
    locals: LocalTypes,
  ): CastOptionalFieldAccessExpr {
    return { ...expression, operand: this.rewriteExpression(expression.operand, locals) };
  }

  private rewriteOptionalMethodCall(
    expression: CastOptionalMethodCallExpr,
    locals: LocalTypes,
  ): CastOptionalMethodCallExpr {
    return {
      ...expression,
      receiver: this.rewriteExpression(expression.receiver, locals),
      args: expression.args.map((arg) => this.rewriteExpression(arg, locals)),
    };
  }

  private rewriteOptionalIndex(
    expression: CastOptionalIndexExpr,
    locals: LocalTypes,
  ): CastOptionalIndexExpr {
    return {
      ...expression,
      operand: this.rewriteExpression(expression.operand, locals),
      index: this.rewriteExpression(expression.index, locals),
    };
  }

  private rewriteRecordLiteral(
    expression: CastRecordLiteralExpr,
    locals: LocalTypes,
  ): CastRecordLiteralExpr {
    return {
      ...expression,
      fields: expression.fields.map((field) => ({
        ...field,
        expression: this.rewriteExpression(field.expression, locals),
      })),
    };
  }

  private rewriteArrayLiteral(
    expression: CastArrayLiteralExpr,
    locals: LocalTypes,
  ): CastArrayLiteralExpr {
    return {
      ...expression,
      elements: expression.elements.map((element) => this.rewriteExpression(element, locals)),
    };
  }

  private rewriteIndex(expression: CastIndexExpr, locals: LocalTypes): CastIndexExpr {
    return {
      ...expression,
      operand: this.rewriteExpression(expression.operand, locals),
      index: this.rewriteExpression(expression.index, locals),
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
    this.checkClassTypeArgs(typeArgs);
    this.checkClassConstraints(template, typeArgs, type.span);
    const name = classInstantiationName(template.name, typeArgs);
    this.checkInstantiationCycle(template.name, name, type.span);
    if (!this.emitted.has(name)) {
      this.active.add(name);
      try {
        this.emitted.set(name, this.createInstantiation(template, typeArgs, name));
      } finally {
        this.active.delete(name);
      }
    }
    return { kind: "NamedTypeRef", name, span: type.span };
  }

  private checkClassTypeArgs(typeArgs: CastTypeRef[]): void {
    const diagnostics = typeArgs.flatMap((typeArg) => this.classTypeArgDiagnostics(typeArg));
    if (diagnostics.length > 0) throw new TypeCError(diagnostics);
  }

  private classTypeArgDiagnostics(typeArg: CastTypeRef): Diagnostic[] {
    if (typeArg.kind !== "NamedTypeRef") return [];
    const diagnostic = this.classTypeArgDiagnostic(typeArg, typeArg.span);
    return diagnostic === null ? [] : [diagnostic];
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
      code: CLASS_TYPE_ARGUMENT_ARITY,
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
        initializer: field.initializer,
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

  private checkInstantiationCycle(templateName: Str, name: Str, span: CastTypeRef["span"]): void {
    if (!this.active.has(name)) return;
    throw new TypeCError([{
      message: `Recursive generic instantiation cycle involving class '${templateName}'`,
      code: GENERIC_INSTANTIATION_CYCLE,
      span,
    }]);
  }

  private checkClassConstraints(
    template: CastClassDecl,
    typeArgs: CastTypeRef[],
    span: CastTypeRef["span"],
  ): void {
    const diagnostics: Diagnostic[] = [];
    const params = template.genericParams ?? [];
    for (let index: usize = 0; index < params.length; index += 1) {
      const param = params[index];
      const constraint = param.constraint;
      const typeArg = typeArgs[index];
      if (!constraint || !typeArg) continue;
      diagnostics.push(
        ...this.checkClassConstraint(typeArg, constraint, span, {
          className: template.name,
          paramName: param.name,
        }),
      );
    }
    if (diagnostics.length > 0) throw new TypeCError(diagnostics);
  }

  private checkClassConstraint(
    typeArg: CastTypeRef,
    constraint: CastTypeRef,
    span: CastTypeRef["span"],
    subject: ClassConstraintSubject,
  ): Diagnostic[] {
    if (constraint.kind === "LiteralTypeRef") {
      return exactLiteralClassConstraintDiagnostic(typeArg, constraint, span, subject);
    }
    if (constraint.kind === "RecordTypeRef") {
      return recordClassConstraintDiagnostics(
        typeArg,
        constraint,
        span,
        subject,
        this.recordContext(),
      );
    }
    if (constraint.kind !== "NamedTypeRef" || typeArg.kind !== "NamedTypeRef") {
      return [{
        message: classConstraintMessage(subject, typeName(lowerTypeRef(typeArg)), "constraint"),
        code: CLASS_CONSTRAINT_UNSATISFIED,
        span,
      }];
    }
    const interfaceDecl = this.interfaces.find((candidate) => candidate.name === constraint.name);
    if (interfaceDecl === null || interfaceDecl === undefined) {
      const typeArgName = typeName(lowerTypeRef(typeArg));
      const constraintName = typeName(lowerTypeRef(constraint));
      if (typeArgName === constraintName) return [];
      return [{
        message: exactNamedClassConstraintMessage(subject, typeArgName, constraintName),
        code: CLASS_CONSTRAINT_UNSATISFIED,
        span,
      }];
    }
    const typeArgDiagnostic = this.classTypeArgDiagnostic(typeArg, span);
    if (typeArgDiagnostic !== null) return [typeArgDiagnostic];
    const classDecl = this.concrete.get(typeArg.name);
    if (!classDecl) {
      return [{
        message: classConstraintMessage(subject, typeArg.name, constraint.name),
        code: CLASS_CONSTRAINT_UNSATISFIED,
        span,
      }];
    }
    return missingCastInterfaceMethods(classDecl, interfaceDecl, span, subject);
  }

  private classTypeArgDiagnostic(
    typeArg: Extract<CastTypeRef, { kind: "NamedTypeRef" }>,
    span: CastTypeRef["span"],
  ): Diagnostic | null {
    if (this.interfaces.some((interfaceDecl) => interfaceDecl.name === typeArg.name)) {
      return {
        message: `Interface value type '${typeArg.name}' is not implemented`,
        code: CLASS_INTERFACE_VALUE_TYPE,
        span,
      };
    }
    return this.isKnownTypeArg(typeArg.name)
      ? null
      : { message: `Unknown type '${typeArg.name}'`, code: CLASS_UNKNOWN_TYPE_ARGUMENT, span };
  }

  private isKnownTypeArg(typeNameText: Str): b8 {
    return primitiveTypes.has(typeNameText) ||
      this.typeAliases.has(typeNameText) ||
      this.concrete.has(typeNameText) ||
      hasStructName(typeNameText, this.structs) ||
      hasCastEnumName(typeNameText, this.enums) ||
      hasCastTaggedUnionName(typeNameText, this.taggedUnions);
  }

  private recordContext(): ClassRecordConstraintContext {
    return {
      typeAliases: this.typeAliases,
      classes: this.concrete,
      structs: this.structs,
    };
  }
}

function rewriteTypeChildren(
  type: CastTypeRef,
  rewrite: (type: CastTypeRef) => CastTypeRef,
): CastTypeRef {
  switch (type.kind) {
    case "NamedTypeRef":
      return type.typeArgs === undefined ? type : { ...type, typeArgs: type.typeArgs.map(rewrite) };
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
    case "TupleTypeRef":
      return { ...type, elements: type.elements.map(rewrite) };
    case "UnionTypeRef":
      return { ...type, members: type.members.map(rewrite) };
    case "IntersectionTypeRef":
      return { ...type, members: type.members.map(rewrite) };
    case "ConditionalTypeRef":
      return {
        ...type,
        checkType: rewrite(type.checkType),
        extendsType: rewrite(type.extendsType),
        trueType: rewrite(type.trueType),
        falseType: rewrite(type.falseType),
      };
    case "IndexedAccessTypeRef":
      return { ...type, objectType: rewrite(type.objectType) };
    case "MappedTypeRef":
      return { ...type, sourceType: rewrite(type.sourceType), valueType: rewrite(type.valueType) };
    case "LiteralTypeRef":
    case "TypeofTypeRef":
      return type;
    case "KeyofTypeRef":
      return { ...type, target: rewrite(type.target) };
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

function substituteParam(param: CastParam, substitutions: CastTypeSubstitutions): CastParam {
  return { ...param, type: substituteTypeRef(param.type, substitutions) };
}

function substituteTypeRef(type: CastTypeRef, substitutions: CastTypeSubstitutions): CastTypeRef {
  if (type.kind === "NamedTypeRef") {
    const substituted = substitutions.get(type.name) ?? null;
    if (substituted !== null) return substituted;
  }
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
        code: CLASS_INHERITANCE_CYCLE,
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
        code: CLASS_EXTENDS_TARGET,
        span: baseRef.span,
      });
      this.resolved.set(classDecl.name, classDecl);
      return classDecl;
    }
    const base = this.classMap.get(baseRef.name) ?? null;
    if (base === null) {
      this.diagnostics.push({
        message: `Unknown base class '${baseRef.name}'`,
        code: CLASS_UNKNOWN_BASE,
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
        code: CLASS_INHERITED_FIELD_CONFLICT,
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
          code: CLASS_IMPLEMENTS_TARGET,
          span: implemented.span,
        }];
      }
      const interfaceDecl = interfaces.find((candidate) => candidate.name === implemented.name);
      if (!interfaceDecl) {
        return [{
          message: `Unknown interface '${implemented.name}'`,
          code: CLASS_UNKNOWN_INTERFACE,
          span: implemented.span,
        }];
      }
      return missingCastInterfaceMethods(classDecl, interfaceDecl, implemented.span);
    })
  );
}

function missingCastInterfaceMethods(
  classDecl: CastClassDecl,
  interfaceDecl: CastInterfaceDecl,
  span: CastTypeRef["span"],
  subject?: ClassConstraintSubject,
): Diagnostic[] {
  return interfaceDecl.methods.flatMap((method) => {
    const classMethod = classDecl.methods.find((candidate) => candidate.name === method.name);
    if (classMethod === undefined) {
      return [castInterfaceMethodDiagnostic(classDecl, interfaceDecl, method.name, span, subject)];
    }
    if (castMethodSignatureMatches(classMethod, method)) return [];
    return [castInterfaceMethodDiagnostic(
      classDecl,
      interfaceDecl,
      method.name,
      span,
      subject,
      true,
    )];
  });
}

function castInterfaceMethodDiagnostic(
  classDecl: CastClassDecl,
  interfaceDecl: CastInterfaceDecl,
  methodName: Str,
  span: CastTypeRef["span"],
  subject?: ClassConstraintSubject,
  mismatched: b8 = false,
): Diagnostic {
  return {
    message: castInterfaceMethodMessage(
      classDecl.name,
      interfaceDecl.name,
      methodName,
      subject,
      mismatched,
    ),
    code: CLASS_INTERFACE_METHOD_MISSING,
    span,
  };
}

function castInterfaceMethodMessage(
  className: Str,
  interfaceName: Str,
  methodName: Str,
  subject?: ClassConstraintSubject,
  mismatched: b8 = false,
): Str {
  const prefix = classConstraintMessage(subject, className, interfaceName);
  if (!mismatched) return `${prefix}: missing method '${methodName}'`;
  return `${prefix}: method '${methodName}' signature does not match`;
}

function exactLiteralClassConstraintDiagnostic(
  typeArg: CastTypeRef,
  constraint: CastTypeRef,
  span: CastTypeRef["span"],
  subject: ClassConstraintSubject,
): Diagnostic[] {
  const typeArgName = typeName(lowerTypeRef(typeArg));
  const constraintName = typeName(lowerTypeRef(constraint));
  return typeArgName === constraintName ? [] : [{
    message: literalClassConstraintMessage(subject, typeArgName, constraintName),
    code: CLASS_CONSTRAINT_UNSATISFIED,
    span,
  }];
}

interface ClassRecordConstraintContext {
  typeAliases: Map<Str, CastTypeRef>;
  classes: Map<Str, CastClassDecl>;
  structs: CastStructDecl[];
}

type ClassRecordConstraintField = CastRecordTypeRef["fields"][usize];
type ClassRecordShapeMismatch =
  | { kind: "MissingField"; path: Str; expected: ClassRecordConstraintField }
  | {
    kind: "RequiredFieldOptional";
    path: Str;
    expected: ClassRecordConstraintField;
    actual: ClassRecordConstraintField;
  }
  | {
    kind: "ReadonlyFieldMutable";
    path: Str;
    expected: ClassRecordConstraintField;
    actual: ClassRecordConstraintField;
  }
  | {
    kind: "FieldTypeMismatch";
    path: Str;
    expected: ClassRecordConstraintField;
    actual: ClassRecordConstraintField;
  };

function recordClassConstraintDiagnostics(
  typeArg: CastTypeRef,
  constraint: CastRecordTypeRef,
  span: CastTypeRef["span"],
  subject: ClassConstraintSubject,
  context: ClassRecordConstraintContext,
): Diagnostic[] {
  const actual = recordClassConstraintSubject(typeArg, context);
  if (actual === null) return [unsatisfiedRecordClassConstraint(typeArg, span, subject)];
  return recordClassConstraintFieldDiagnostics(typeArg, constraint, actual, context, span, subject);
}

function recordClassConstraintSubject(
  typeArg: CastTypeRef,
  context: ClassRecordConstraintContext,
): CastRecordTypeRef | null {
  if (typeArg.kind === "RecordTypeRef") return typeArg;
  if (typeArg.kind !== "NamedTypeRef") return null;
  const alias = context.typeAliases.get(typeArg.name) ?? null;
  if (alias?.kind === "RecordTypeRef") return alias;
  const classDecl = context.classes.get(typeArg.name) ?? null;
  if (classDecl !== null) return classRecordConstraintType(classDecl);
  const structDecl = context.structs.find((candidate) => candidate.name === typeArg.name) ?? null;
  return structDecl === null ? null : structRecordConstraintType(structDecl);
}

function classRecordConstraintType(classDecl: CastClassDecl): CastRecordTypeRef {
  return {
    kind: "RecordTypeRef",
    fields: classDecl.fields.map((field) => ({
      name: field.name,
      type: field.type,
      readonly: field.readonly,
      optional: false,
      span: field.span,
    })),
    span: classDecl.span,
  };
}

function structRecordConstraintType(structDecl: CastStructDecl): CastRecordTypeRef {
  return { kind: "RecordTypeRef", fields: structDecl.fields, span: structDecl.span };
}

function recordClassConstraintFieldDiagnostics(
  typeArg: CastTypeRef,
  constraint: CastRecordTypeRef,
  actual: CastRecordTypeRef,
  context: ClassRecordConstraintContext,
  span: CastTypeRef["span"],
  subject: ClassConstraintSubject,
): Diagnostic[] {
  return recordClassShapeMismatches(constraint, actual, context).map((mismatch) =>
    recordClassConstraintMismatch(typeArg, mismatch, span, subject)
  );
}

function recordClassShapeMismatches(
  expected: CastRecordTypeRef,
  actual: CastRecordTypeRef,
  context: ClassRecordConstraintContext,
  prefix: Str = "",
): ClassRecordShapeMismatch[] {
  return expected.fields.flatMap((field) =>
    recordClassFieldMismatches(field, actual, context, prefix)
  );
}

function recordClassFieldMismatches(
  expected: ClassRecordConstraintField,
  actual: CastRecordTypeRef,
  context: ClassRecordConstraintContext,
  prefix: Str,
): ClassRecordShapeMismatch[] {
  const path = recordClassFieldPath(prefix, expected.name);
  const actualField = actual.fields.find((field) => field.name === expected.name) ?? null;
  if (actualField === null) {
    return expected.optional === true ? [] : [{ kind: "MissingField", path, expected }];
  }
  if (expected.optional !== true && actualField.optional === true) {
    return [{ kind: "RequiredFieldOptional", path, expected, actual: actualField }];
  }
  if (expected.readonly !== true && actualField.readonly === true) {
    return [{ kind: "ReadonlyFieldMutable", path, expected, actual: actualField }];
  }
  return recordClassFieldTypeMismatches(expected, actualField, context, path);
}

function recordClassFieldPath(prefix: Str, name: Str): Str {
  return prefix.length === 0 ? name : `${prefix}.${name}`;
}

function recordClassFieldTypeMismatches(
  expected: ClassRecordConstraintField,
  actual: ClassRecordConstraintField,
  context: ClassRecordConstraintContext,
  path: Str,
): ClassRecordShapeMismatch[] {
  if (expected.type.kind !== "RecordTypeRef") {
    return typeName(lowerTypeRef(actual.type)) === typeName(lowerTypeRef(expected.type))
      ? []
      : [{ kind: "FieldTypeMismatch", path, expected, actual }];
  }
  const actualRecord = recordClassConstraintSubject(actual.type, context);
  if (actualRecord === null) return [{ kind: "FieldTypeMismatch", path, expected, actual }];
  return recordClassShapeMismatches(expected.type, actualRecord, context, path);
}

function recordClassConstraintMismatch(
  typeArg: CastTypeRef,
  mismatch: ClassRecordShapeMismatch,
  span: CastTypeRef["span"],
  subject: ClassConstraintSubject,
): Diagnostic {
  if (mismatch.kind === "MissingField") {
    return missingRecordClassField(typeArg, mismatch.path, span, subject);
  }
  if (mismatch.kind === "RequiredFieldOptional") {
    return optionalRecordClassField(typeArg, mismatch.path, span, subject);
  }
  if (mismatch.kind === "ReadonlyFieldMutable") {
    return readonlyRecordClassField(typeArg, mismatch.path, span, subject);
  }
  return mismatchedRecordClassField(
    typeArg,
    mismatch.path,
    mismatch.expected,
    mismatch.actual,
    span,
    subject,
  );
}

function unsatisfiedRecordClassConstraint(
  typeArg: CastTypeRef,
  span: CastTypeRef["span"],
  subject: ClassConstraintSubject,
): Diagnostic {
  return {
    message: `${recordClassConstraintPrefix(typeArg, subject)} does not satisfy record shape`,
    code: CLASS_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function missingRecordClassField(
  typeArg: CastTypeRef,
  fieldName: Str,
  span: CastTypeRef["span"],
  subject: ClassConstraintSubject,
): Diagnostic {
  return {
    message: `${
      recordClassConstraintPrefix(typeArg, subject)
    } is missing required field '${fieldName}' for record constraint`,
    code: CLASS_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function optionalRecordClassField(
  typeArg: CastTypeRef,
  fieldName: Str,
  span: CastTypeRef["span"],
  subject: ClassConstraintSubject,
): Diagnostic {
  return {
    message: `${
      recordClassConstraintPrefix(typeArg, subject)
    } has optional field '${fieldName}' but record constraint requires it`,
    code: CLASS_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function readonlyRecordClassField(
  typeArg: CastTypeRef,
  fieldName: Str,
  span: CastTypeRef["span"],
  subject: ClassConstraintSubject,
): Diagnostic {
  return {
    message: `${
      recordClassConstraintPrefix(typeArg, subject)
    } has readonly field '${fieldName}' but record constraint requires a mutable field`,
    code: CLASS_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function mismatchedRecordClassField(
  typeArg: CastTypeRef,
  fieldPath: Str,
  expected: ClassRecordConstraintField,
  actual: ClassRecordConstraintField,
  span: CastTypeRef["span"],
  subject: ClassConstraintSubject,
): Diagnostic {
  return {
    message: `${recordClassConstraintPrefix(typeArg, subject)} has field '${fieldPath}' of type '${
      typeName(lowerTypeRef(actual.type))
    }' but record constraint requires '${typeName(lowerTypeRef(expected.type))}'`,
    code: CLASS_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function recordClassConstraintPrefix(
  typeArg: CastTypeRef,
  subject: ClassConstraintSubject,
): Str {
  return `Generic class '${subject.className}' type parameter '${subject.paramName}' with type '${
    typeName(lowerTypeRef(typeArg))
  }'`;
}

function classConstraintMessage(
  subject: ClassConstraintSubject | undefined,
  typeArgName: Str,
  interfaceName: Str,
): Str {
  if (!subject) return `Type '${typeArgName}' does not satisfy '${interfaceName}'`;
  return `Generic class '${subject.className}' type parameter '${subject.paramName}' with type '${typeArgName}' does not satisfy interface '${interfaceName}'`;
}

function exactNamedClassConstraintMessage(
  subject: ClassConstraintSubject | undefined,
  typeArgName: Str,
  constraintName: Str,
): Str {
  if (!subject) return `Type '${typeArgName}' does not satisfy '${constraintName}'`;
  return `Generic class '${subject.className}' type parameter '${subject.paramName}' with type '${typeArgName}' does not satisfy ${constraintName}`;
}

function literalClassConstraintMessage(
  subject: ClassConstraintSubject,
  typeArgName: Str,
  constraintName: Str,
): Str {
  return `Generic class '${subject.className}' type parameter '${subject.paramName}' with type '${typeArgName}' does not satisfy ${constraintName}`;
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

function inferNewExpressionTypeArgs(
  expression: CastNewExpr,
  expected: CastTypeRef,
): CastNewExpr {
  const typeArgs = inferGenericClassNewTypeArgsFromExpected(expression, expected);
  return typeArgs === null ? expression : { ...expression, typeArgs };
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
