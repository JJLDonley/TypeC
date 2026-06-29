type Str = string;

export function cSymbolName(name: Str): Str {
  return name.replaceAll(".", "_");
}
