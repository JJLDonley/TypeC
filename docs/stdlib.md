# TypeC Standard Library 0.1

The standard library is ordinary TypeC source imported through `std/` paths. It has no hidden
runtime and no compiler-only APIs.

## `std/result`

`ResultI32` is the 0.1 exported result value for `i32` payloads:

```ts
import { result_ok_i32, ResultI32 } from "std/result.tc";
const value: ResultI32 = result_ok_i32(1, 0);
```

Public helpers:

- `result_ok_i32(value: i32, zero_error: i32): ResultI32`
- `result_err_i32(zero_value: i32, error: i32): ResultI32`
- `result_is_ok_i32(result: ResultI32): bool`
- `result_is_err_i32(result: ResultI32): bool`
- `result_unwrap_or_i32(result: ResultI32, fallback: i32): i32`
- `result_error_or_i32(result: ResultI32, fallback: i32): i32`

Generic `Result<T, E>` is not exposed in 0.1 because generic type aliases are not exported across
module boundaries yet.

## `std/option`

`OptionI32` is a portable record option for exported APIs. Built-in `T?` remains available inside
normal TypeC code.

Public helpers:

- `option_some_i32(value: i32): OptionI32`
- `option_none_i32(): OptionI32`
- `option_is_some_i32(value: OptionI32): bool`
- `option_unwrap_or_i32(value: OptionI32, fallback: i32): i32`

## `std/slice`

Exported slice helpers avoid passing `Slice<T>` across the C ABI boundary in 0.1.

Public helpers:

- `slice_len_identity(length: usize): usize`
- `slice_is_empty_length(length: usize): bool`
- `slice_first_i32(data: i32*): i32`

## `std/mem`

Memory helpers are explicit numeric utilities. They do not allocate.

Public helpers:

- `align_up_usize(value: usize, alignment: usize): usize`
- `is_aligned_usize(value: usize, alignment: usize): bool`

`alignment` must be non-zero.

## `std/c`

C interop helpers use TypeC C scalar aliases.

Public helpers:

- `c_int_zero(): c_int`
- `c_uint_zero(): c_uint`
- `c_size_zero(): usize`

## `std/test`

Test helpers return `0` on success and `1` on failure so examples can use them from `main`.

Public helpers:

- `assert_true(condition: bool): i32`
- `assert_false(condition: bool): i32`
- `assert_eq_i32(left: i32, right: i32): i32`

## Examples

Every public module has a compile-tested example:

- `examples/std_result.tc`
- `examples/std_option.tc`
- `examples/std_slice.tc`
- `examples/std_mem.tc`
- `examples/std_c.tc`
- `examples/std_test.tc`
