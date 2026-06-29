type Str = string;

const VERSION: Str = "0.1.2";

export function compilerVersion(): Str {
  return VERSION;
}

export function versionText(): Str {
  return `TypeC ${compilerVersion()}`;
}
