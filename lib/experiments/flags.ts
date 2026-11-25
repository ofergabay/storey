export type ExperimentId = "first-share" | "party-kit" | "my-pace";
export type ExperimentArm = "treatment" | "control";

export function experimentEnabled(id: ExperimentId, env: Record<string, string | undefined> = process.env): boolean {
  const key = id === "first-share" ? "STOREY_EXPERIMENT_FIRST_SHARE" : id === "party-kit" ? "STOREY_EXPERIMENT_PARTY_KIT" : "STOREY_EXPERIMENT_MY_PACE";
  const value = env[key];
  if (value === "on") return true;
  if (value === "off") return false;
  return env.NODE_ENV === "development";
}

export function assignmentBucket(subject: string): number {
  let hash = 2166136261;
  for (const char of subject) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 100;
}

export function assignArm(id: ExperimentId, subject: string, enabled = experimentEnabled(id)): ExperimentArm {
  if (!enabled || subject.trim().length === 0) return "control";
  return assignmentBucket(`${id}:${subject}`) < 50 ? "treatment" : "control";
}
