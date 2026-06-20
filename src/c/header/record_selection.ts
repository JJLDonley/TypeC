import type { CHeaderRecord } from "c/header/ast.ts";
import { orderHeaderRecordsByDependencies } from "c/header/record_order.ts";
import { uniqueCompatibleHeaderRecords } from "c/header/record_uniqueness.ts";
import { isPathWithinDir } from "paths";

type Str = string;
type b8 = boolean;

export function selectHeaderRecords(
  records: CHeaderRecord[],
  includeDir: Str | null = null,
): CHeaderRecord[] {
  return orderHeaderRecordsByDependencies(
    uniqueCompatibleHeaderRecords(
      records.filter((record) => isIncludedHeaderRecord(record, includeDir)),
    ),
  );
}

function isIncludedHeaderRecord(record: CHeaderRecord, includeDir: Str | null): b8 {
  if (includeDir === null) return true;
  if (record.sourceFile === null) return false;
  return isPathWithinDir(record.sourceFile, includeDir);
}
