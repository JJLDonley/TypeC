import { findProjectDir, projectConfigPath } from "../src/project_discovery.ts";

type Str = string;

Deno.test("finds nearest project config directory", async () => {
  const root = await Deno.makeTempDir();
  const nested = `${root}/src/app`;
  await Deno.mkdir(nested, { recursive: true });
  await Deno.writeTextFile(projectConfigPath(root), `{"dependencies":{}}`);
  await Deno.writeTextFile(`${nested}/main.tc`, `function main(): i32 { return 0; }`);

  assertText(await findProjectDir(`${nested}/main.tc`) ?? "", root);
});

Deno.test("reports absent project config directory", async () => {
  const root = await Deno.makeTempDir();
  const entry = `${root}/main.tc`;
  await Deno.writeTextFile(entry, `function main(): i32 { return 0; }`);

  assertText(await findProjectDir(entry) ?? "", "");
});

Deno.test("builds project config paths", () => {
  assertText(projectConfigPath("/project"), "/project/project.json");
});

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
