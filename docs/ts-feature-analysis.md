# TypeScript Feature Analysis for TypeC

TypeC is not TypeScript and does not attempt JavaScript runtime compatibility. It uses
TypeScript-like syntax only when the feature can remain statically typed, ahead-of-time checked, and
predictably emitted to C.

This document distinguishes between **syntax accepted today** and **practical TypeScript-style
ergonomics**. Some features exist only as read/create/access support and are not yet useful for
ordinary mutable programs.

## Critical gaps

These are the most important missing or partial features for writing real TypeScript-like programs.

| Priority | Feature                                     | Status          | Why it matters                                              | Current impact                                                                                                     |
| -------- | ------------------------------------------- | --------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| P0       | General assignment targets                  | Missing         | Needed for normal mutable records, arrays, and objects.     | Only simple local identifiers can be assigned. `obj.x = v`, `arr[i] = v`, and `obj.pos.x += dx` are not supported. |
| P0       | Indexed assignment                          | Missing         | Needed for arrays, buffers, entity lists, and systems code. | Arrays can be initialized and read, but not updated by index.                                                      |
| P0       | Field assignment                            | Missing         | Needed for record/class state updates.                      | Records/classes are mostly immutable-after-construction from source syntax.                                        |
| P0       | Mutable arrays of records                   | Partial         | Needed for games, parsers, collections, ECS-style code.     | You can represent arrays, but cannot mutate elements/fields ergonomically.                                         |
| P1       | `for` loops                                 | Missing         | Core TS/C loop ergonomics.                                  | Must use verbose `while` loops.                                                                                    |
| P1       | Function/local type inference               | Partial         | Reduces annotation noise.                                   | Some local initializer cases work; no broad TS-style inference.                                                    |
| P1       | Constructors / initialization methods       | Missing         | Needed for class ergonomics and invariant setup.            | Classes must be initialized with record literals.                                                                  |
| P1       | Class contracts with `implements`           | Missing         | Needed for explicit static interface satisfaction.          | Generic constraints can check structure, but classes cannot declare intent.                                        |
| P1       | Class inheritance `extends`                 | Missing         | Needed for TS-style OO reuse.                               | No superclass layout, override rules, or dispatch model.                                                           |
| P1       | Optional value construction                 | Partial         | Needed to create/use optionals ergonomically.               | Optional type syntax and operators exist, but value constructors are incomplete.                                   |
| P2       | Destructuring                               | Missing         | Common TS binding syntax.                                   | No object/array destructuring in params or locals.                                                                 |
| P2       | Object/array spread                         | Missing         | Common TS copy/update syntax.                               | No spread semantics; record copying/updating must wait for explicit design.                                        |
| P2       | Default/rest parameters for TypeC functions | Partial/missing | Common TS call ergonomics.                                  | C variadic externs exist; ordinary TS-style defaults/rest are not implemented.                                     |
| P2       | Type unions/intersections                   | Missing         | Major TS type-system feature.                               | Use explicit tagged unions instead of `A                                                                           |

## Implemented but narrower than TypeScript

| Feature                                | Current TypeC behavior                                              | Important limitation                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Records / object type literals         | Static record type aliases and record literals.                     | No optional fields, readonly fields, index signatures, object spread, dynamic keys, or field assignment.                  |
| Arrays                                 | Fixed/inferred arrays, literals, indexing, slices, C array interop. | No array methods, no sparse arrays, no push/pop, no indexed assignment.                                                   |
| Classes                                | Static layout lowered to records plus functions.                    | No constructor, no inheritance, no `implements`, no prototype model, no natural mutable methods without field assignment. |
| Methods                                | Instance-call syntax lowers to explicit functions.                  | Methods can read fields; mutation is blocked by lack of general lvalues.                                                  |
| Interfaces                             | Static method-shape contracts for generic constraints.              | Interfaces are not value types; no class `implements`; no runtime dispatch.                                               |
| Generics                               | Compile-time monomorphization for functions/classes.                | Requires explicit type arguments in many places; no TS-level inference or conditional/mapped types.                       |
| Imports                                | Static named imports, aliases, namespace imports.                   | No default imports, re-exports, live JS bindings, or dynamic loading.                                                     |
| Optional chaining / nullish coalescing | Optional-type based, statically checked.                            | No implicit `null` or `undefined`; optional value construction remains limited.                                           |
| Logical operators                      | Bool-only.                                                          | No truthiness; `&&`/`                                                                                                     |
| Bitwise operators                      | Fixed-width integer-only.                                           | No JS `ToInt32`/`ToUint32` coercions.                                                                                     |
| Assignment/update operators            | Statement-only local-variable updates.                              | No expression-valued assignment; no fields/indexes/pointers as targets.                                                   |

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

| TypeScript area       | Status             | Honest summary                                                                                                                                                               |
| --------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Function declarations | Implemented        | TS-like syntax with required static types.                                                                                                                                   |
| Locals                | Partial            | `const`/`let` exist, but assignment targets are local identifiers only.                                                                                                      |
| Control flow          | Partial            | `if`, `else`, `else if`, `while`, `do while`, `switch`, `break`, empty statements exist; no `for`, `for..of`, `for..in`, labeled statements, `continue`, `try`, or `throw`.  |
| Expressions           | Partial            | Numeric, boolean, calls, field/index reads, conditionals, nullish/optional operators, logical/bitwise operators exist; many JS/TS expression forms are intentionally absent. |
| Records/objects       | Partial            | Creation and read access exist; mutation and TS object type features are mostly missing.                                                                                     |
| Arrays                | Partial            | Static arrays/slices and reads exist; no indexed mutation or JS array API.                                                                                                   |
| Classes               | Partial            | Static class layout and methods exist; no constructors, inheritance, `implements`, or runtime dispatch.                                                                      |
| Interfaces/contracts  | Partial            | Interface declarations and generic constraints exist; no explicit class implementation declarations.                                                                         |
| Generics              | Partial            | Compile-time generics exist; no full TS inference/type-level programming.                                                                                                    |
| Modules               | Partial            | Static named/namespace imports and aliases exist; no default imports/re-exports/dynamic imports.                                                                             |
| C interop             | Implemented subset | Externs/header imports work for supported C ABI shapes; complex macros and unsupported C forms are excluded.                                                                 |

## Recommended next phases

### Phase 38: General Assignment Targets

This is the most important missing feature.

Should support:

```ts
x = value;
obj.field = value;
arr[i] = value;
obj.pos.x += dx;
items[i].alive = false;
```

Required work:

- Parse assignment targets as lvalues, not only identifiers.
- Type-check mutability and assignability for field/index targets.
- Reject assignment to immutable `const`, fixed array variables as whole values, rvalues, and
  invalid C lvalues.
- Emit valid C lvalue assignments and compound assignments.

### Phase 39: `for` loops

Should support the basic C/TS-style counted loop:

```ts
for (let i: usize = 0; i < count; i++) {
  update(i);
}
```

Do not add `for..in` or `for..of` until iterable semantics exist.

### Phase 40: Class `implements`

Should support explicit static contracts:

```ts
interface Drawable {
  draw(): void;
}

class Ship implements Drawable {
  draw(): void {
    // ...
  }
}
```

No runtime dispatch or vtables in this phase.

### Later: constructors and inheritance

Constructors and inheritance need separate specs. Inheritance should not copy JavaScript prototypes.
If added, it should define static layout, method resolution, override checks, and whether dispatch
is static or vtable-based.
