import type { ClassVTableDecl } from "core/ast.ts";

type Str = string;

export function emitClassVTableDefinition(vtable: ClassVTableDecl): Str {
  const fields = vtable.methods.map(emitClassVTableField).join(",\n");
  return `static const ${vtable.typeName} ${vtable.cName} = {\n${fields}\n};`;
}

function emitClassVTableField(method: ClassVTableDecl["methods"][number]): Str {
  return `  .${method.name} = ${method.functionCName}`;
}
