import { z } from "zod";

export const INVALID_CREDENTIALS = "Nome de utilizador ou palavra-passe inválidos.";
// Identifiers remain case-sensitive ASCII, as in existing accounts. No trim,
// case folding, Unicode normalization, or approximate matching is permitted.
export const usernameSchema = z.string().min(3).max(40)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/);

// The existing password-hash provider has a 72-byte bcrypt boundary. Reject
// overlong input rather than allow a suffix to be ignored by a hash verifier.
export const passwordSchema = z.string().min(1).refine(
  (value) => new TextEncoder().encode(value).length <= 72,
  "A palavra-passe não pode ultrapassar 72 bytes.",
).refine((value) => !Array.from(value).some((character) => {
  const point = character.codePointAt(0);
  return point === 0 || (point !== undefined && point >= 0xd800 && point <= 0xdfff);
}),
  "A palavra-passe contém caracteres inválidos.");

export const loginCredentialsSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
}).strict();

export const setupCredentialsSchema = loginCredentialsSchema.extend({
  password: passwordSchema.refine((value) => value.length >= 8),
});

export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;
export type LoginResult =
  | { session: { access_token: string; refresh_token: string } }
  | { error: string };

// All checks must pass before requesting a session from the hash provider.
// Its verifier receives the original password, never a transformed value.
export async function verifyExactLogin(
  input: unknown,
  lookup: (username: string) => Promise<{ username: string; email: string; active: boolean } | null>,
  verifyHash: (email: string, password: string) => Promise<LoginResult>,
): Promise<LoginResult> {
  const parsed = loginCredentialsSchema.safeParse(input);
  if (!parsed.success) return { error: INVALID_CREDENTIALS };
  const { username, password } = parsed.data;
  const account = await lookup(username);
  if (!account || account.username !== username || !account.active) {
    return { error: INVALID_CREDENTIALS };
  }
  const result = await verifyHash(account.email, password);
  return "session" in result ? result : { error: INVALID_CREDENTIALS };
}