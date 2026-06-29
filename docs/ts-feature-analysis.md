# TypeScript Feature Analysis for TypeC

TypeC is not TypeScript and does not attempt JavaScript runtime compatibility. It uses
TypeScript-like syntax only when the feature can remain statically typed, ahead-of-time checked, and
predictably emitted to C.

This document distinguishes between **syntax accepted today** and **practical TypeScript-style
ergonomics**.

## Recently completed critical features

### Optional Value Constructors

TypeC supports contextual optional construction:

```ts
const present: i32? = Some(42);
const empty: i32? = None();
```

These are compiler builtins over TypeC optional structs, not JavaScript `null` or `undefined`.
Explicit `Some<T>(value)` and `None<T>()` remain accepted when context is not enough.

### Phase 42: Static Class Inheritance

TypeC now supports a narrow static `extends` subset:

```ts
class Entity {
  x: i32;
  shifted(dx: i32): i32 {
    return this.x + dx;
  }
}

class Ship extends Entity {
  hp: i32;
}
```

Inherited fields are flattened into the child record and inherited methods are copied for static
dispatch on the child type. This does not add implicit subtyping, `super`, constructor inheritance,
vtable dispatch, prototypes, or JavaScript runtime semantics.

### Phase 41: Basic Constructors and `new`

TypeC now supports value-style constructors:

```ts
class Point {
  x: i32;
  constructor(x: i32) {
    this.x = x;
  }
}

const p: Point = new Point(1);
```

`new Class(...)` returns a class value through a generated C helper. It does not allocate hidden
heap memory and does not add overloads, `super`, parameter properties, or JavaScript prototype
semantics.

### Phase 40: Class `implements`

TypeC now supports explicit static class/interface contracts:

```ts
interface Drawable {
  draw(): void;
}

class Ship implements Drawable {
  draw(): void {
    return;
  }
}
```

This nominal contract is used by generic constraints and explicit borrowed interface conversions.
Owning interface-typed values, structural conversion, JavaScript object dispatch, inheritance, and
`new` are still rejected.

### Phase 39: Basic `for` Loops

TypeC now supports basic TypeScript/C-style counted loops:

```ts
for (let i: usize = 0; i < count; i++) {
  update(i);
}
```

The initializer is scoped to the loop. Conditions must be `bool`. TypeC also supports static
`for..of`, static `for..in`, and `continue`; JavaScript iterators and enumerable-property semantics
are still rejected.

### Phase 38: General Assignment Targets

TypeC now supports assignment, compound assignment, and statement-only increment/decrement over
static lvalue targets:

```ts
x = value;
obj.field = value;
arr[i] = value;
obj.pos.x += dx;
items[i].alive = false;
items[i].count++;
```

Assignments remain statements only. TypeC still does not implement assignment expressions,
destructuring assignment, logical assignment, or nullish assignment.

## Remaining critical gaps

These are the most important missing or partial features for writing real TypeScript-like programs.

| Priority | Feature                                     | Status      | Why it matters                  | Current impact                                                                                    |
| -------- | ------------------------------------------- | ----------- | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| P1       | Broader interface ergonomics                | Partial     | Needed for polymorphic OO APIs. | Explicit borrowed `Interface&` dispatch exists; owning/structural interface values are rejected.  |
| P1       | Function/local type inference               | Partial     | Reduces annotation noise.       | Local inference and contextual optionals work; full TS-style inference is out of scope.           |
| P2       | Destructuring                               | Partial     | Common TS binding syntax.       | Local record/tuple/array destructuring exists; parameter and assignment destructuring are absent. |
| P2       | Object/array spread                         | Partial     | Common TS copy/update syntax.   | Static record spread/rest exists; JS array/object runtime spread is rejected.                     |
| P2       | Default/rest parameters for TypeC functions | Implemented | Common TS call ergonomics.      | Defaults rewrite at call sites and rest parameters lower to slices, not JS arrays.                |
| P2       | Type unions/intersections                   | Partial     | Major TS type-system feature.   | Tagged-union and static intersection aliases exist without TS runtime semantics.                  |

## Implemented but narrower than TypeScript

