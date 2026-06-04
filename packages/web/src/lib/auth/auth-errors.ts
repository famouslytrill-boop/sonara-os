export const genericAuthErrorMessage =
  "Authentication could not be completed. Check your details or try again.";

export function normalizeAuthErrorMessage(error: unknown): string {
  if (!error) {
    return genericAuthErrorMessage;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (revealsAccountExistence(message) || revealsProviderInternals(message)) {
    return genericAuthErrorMessage;
  }
  return genericAuthErrorMessage;
}

function revealsAccountExistence(message: string) {
  return /user not found|email already|already registered|does not exist|no account/i.test(message);
}

function revealsProviderInternals(message: string) {
  return /service_role|anon key|jwt|database|stack|supabase_[a-z_]*key/i.test(message);
}
