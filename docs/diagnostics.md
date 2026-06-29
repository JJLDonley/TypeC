# TypeC Diagnostic Codes

This document is the TypeC 0.1 diagnostic code inventory. Every compiler diagnostic code exported by
`src/core/diagnostic_codes.ts` is listed here. A code is stable for tooling once it appears in this
file.

## Diagnostic Format

- Severity: `error`.
- Code format: `E` followed by four decimal digits.
- Message shape: a single human-readable sentence generated at the diagnostic site. The message
  names the rejected construct and the expected TypeC rule.
- Source span: the primary span points at the smallest source range that identifies the rejected
  construct. Related spans may point to declarations that explain the error.
- Recovery action: edit the source so it satisfies the documented TypeC 0.1 rule for the category
  listed in the table.
- URL: `diagnosticCodeUrl(code)` maps a code to `https://typec.dev/diagnostics/<code>`.

## Inventory

| Code    | Symbol                                  | Category                              | Recovery                                                                                      |
| ------- | --------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| `E0001` | `UNKNOWN_IDENTIFIER`                    | name resolution                       | Fix the name resolution construct identified by the diagnostic message.                       |
| `E0002` | `DUPLICATE_SYMBOL`                      | name resolution                       | Fix the name resolution construct identified by the diagnostic message.                       |
| `E0003` | `DUPLICATE_FUNCTION`                    | name resolution                       | Fix the name resolution construct identified by the diagnostic message.                       |
| `E0100` | `CALL_ARITY`                            | type checking                         | Fix the type checking construct identified by the diagnostic message.                         |
| `E0101` | `CALL_ARGUMENT_TYPE`                    | type checking                         | Fix the type checking construct identified by the diagnostic message.                         |
| `E0102` | `LOCAL_INITIALIZER_TYPE`                | type checking                         | Fix the type checking construct identified by the diagnostic message.                         |
| `E0103` | `ASSIGNMENT_TYPE`                       | type checking                         | Fix the type checking construct identified by the diagnostic message.                         |
| `E0104` | `RETURN_TYPE`                           | type checking                         | Fix the type checking construct identified by the diagnostic message.                         |
| `E0105` | `RETURN_VALUE_IN_VOID`                  | type checking                         | Fix the type checking construct identified by the diagnostic message.                         |
| `E0106` | `MISSING_RETURN_VALUE`                  | type checking                         | Fix the type checking construct identified by the diagnostic message.                         |
| `E0107` | `CALL_TARGET_TYPE`                      | type checking                         | Call only declared functions or values with function type.                                    |
| `E0200` | `RECORD_LITERAL_TARGET`                 | records                               | Fix the records construct identified by the diagnostic message.                               |
| `E0201` | `DUPLICATE_RECORD_FIELD`                | records                               | Fix the records construct identified by the diagnostic message.                               |
| `E0202` | `UNKNOWN_RECORD_FIELD`                  | records                               | Fix the records construct identified by the diagnostic message.                               |
| `E0203` | `MISSING_RECORD_FIELD`                  | records                               | Fix the records construct identified by the diagnostic message.                               |
| `E0204` | `RECORD_FIELD_TYPE`                     | records                               | Fix the records construct identified by the diagnostic message.                               |
| `E0205` | `RECORD_SPREAD_OPERAND`                 | records                               | Fix the records construct identified by the diagnostic message.                               |
| `E0206` | `RECORD_SPREAD_FIELD_TYPE`              | records                               | Fix the records construct identified by the diagnostic message.                               |
| `E0300` | `SLICE_ARITY`                           | slices                                | Fix the slices construct identified by the diagnostic message.                                |
| `E0301` | `SLICE_INDEX_TYPE`                      | slices                                | Fix the slices construct identified by the diagnostic message.                                |
| `E0302` | `SLICE_ORDER`                           | slices                                | Fix the slices construct identified by the diagnostic message.                                |
| `E0303` | `SLICE_BOUNDS`                          | slices                                | Fix the slices construct identified by the diagnostic message.                                |
| `E0400` | `OPTIONAL_CONSTRUCTOR_CONTEXT`          | optionals                             | Fix the optionals construct identified by the diagnostic message.                             |
| `E0401` | `OPTIONAL_CONSTRUCTOR_ARITY`            | optionals                             | Fix the optionals construct identified by the diagnostic message.                             |
| `E0402` | `OPTIONAL_CONSTRUCTOR_VALUE_TYPE`       | optionals                             | Fix the optionals construct identified by the diagnostic message.                             |
| `E0500` | `IMPORT_PATH_INVALID`                   | modules                               | Use a relative, std, or project dependency import path with `/` separators and `.tc`/`.h`.    |
| `E0501` | `MODULE_NOT_FOUND`                      | modules                               | Ensure the imported module path exists after deterministic path resolution.                   |
| `E0502` | `IMPORT_CYCLE`                          | modules                               | Break the static import cycle.                                                                |
| `E0503` | `DUPLICATE_IMPORT_ALIAS`                | modules                               | Use distinct local names for imported declarations.                                           |
| `E0504` | `MODULE_EXPORT_MISSING`                 | modules                               | Import only declarations exported by the target module.                                       |
| `E0505` | `MODULE_EXPORT_AMBIGUOUS`               | modules                               | Rename or remove ambiguous exported declarations.                                             |
| `E0506` | `DEFAULT_EXPORT_MISSING`                | modules                               | Import a named export or add `export default name;` in the target module.                     |
| `E0507` | `IMPORT_PATH_ESCAPE`                    | modules                               | Keep std and package dependency imports inside their configured roots.                        |
| `E0600` | `CONDITION_TYPE`                        | control flow                          | Fix the control flow construct identified by the diagnostic message.                          |
| `E0601` | `FOR_OF_ITERABLE`                       | control flow                          | Fix the control flow construct identified by the diagnostic message.                          |
| `E0602` | `FOR_IN_ITERABLE`                       | control flow                          | Fix the control flow construct identified by the diagnostic message.                          |
| `E0603` | `BREAK_OUTSIDE_SWITCH`                  | control flow                          | Fix the control flow construct identified by the diagnostic message.                          |
| `E0604` | `CONTINUE_OUTSIDE_LOOP`                 | control flow                          | Fix the control flow construct identified by the diagnostic message.                          |
| `E0605` | `DEFER_CALL_REQUIRED`                   | control flow                          | Fix the control flow construct identified by the diagnostic message.                          |
| `E0700` | `INDEX_NON_INDEXABLE`                   | indexing                              | Fix the indexing construct identified by the diagnostic message.                              |
| `E0701` | `INDEX_TYPE`                            | indexing                              | Fix the indexing construct identified by the diagnostic message.                              |
| `E0702` | `ARRAY_INDEX_BOUNDS`                    | indexing                              | Fix the indexing construct identified by the diagnostic message.                              |
| `E0703` | `TUPLE_INDEX_LITERAL`                   | indexing                              | Fix the indexing construct identified by the diagnostic message.                              |
| `E0704` | `TUPLE_INDEX_BOUNDS`                    | indexing                              | Fix the indexing construct identified by the diagnostic message.                              |
| `E0800` | `FIELD_NON_RECORD`                      | field access                          | Fix the field access construct identified by the diagnostic message.                          |
| `E0801` | `UNKNOWN_FIELD_ACCESS`                  | field access                          | Fix the field access construct identified by the diagnostic message.                          |
| `E0802` | `FIELD_ACCESS_RESTRICTED`               | field access                          | Fix the field access construct identified by the diagnostic message.                          |
| `E0803` | `ARRAY_FIELD_ACCESS`                    | field access                          | Fix the field access construct identified by the diagnostic message.                          |
| `E0804` | `SLICE_FIELD_ACCESS`                    | field access                          | Fix the field access construct identified by the diagnostic message.                          |
| `E0805` | `UNSIZED_ARRAY_LENGTH`                  | field access                          | Fix the field access construct identified by the diagnostic message.                          |
| `E0900` | `NON_NULL_ASSERT_OPTIONAL`              | optional operators                    | Fix the optional operators construct identified by the diagnostic message.                    |
| `E0901` | `NULLISH_LEFT_OPTIONAL`                 | optional operators                    | Fix the optional operators construct identified by the diagnostic message.                    |
| `E0902` | `NULLISH_FALLBACK_TYPE`                 | optional operators                    | Fix the optional operators construct identified by the diagnostic message.                    |
| `E0903` | `OPTIONAL_CHAIN_OPERAND`                | optional operators                    | Fix the optional operators construct identified by the diagnostic message.                    |
| `E0904` | `OPTIONAL_CHAIN_METHOD`                 | optional operators                    | Fix the optional operators construct identified by the diagnostic message.                    |
| `E1000` | `BINARY_OPERAND_MISMATCH`               | operators                             | Fix the operators construct identified by the diagnostic message.                             |
| `E1001` | `LOGICAL_OPERANDS`                      | operators                             | Fix the operators construct identified by the diagnostic message.                             |
| `E1002` | `SHIFT_LEFT_INTEGER`                    | operators                             | Fix the operators construct identified by the diagnostic message.                             |
| `E1003` | `SHIFT_COUNT_UNSIGNED`                  | operators                             | Fix the operators construct identified by the diagnostic message.                             |
| `E1004` | `UNSIGNED_SHIFT_LEFT`                   | operators                             | Fix the operators construct identified by the diagnostic message.                             |
| `E1005` | `SHIFT_COUNT_BOUNDS`                    | operators                             | Fix the operators construct identified by the diagnostic message.                             |
| `E1006` | `BITWISE_OPERANDS`                      | operators                             | Fix the operators construct identified by the diagnostic message.                             |
| `E1007` | `NUMERIC_OPERANDS`                      | operators                             | Fix the operators construct identified by the diagnostic message.                             |
| `E1008` | `REMAINDER_OPERANDS`                    | operators                             | Fix the operators construct identified by the diagnostic message.                             |
| `E1009` | `DIVIDE_BY_ZERO`                        | operators                             | Fix the operators construct identified by the diagnostic message.                             |
| `E1010` | `UNARY_BOOL_OPERAND`                    | operators                             | Fix the operators construct identified by the diagnostic message.                             |
| `E1011` | `UNARY_INTEGER_OPERAND`                 | operators                             | Fix the operators construct identified by the diagnostic message.                             |
| `E1012` | `UNARY_NUMERIC_OPERAND`                 | operators                             | Fix the operators construct identified by the diagnostic message.                             |
| `E1100` | `INTEGER_LITERAL_RANGE`                 | literals/constants                    | Fix the literals/constants construct identified by the diagnostic message.                    |
| `E1101` | `FLOAT_LITERAL_RANGE`                   | literals/constants                    | Fix the literals/constants construct identified by the diagnostic message.                    |
| `E1102` | `INTEGER_CONSTANT_RANGE`                | literals/constants                    | Fix the literals/constants construct identified by the diagnostic message.                    |
| `E1103` | `FLOAT_CONSTANT_RANGE`                  | literals/constants                    | Fix the literals/constants construct identified by the diagnostic message.                    |
| `E1104` | `STRING_LITERAL_TARGET`                 | literals/constants                    | Fix the literals/constants construct identified by the diagnostic message.                    |
| `E1105` | `STRING_LITERAL_LENGTH`                 | literals/constants                    | Fix the literals/constants construct identified by the diagnostic message.                    |
| `E1200` | `VARIADIC_FUNCTION_EXTERN`              | functions                             | Fix the functions construct identified by the diagnostic message.                             |
| `E1201` | `VARIADIC_FUNCTION_FIXED_PARAM`         | functions                             | Fix the functions construct identified by the diagnostic message.                             |
| `E1202` | `MAIN_FUNCTION_EXTERN`                  | functions                             | Fix the functions construct identified by the diagnostic message.                             |
| `E1203` | `MAIN_FUNCTION_PARAMS`                  | functions                             | Fix the functions construct identified by the diagnostic message.                             |
| `E1204` | `MAIN_FUNCTION_RETURN`                  | functions                             | Fix the functions construct identified by the diagnostic message.                             |
| `E1205` | `OVERLOAD_ORDER`                        | functions                             | Fix the functions construct identified by the diagnostic message.                             |
| `E1206` | `OVERLOAD_IMPLEMENTATION`               | functions                             | Fix the functions construct identified by the diagnostic message.                             |
| `E1207` | `UNKNOWN_FUNCTION`                      | functions                             | Fix the functions construct identified by the diagnostic message.                             |
| `E1300` | `DUPLICATE_GENERIC_PARAMETER`           | generic functions                     | Fix the generic functions construct identified by the diagnostic message.                     |
| `E1301` | `GENERIC_CONSTRAINT_INTERFACE`          | generic functions                     | Fix the generic functions construct identified by the diagnostic message.                     |
| `E1302` | `GENERIC_CONSTRAINT_NAMED_INTERFACE`    | generic functions                     | Fix the generic functions construct identified by the diagnostic message.                     |
| `E1303` | `GENERIC_UNKNOWN_TYPE`                  | generic functions                     | Fix the generic functions construct identified by the diagnostic message.                     |
| `E1304` | `GENERIC_INTERFACE_VALUE_TYPE`          | generic functions                     | Fix the generic functions construct identified by the diagnostic message.                     |
| `E1305` | `UNKNOWN_GENERIC_FUNCTION`              | generic functions                     | Fix the generic functions construct identified by the diagnostic message.                     |
| `E1306` | `GENERIC_TYPE_ARGUMENT_ARITY`           | generic functions                     | Fix the generic functions construct identified by the diagnostic message.                     |
| `E1307` | `GENERIC_CONSTRAINT_INVALID`            | generic functions                     | Fix the generic functions construct identified by the diagnostic message.                     |
| `E1308` | `GENERIC_CONSTRAINT_UNSATISFIED`        | generic functions                     | Fix the generic functions construct identified by the diagnostic message.                     |
| `E1309` | `GENERIC_CONSTRAINT_MISSING_METHOD`     | generic functions                     | Fix the generic functions construct identified by the diagnostic message.                     |
| `E1310` | `GENERIC_INSTANTIATION_CYCLE`           | generics                              | Remove recursive generic instantiation or introduce an explicit indirection type.             |
| `E1400` | `DUPLICATE_ENUM_MEMBER`                 | enums/unions/switch                   | Fix the enums/unions/switch construct identified by the diagnostic message.                   |
| `E1401` | `ENUM_MEMBER_CONSTANT`                  | enums/unions/switch                   | Fix the enums/unions/switch construct identified by the diagnostic message.                   |
| `E1402` | `ENUM_BACKING_TYPE`                     | enums/unions/switch                   | Fix the enums/unions/switch construct identified by the diagnostic message.                   |
| `E1403` | `ENUM_MEMBER_RANGE`                     | enums/unions/switch                   | Fix the enums/unions/switch construct identified by the diagnostic message.                   |
| `E1404` | `DUPLICATE_UNION_VARIANT`               | enums/unions/switch                   | Fix the enums/unions/switch construct identified by the diagnostic message.                   |
| `E1405` | `UNKNOWN_UNION_VARIANT`                 | enums/unions/switch                   | Fix the enums/unions/switch construct identified by the diagnostic message.                   |
| `E1406` | `UNION_VARIANT_PAYLOAD`                 | enums/unions/switch                   | Fix the enums/unions/switch construct identified by the diagnostic message.                   |
| `E1407` | `UNION_VARIANT_ARITY`                   | enums/unions/switch                   | Fix the enums/unions/switch construct identified by the diagnostic message.                   |
| `E1408` | `UNION_VARIANT_PAYLOAD_TYPE`            | enums/unions/switch                   | Fix the enums/unions/switch construct identified by the diagnostic message.                   |
| `E1409` | `SWITCH_TYPE`                           | enums/unions/switch                   | Fix the enums/unions/switch construct identified by the diagnostic message.                   |
| `E1410` | `SWITCH_CASE_TYPE`                      | enums/unions/switch                   | Fix the enums/unions/switch construct identified by the diagnostic message.                   |
| `E1411` | `DUPLICATE_SWITCH_CASE`                 | enums/unions/switch                   | Fix the enums/unions/switch construct identified by the diagnostic message.                   |
| `E1412` | `NON_EXHAUSTIVE_SWITCH`                 | enums/unions/switch                   | Add missing enum/union cases or provide a default case.                                       |
| `E1500` | `TYPE_UNION_POSITION`                   | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1501` | `TYPE_INTERSECTION_POSITION`            | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1502` | `TYPE_CONDITIONAL_POSITION`             | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1503` | `TYPE_INDEXED_ACCESS_POSITION`          | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1504` | `TYPE_MAPPED_POSITION`                  | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1505` | `TYPE_KEYOF_POSITION`                   | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1506` | `TYPE_TYPEOF_POSITION`                  | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1507` | `TYPE_UNINSTANTIATED_GENERIC`           | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1508` | `TYPE_UNKNOWN`                          | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1509` | `TYPE_INTERFACE_VALUE`                  | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1510` | `TYPE_OPTIONAL_VOID`                    | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1511` | `TYPE_DUPLICATE_RECORD_FIELD`           | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1512` | `TYPE_INFERRED_ARRAY_FIELD`             | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1513` | `TYPE_POINTER_ARRAY_TARGET`             | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1514` | `TYPE_REFERENCE_ARRAY_TARGET`           | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1515` | `TYPE_REFERENCE_VOID_TARGET`            | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1516` | `TYPE_ARRAY_SIZE`                       | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1517` | `FUNCTION_ARRAY_RETURN`                 | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1518` | `TYPE_OPTIONAL_ARRAY`                   | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1519` | `TYPE_OPTIONAL_FUNCTION`                | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1520` | `TYPE_LITERAL_VALUE`                    | type references                       | Fix the type references construct identified by the diagnostic message.                       |
| `E1600` | `LEX_UNEXPECTED_CHARACTER`              | lexer                                 | Fix the lexer construct identified by the diagnostic message.                                 |
| `E1601` | `LEX_UNTERMINATED_BLOCK_COMMENT`        | lexer                                 | Fix the lexer construct identified by the diagnostic message.                                 |
| `E1602` | `LEX_NUMERIC_SEPARATOR`                 | lexer                                 | Fix the lexer construct identified by the diagnostic message.                                 |
| `E1603` | `LEX_UNTERMINATED_STRING`               | lexer                                 | Fix the lexer construct identified by the diagnostic message.                                 |
| `E1604` | `LEX_UNTERMINATED_TEMPLATE`             | lexer                                 | Fix the lexer construct identified by the diagnostic message.                                 |
| `E1605` | `LEX_TEMPLATE_INTERPOLATION`            | lexer                                 | Fix the lexer construct identified by the diagnostic message.                                 |
| `E1700` | `PARSE_SYNTAX`                          | parser                                | Fix the parser construct identified by the diagnostic message.                                |
| `E1701` | `PARSE_IMPORT_EXPORTED`                 | parser                                | Fix the parser construct identified by the diagnostic message.                                |
| `E1702` | `PARSE_IMPORT_EXTERN`                   | parser                                | Fix the parser construct identified by the diagnostic message.                                |
| `E1703` | `PARSE_TYPE_ALIAS_EXTERN`               | parser                                | Fix the parser construct identified by the diagnostic message.                                |
| `E1704` | `PARSE_CONSTANT_EXTERN`                 | parser                                | Fix the parser construct identified by the diagnostic message.                                |
| `E1705` | `PARSE_ENUM_EXTERN`                     | parser                                | Fix the parser construct identified by the diagnostic message.                                |
| `E1706` | `PARSE_CLASS_EXTERN`                    | parser                                | Fix the parser construct identified by the diagnostic message.                                |
| `E1707` | `PARSE_INTERFACE_EXTERN`                | parser                                | Fix the parser construct identified by the diagnostic message.                                |
| `E1800` | `C_ABI_RETURN_TYPE`                     | C ABI                                 | Fix the C ABI construct identified by the diagnostic message.                                 |
| `E1801` | `C_ABI_PARAMETER_TYPE`                  | C ABI                                 | Fix the C ABI construct identified by the diagnostic message.                                 |
| `E1802` | `C_DUPLICATE_FUNCTION_SYMBOL`           | C ABI                                 | Fix the C ABI construct identified by the diagnostic message.                                 |
| `E1803` | `C_DUPLICATE_CONSTANT_SYMBOL`           | C ABI                                 | Fix the C ABI construct identified by the diagnostic message.                                 |
| `E1804` | `C_DUPLICATE_TYPE_SYMBOL`               | C ABI                                 | Fix the C ABI construct identified by the diagnostic message.                                 |
| `E1805` | `C_DUPLICATE_ORDINARY_SYMBOL`           | C ABI                                 | Fix the C ABI construct identified by the diagnostic message.                                 |
| `E1900` | `ARRAY_LITERAL_CONTEXT`                 | arrays                                | Fix the arrays construct identified by the diagnostic message.                                |
| `E1901` | `ARRAY_LITERAL_TARGET`                  | arrays                                | Fix the arrays construct identified by the diagnostic message.                                |
| `E1902` | `ARRAY_LITERAL_INFERENCE`               | arrays                                | Fix the arrays construct identified by the diagnostic message.                                |
| `E1903` | `ARRAY_LITERAL_ELEMENT_TYPE`            | arrays                                | Fix the arrays construct identified by the diagnostic message.                                |
| `E1904` | `ARRAY_LITERAL_LENGTH`                  | arrays                                | Fix the arrays construct identified by the diagnostic message.                                |
| `E1905` | `ARRAY_FILL_TARGET`                     | arrays                                | Fix the arrays construct identified by the diagnostic message.                                |
| `E1906` | `ARRAY_FILL_ARITY`                      | arrays                                | Fix the arrays construct identified by the diagnostic message.                                |
| `E1907` | `ARRAY_FILL_CALLBACK_PARAMETER`         | arrays                                | Fix the arrays construct identified by the diagnostic message.                                |
| `E1908` | `ARRAY_FILL_INITIALIZER_TYPE`           | arrays                                | Fix the arrays construct identified by the diagnostic message.                                |
| `E2000` | `ARRAY_VARIABLE_INITIALIZER`            | declarations/inference                | Fix the declarations/inference construct identified by the diagnostic message.                |
| `E2001` | `LOCAL_TYPE_INFERENCE`                  | declarations/inference                | Fix the declarations/inference construct identified by the diagnostic message.                |
| `E2002` | `TYPE_ALIAS_ORDER`                      | declarations/inference                | Declare runtime type alias dependencies before aliases that use them.                         |
| `E2004` | `TYPE_ALIAS_CYCLE`                      | type aliases                          | Break the recursive alias cycle or introduce an explicit pointer/reference indirection.       |
| `E2003` | `CALLBACK_TYPE`                         | declarations/inference                | Fix the declarations/inference construct identified by the diagnostic message.                |
| `E2100` | `EXPRESSION_STATEMENT_CALL`             | expressions                           | Fix the expressions construct identified by the diagnostic message.                           |
| `E2101` | `CONDITIONAL_CONDITION_TYPE`            | expressions                           | Fix the expressions construct identified by the diagnostic message.                           |
| `E2102` | `CONDITIONAL_BRANCH_TYPE`               | expressions                           | Fix the expressions construct identified by the diagnostic message.                           |
| `E2103` | `RECORD_INFERENCE_SPREAD`               | expressions                           | Fix the expressions construct identified by the diagnostic message.                           |
| `E2104` | `FUNCTION_MISSING_RETURN`               | control flow                          | Ensure every path in a non-void function returns a value.                                     |
| `E2105` | `UNREACHABLE_CODE`                      | control flow                          | Remove the statement or move it before the terminating control-flow statement.                |
| `E2200` | `DUPLICATE_INTERFACE_METHOD`            | interfaces/values                     | Fix the interfaces/values construct identified by the diagnostic message.                     |
| `E2201` | `BORROWED_INTERFACE_MISSING_METHOD`     | interfaces/values                     | Fix the interfaces/values construct identified by the diagnostic message.                     |
| `E2202` | `VALUE_VOID_TYPE`                       | interfaces/values                     | Fix the interfaces/values construct identified by the diagnostic message.                     |
| `E2300` | `POINTER_ADDRESS_TARGET`                | pointers/arenas/constants             | Fix the pointers/arenas/constants construct identified by the diagnostic message.             |
| `E2301` | `POINTER_DEREFERENCE_TARGET`            | pointers/arenas/constants             | Fix the pointers/arenas/constants construct identified by the diagnostic message.             |
| `E2302` | `ARENA_ALLOC_TARGET`                    | pointers/arenas/constants             | Fix the pointers/arenas/constants construct identified by the diagnostic message.             |
| `E2303` | `ARENA_CALL_ARITY`                      | pointers/arenas/constants             | Fix the pointers/arenas/constants construct identified by the diagnostic message.             |
| `E2304` | `ARENA_ARGUMENT_TYPE`                   | pointers/arenas/constants             | Fix the pointers/arenas/constants construct identified by the diagnostic message.             |
| `E2305` | `INFERRED_RETURN_BARE_MIX`              | pointers/arenas/constants             | Fix the pointers/arenas/constants construct identified by the diagnostic message.             |
| `E2306` | `INFERRED_RETURN_TYPE`                  | pointers/arenas/constants             | Fix the pointers/arenas/constants construct identified by the diagnostic message.             |
| `E2307` | `CONSTANT_EXPRESSION`                   | pointers/arenas/constants             | Fix the pointers/arenas/constants construct identified by the diagnostic message.             |
| `E2400` | `ASSIGNMENT_CONST_TARGET`               | assignment                            | Fix the assignment construct identified by the diagnostic message.                            |
| `E2401` | `ASSIGNMENT_ARRAY_TARGET`               | assignment                            | Fix the assignment construct identified by the diagnostic message.                            |
| `E2402` | `INC_DEC_INTEGER_TARGET`                | assignment                            | Fix the assignment construct identified by the diagnostic message.                            |
| `E2500` | `TUPLE_LITERAL_ELEMENT_TYPE`            | tuples/strings                        | Fix the tuples/strings construct identified by the diagnostic message.                        |
| `E2501` | `TUPLE_LITERAL_LENGTH`                  | tuples/strings                        | Fix the tuples/strings construct identified by the diagnostic message.                        |
| `E2502` | `STRING_LITERAL_CONTEXT`                | tuples/strings                        | Fix the tuples/strings construct identified by the diagnostic message.                        |
| `E2600` | `ARROW_FUNCTION_CONTEXT`                | arrow functions                       | Fix the arrow functions construct identified by the diagnostic message.                       |
| `E2601` | `ARROW_FUNCTION_ARITY`                  | arrow functions                       | Fix the arrow functions construct identified by the diagnostic message.                       |
| `E2602` | `ARROW_FUNCTION_CAPTURE`                | arrow functions                       | Fix the arrow functions construct identified by the diagnostic message.                       |
| `E2700` | `CLASS_GENERIC_CONSTRAINT_INTERFACE`    | classes                               | Fix the classes construct identified by the diagnostic message.                               |
| `E2701` | `CLASS_GENERIC_CONSTRAINT_UNKNOWN_TYPE` | classes                               | Fix the classes construct identified by the diagnostic message.                               |
| `E2702` | `CLASS_DUPLICATE_GENERIC_PARAMETER`     | classes                               | Fix the classes construct identified by the diagnostic message.                               |
| `E2703` | `CLASS_TYPE_ARGUMENT_ARITY`             | classes                               | Fix the classes construct identified by the diagnostic message.                               |
| `E2704` | `CLASS_CONSTRAINT_UNSATISFIED`          | classes                               | Fix the classes construct identified by the diagnostic message.                               |
| `E2705` | `CLASS_INTERFACE_VALUE_TYPE`            | classes                               | Fix the classes construct identified by the diagnostic message.                               |
| `E2706` | `CLASS_UNKNOWN_TYPE_ARGUMENT`           | classes                               | Fix the classes construct identified by the diagnostic message.                               |
| `E2707` | `CLASS_INHERITANCE_CYCLE`               | classes                               | Fix the classes construct identified by the diagnostic message.                               |
| `E2708` | `CLASS_EXTENDS_TARGET`                  | classes                               | Fix the classes construct identified by the diagnostic message.                               |
| `E2709` | `CLASS_UNKNOWN_BASE`                    | classes                               | Fix the classes construct identified by the diagnostic message.                               |
| `E2710` | `CLASS_INHERITED_FIELD_CONFLICT`        | classes                               | Fix the classes construct identified by the diagnostic message.                               |
| `E2711` | `CLASS_IMPLEMENTS_TARGET`               | classes                               | Fix the classes construct identified by the diagnostic message.                               |
| `E2712` | `CLASS_UNKNOWN_INTERFACE`               | classes                               | Fix the classes construct identified by the diagnostic message.                               |
| `E2713` | `CLASS_INTERFACE_METHOD_MISSING`        | classes                               | Fix the classes construct identified by the diagnostic message.                               |
| `E2800` | `C_HEADER_UNSUPPORTED_TYPE`             | C headers                             | Fix the C headers construct identified by the diagnostic message.                             |
| `E2801` | `C_HEADER_CLANG_FAILED`                 | C headers                             | Fix the C headers construct identified by the diagnostic message.                             |
| `E2802` | `C_HEADER_INVALID_JSON`                 | C headers                             | Fix the C headers construct identified by the diagnostic message.                             |
| `E2803` | `C_HEADER_RECORD_DECLARATION`           | C headers                             | Fix the C headers construct identified by the diagnostic message.                             |
| `E2804` | `C_HEADER_RECORD_FIELDS`                | C headers                             | Fix the C headers construct identified by the diagnostic message.                             |
| `E2805` | `C_HEADER_MALFORMED_AST`                | C headers                             | Fix the C headers construct identified by the diagnostic message.                             |
| `E2806` | `C_HEADER_UNSUPPORTED_FUNCTION_TYPE`    | C headers                             | Fix the C headers construct identified by the diagnostic message.                             |
| `E2807` | `C_HEADER_UNSUPPORTED_RECORD_ARRAY`     | C headers                             | Fix the C headers construct identified by the diagnostic message.                             |
| `E2900` | `JSON_INVALID`                          | JSON/project config                   | Fix the JSON/project config construct identified by the diagnostic message.                   |
| `E2901` | `JSON_RECORD_REQUIRED`                  | JSON/project config                   | Fix the JSON/project config construct identified by the diagnostic message.                   |
| `E2902` | `JSON_UNKNOWN_KEY`                      | JSON/project config                   | Fix the JSON/project config construct identified by the diagnostic message.                   |
| `E2903` | `PROJECT_DEPENDENCIES_OBJECT`           | JSON/project config                   | Fix the JSON/project config construct identified by the diagnostic message.                   |
| `E2904` | `PROJECT_DEPENDENCY_ALIAS`              | JSON/project config                   | Fix the JSON/project config construct identified by the diagnostic message.                   |
| `E2905` | `PROJECT_DEPENDENCY_TARGET`             | JSON/project config                   | Fix the JSON/project config construct identified by the diagnostic message.                   |
| `E2906` | `PROJECT_COMPILER_OBJECT`               | JSON/project config                   | Fix the JSON/project config construct identified by the diagnostic message.                   |
| `E2907` | `PROJECT_COMPILER_FLAGS`                | JSON/project config                   | Fix the JSON/project config construct identified by the diagnostic message.                   |
| `E2908` | `PROJECT_COMPILER_FLAG`                 | JSON/project config                   | Fix the JSON/project config construct identified by the diagnostic message.                   |
| `E3000` | `RECORD_REST_SOURCE`                    | destructuring/casts/overloads/methods | Fix the destructuring/casts/overloads/methods construct identified by the diagnostic message. |
| `E3001` | `RECORD_REST_UNKNOWN_FIELD`             | destructuring/casts/overloads/methods | Fix the destructuring/casts/overloads/methods construct identified by the diagnostic message. |
| `E3002` | `ARRAY_DESTRUCTURE_SOURCE`              | destructuring/casts/overloads/methods | Fix the destructuring/casts/overloads/methods construct identified by the diagnostic message. |
| `E3003` | `ARRAY_DESTRUCTURE_ARITY`               | destructuring/casts/overloads/methods | Fix the destructuring/casts/overloads/methods construct identified by the diagnostic message. |
| `E3004` | `CAST_NUMERIC_TYPES`                    | destructuring/casts/overloads/methods | Fix the destructuring/casts/overloads/methods construct identified by the diagnostic message. |
| `E3005` | `SATISFIES_TYPE`                        | destructuring/casts/overloads/methods | Fix the destructuring/casts/overloads/methods construct identified by the diagnostic message. |
| `E3006` | `OVERLOAD_NO_MATCH`                     | destructuring/casts/overloads/methods | Fix the destructuring/casts/overloads/methods construct identified by the diagnostic message. |
| `E3007` | `OVERLOAD_AMBIGUOUS`                    | destructuring/casts/overloads/methods | Fix the destructuring/casts/overloads/methods construct identified by the diagnostic message. |
| `E3008` | `STATIC_METHOD_INSTANCE_CALL`           | destructuring/casts/overloads/methods | Fix the destructuring/casts/overloads/methods construct identified by the diagnostic message. |
| `E3009` | `BORROWED_INTERFACE_UNKNOWN_METHOD`     | destructuring/casts/overloads/methods | Fix the destructuring/casts/overloads/methods construct identified by the diagnostic message. |
| `E3010` | `METHOD_ACCESS_RESTRICTED`              | destructuring/casts/overloads/methods | Fix the destructuring/casts/overloads/methods construct identified by the diagnostic message. |
| `E3011` | `UNION_NARROWING_MISMATCH`              | tagged unions                         | Match the active tag before accessing a tagged-union payload field.                           |
| `E3100` | `JSON_TEXT_REQUIRED`                    | JSON text                             | Fix the JSON text construct identified by the diagnostic message.                             |
| `E3200` | `PARAMETER_REQUIRED_ORDER`              | parameters/variadics                  | Fix the parameters/variadics construct identified by the diagnostic message.                  |
| `E3201` | `PARAMETER_DEFAULT_TYPE`                | parameters/variadics                  | Fix the parameters/variadics construct identified by the diagnostic message.                  |
| `E3202` | `VARIADIC_ARGUMENT_TYPE`                | parameters/variadics                  | Fix the parameters/variadics construct identified by the diagnostic message.                  |
| `E0182` | `READONLY_FIELD_ASSIGNMENT`             | type checking                         | Fix the type checking construct identified by the diagnostic message.                         |
