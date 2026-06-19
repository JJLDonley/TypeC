type Str = string;
type b8 = boolean;

export function compilerFlagError(flag: Str): Str | null {
  if (!flag.startsWith("-")) return "project.json compiler.flags must contain flags only";
  if (isCStandardFlag(flag)) return "project.json compiler.flags cannot override the C standard";
  if (isOutputPathFlag(flag)) return "project.json compiler.flags cannot override output paths";
  if (isArtifactModeFlag(flag)) return "project.json compiler.flags cannot change build artifact mode";
  if (isEntrypointFlag(flag)) return "project.json compiler.flags cannot override the program entrypoint";
  if (isHostedEnvironmentFlag(flag)) return "project.json compiler.flags cannot remove the hosted C environment";
  if (isTargetEnvironmentFlag(flag)) return "project.json compiler.flags cannot override the target environment";
  if (isForcedIncludeFlag(flag)) return "project.json compiler.flags cannot force source includes";
  if (isSeparateOperandFlag(flag)) return `project.json compiler flag '${flag}' must include its operand in the same argument`;
  if (flag.startsWith("-x")) return "project.json compiler.flags cannot override input language";
  return null;
}

function isCStandardFlag(flag: Str): b8 {
  return flag === "-std" || flag.startsWith("-std=");
}

function isOutputPathFlag(flag: Str): b8 {
  return flag === "-o" || flag.startsWith("-o") || flag === "--output" || flag.startsWith("--output=") || isLinkerOutputFlag(flag);
}

function isLinkerOutputFlag(flag: Str): b8 {
  return linkerOperands(flag).some(isLinkerOutputOperand);
}

function isLinkerOutputOperand(operand: Str): b8 {
  return operand === "-o" || operand.startsWith("-o") || operand.startsWith("--output");
}

function isArtifactModeFlag(flag: Str): b8 {
  return flag === "-c" || flag === "-E" || flag === "-S" || flag === "-M" || flag === "-MM" || flag === "-fsyntax-only" || flag === "-shared" || isLinkerArtifactModeFlag(flag);
}

function isLinkerArtifactModeFlag(flag: Str): b8 {
  return linkerOperands(flag).some(isLinkerArtifactModeOperand);
}

function isLinkerArtifactModeOperand(operand: Str): b8 {
  return operand === "-shared" || operand === "-r";
}

function isEntrypointFlag(flag: Str): b8 {
  return flag === "-e" || linkerOperands(flag).some(isLinkerEntrypointOperand);
}

function isLinkerEntrypointOperand(operand: Str): b8 {
  return operand === "-e" || operand.startsWith("-e=") || operand.startsWith("--entry") || joinedEntrypointOperand(operand);
}

function joinedEntrypointOperand(operand: Str): b8 {
  return operand.startsWith("-e") && operand.length > "-e".length && !operand.startsWith("-export");
}

function isHostedEnvironmentFlag(flag: Str): b8 {
  return flag === "-nostdlib" || flag === "-nodefaultlibs" || flag === "-nostartfiles" || flag === "-nostdinc" || flag === "-ffreestanding";
}

function isTargetEnvironmentFlag(flag: Str): b8 {
  return flag === "-target" || flag.startsWith("-target=") || flag.startsWith("--target=") || flag === "--target" || flag === "-arch" || isMachineTargetFlag(flag) || flag === "--sysroot" || flag.startsWith("--sysroot=") || flag === "-isysroot" || flag.startsWith("-isysroot");
}

function isMachineTargetFlag(flag: Str): b8 {
  return flag === "-m32" || flag === "-m64" || flag.startsWith("-march=") || flag.startsWith("-mcpu=") || flag.startsWith("-mtune=");
}

function linkerOperands(flag: Str): Str[] {
  if (!flag.startsWith("-Wl,")) return [];
  return flag.slice("-Wl,".length).split(",");
}

function isForcedIncludeFlag(flag: Str): b8 {
  return flag === "-include" || flag.startsWith("-include") || flag === "-imacros" || flag.startsWith("-imacros") || flag === "-include-pch" || flag.startsWith("-include-pch");
}

function isSeparateOperandFlag(flag: Str): b8 {
  return flag === "-I" || flag === "-D" || flag === "-U" || flag === "-L" || flag === "-l" || flag === "-isystem";
}
