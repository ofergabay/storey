export function appendAudit<T>(log: readonly T[], entry: T): T[] {
  return [entry, ...log];
}
