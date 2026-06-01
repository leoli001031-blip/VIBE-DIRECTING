export function unique<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values.filter((value) => value.trim()).map((value) => value.trim()))).sort() as T[];
}

export function hardLockDrift(actual: object | undefined, expected: object, prefix: string): string[] {
  if (!actual) return [`${prefix}_hard_locks_missing`];
  const actualRecord = actual as Record<string, unknown>;
  const expectedRecord = expected as Record<string, unknown>;
  return Object.entries(expectedRecord).flatMap(([key, expectedValue]) =>
    actualRecord[key] === expectedValue ? [] : [`${prefix}_hard_lock_drift:${key}`],
  );
}
