# TypeC 0.1 Parser Recovery

Parser recovery is diagnostic-only. Recovered syntax never creates semantic placeholder nodes and
never reaches lowering or C emission as a valid construct.

## Declaration Synchronization

After a malformed top-level declaration, the parser resumes at the next token whose text is one of:

```txt
import
export
extern
type
namespace
class
struct
interface
union
enum
const
function
```

If no declaration-start token appears, recovery stops at EOF.

## Statement Synchronization

After a malformed block statement, the parser resumes after the next semicolon. If a closing brace
appears first, recovery stops before the brace so the containing block can close normally. If EOF
appears first, recovery stops at EOF.

Statement recovery applies inside parsed blocks only. It discards the malformed statement and does
not insert an AST node.

## Non-Recovered Regions

The following regions still fail the current declaration or statement and then use the declaration
or statement synchronization rule above:

- parameter lists
- argument lists
- type argument lists
- record fields
- tuple elements
- import clauses

These regions do not fabricate missing elements. Any incomplete list item is rejected and skipped as
part of the containing declaration or statement.

## Invariant

If parser diagnostics exist after recovery, parsing throws `TypeCError` before lowering to AST.
Recovery exists to report multiple syntax diagnostics from one file, not to accept invalid syntax.
