type Str = string;

export class SourceReadError extends Error {
  constructor(public readonly messageText: Str) {
    super(messageText);
  }
}

export async function readSourceText(inputPath: Str): Promise<Str> {
  try {
    return await Deno.readTextFile(inputPath);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      throw new SourceReadError(sourceNotFoundMessage(inputPath));
    }
    if (err instanceof Deno.errors.PermissionDenied) {
      throw new SourceReadError(sourceUnreadableMessage(inputPath));
    }
    throw err;
  }
}

export function sourceNotFoundMessage(inputPath: Str): Str {
  return `Source file not found: ${inputPath}`;
}

export function sourceUnreadableMessage(inputPath: Str): Str {
  return `Source file is not readable: ${inputPath}`;
}
