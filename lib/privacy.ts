export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 2) return "•••";
  return `•••${digits.slice(-2)}`;
}

export function maskStreet(): string {
  return "רחוב מוסתר";
}
