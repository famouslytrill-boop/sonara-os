export const passwordPolicy = Object.freeze({
  minimumLength: 12,
  requireLowercase: true,
  requireUppercase: true,
  requireNumber: true,
  requireSymbol: true,
  blockedValues: Object.freeze(["password", "companyname", "workspace", "launch"])
});

export function evaluatePasswordPolicy(password: string) {
  const issues: string[] = [];
  if (password.length < passwordPolicy.minimumLength) {
    issues.push(`Use at least ${passwordPolicy.minimumLength} characters.`);
  }
  if (passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
    issues.push("Add a lowercase letter.");
  }
  if (passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
    issues.push("Add an uppercase letter.");
  }
  if (passwordPolicy.requireNumber && !/\d/.test(password)) {
    issues.push("Add a number.");
  }
  if (passwordPolicy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    issues.push("Add a symbol.");
  }
  if (passwordPolicy.blockedValues.some((value) => password.toLowerCase().includes(value))) {
    issues.push("Avoid product names and common words.");
  }
  return Object.freeze({ ok: issues.length === 0, issues: Object.freeze(issues) });
}
