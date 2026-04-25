const owners = (process.env.OWNER_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isOwner(email?: string | null): boolean {
  return !!email && owners.includes(email.toLowerCase());
}
