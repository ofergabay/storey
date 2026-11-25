export type GateRole = "guest" | "creator" | "supplier" | "admin";

export function adminPageDecision(role: GateRole): "login" | "deny" | "allow" {
  if (role === "guest") return "login";
  if (role === "admin") return "allow";
  return "deny";
}