| Feature                                | Current TypeC behavior                                                                          | Important limitation                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Records / object type literals         | Static record/scalar aliases, optional fields, literals, field reads/writes, spread/rest.       | No index signatures, prototype properties, or dynamic keys.                            |
| Arrays                                 | Fixed/inferred arrays, literals, indexing, indexed assignment, `Array.fill`, slices, C interop. | No sparse arrays, push/pop, or JS array object model.                                  |
| Classes                                | Static layout lowered to records plus functions with constructors, `extends`, and `implements`. | Inheritance is flattened/static only; no prototype model or runtime dispatch.          |
| Methods                                | Instance-call syntax lowers to explicit functions; inherited methods are copied.                | Dispatch is static; methods receive values unless a reference type is used explicitly. |
| Interfaces                             | Static contracts plus explicit borrowed `Interface&` dispatch views.                            | Owning interface values, structural conversion, and JS object dispatch are rejected.   |
| Generics                               | Compile-time monomorphization for functions/classes.                                            | Inference is intentionally static and limited compared with full TypeScript.           |
| Imports                                | Static named/default imports, aliases, namespace imports, and re-exports.                       | No live JS bindings, module objects, or dynamic loading.                               |
| Optional chaining / nullish coalescing | Optional-type based, statically checked; contextual `Some`/`None` constructors.                 | No implicit `null` or `undefined`.                                                     |
| Logical operators                      | Bool-only.                                                                                      | No truthiness; `&&` and `                                                              |
| Bitwise operators                      | Fixed-width integer-only.                                                                       | No JS `ToInt32`/`ToUint32` coercions.                                                  |
| Assignment/update operators            | Statement-only updates over static lvalue targets.                                              | No expression-valued assignment or destructuring assignment.                           |

## Not implemented by design

These are intentionally rejected unless a future phase defines a static, C-emittable meaning:

- `any`
- implicit `undefined`
- implicit `null`
- truthiness for non-`bool` values
- JavaScript object/prototype semantics
- dynamic property creation or lookup by default
- `eval`
- arbitrary JavaScript library interop
- hidden garbage-collected allocation
- async JavaScript promises/event loop semantics

## Current TypeScript support matrix

| TypeScript area       | Status             | Honest summary                                                                                                                                                                          |
| --------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Function declarations | Implemented        | TS-like syntax with required static types plus default, optional, and rest parameters.                                                                                                  |
| Locals                | Implemented subset | `const`/`let`, local inference, and local destructuring exist; assignments target static lvalues and remain statements only.                                                            |
| Control flow          | Partial            | `if`, `else`, `else if`, loops, `for..of`, `for..in`, `switch`, `break`, `continue`, and empty statements exist; no labeled statements, `try`, or `throw`.                              |
| Expressions           | Partial            | Numeric, boolean, calls, field/index reads and writes, conditionals, nullish/optional operators, logical/bitwise operators exist; many JS/TS expression forms are intentionally absent. |
| Records/objects       | Partial            | Creation, optional fields, read/write access, spread/rest, and field mutation exist; dynamic TS object features are absent.                                                             |
| Arrays                | Partial            | Static arrays/slices, reads, indexed mutation, `Array.fill`, and slice helpers exist; no JS array object model.                                                                         |
| Classes               | Partial            | Static class layout, constructors, methods, `extends`, and `implements` exist; no runtime dispatch/prototype semantics.                                                                 |
| Interfaces/contracts  | Partial            | Interface declarations, generic constraints, class implementation declarations, and borrowed `Interface&` dispatch exist; owning interface values are rejected.                         |
| Generics              | Partial            | Compile-time generics exist with static inference; no full TS inference/type-level programming.                                                                                         |
| Modules               | Partial            | Static named/default/namespace imports, aliases, and re-exports exist; no dynamic imports or JS module object.                                                                          |
| C interop             | Implemented subset | Externs/header imports work for supported C ABI shapes; complex macros and unsupported C forms are excluded.                                                                            |

## Recommended next phases

### Later: broader interface polymorphism

Borrowed `Interface&` dispatch exists. Any broader polymorphism should not copy JavaScript
prototypes. If added, it should define explicit interface value representation, dispatch tables,
ownership/lifetime rules, and C emission strategy.
