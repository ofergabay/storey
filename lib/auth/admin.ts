export const DEVELOPMENT_ADMIN_EMAIL = "ofergabay@gmail.com";

export function isDevelopmentAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const extras = (process.env.STOREY_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return [DEVELOPMENT_ADMIN_EMAIL, ...extras].includes(email.trim().toLowerCase());
}

export function safeNextPath(value: string | undefined): "/catalog" | "/studio" | "/admin" {
  if (value === "/studio" || value === "/admin" || value === "/catalog") return value;
  return "/catalog";
}
