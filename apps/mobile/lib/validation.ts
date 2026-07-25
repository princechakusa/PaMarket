export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RE = /^(\+263|0)[0-9]{9}$/;

export function isValidEmail(email: string) {
  return EMAIL_RE.test(email.trim());
}

export function isValidPhone(phone: string) {
  return PHONE_RE.test(phone.replace(/\s+/g, ""));
}

export function isStrongEnoughPassword(password: string) {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password) && !/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

export type PasswordStrength = "weak" | "fair" | "good" | "strong";

export function passwordStrength(password: string): { score: number; label: PasswordStrength; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "weak", color: "#ef4444" };
  if (score === 2) return { score, label: "fair", color: "#f97316" };
  if (score <= 4) return { score, label: "good", color: "#eab308" };
  return { score, label: "strong", color: "#22c55e" };
}
