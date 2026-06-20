type Str = string;

export function namespaceCName(namespace: Str, name: Str): Str {
  return `${namespace}_${name}`.replace(/[^A-Za-z0-9_]/g, "_");
}
