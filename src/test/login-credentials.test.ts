import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { INVALID_CREDENTIALS, loginCredentialsSchema, passwordSchema, setupCredentialsSchema, verifyExactLogin } from "@/lib/login-credentials";

// A deterministic test verifier checks the bytes forwarded by the application;
// production continues to use Auth's password-hash verifier, never this stub.
const username = "MaxiUser.O01";
const password = " Páss  Word!0Ol1🔐 ";
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const storedHash = hash(password);
const session = { access_token: "test-access", refresh_token: "test-refresh" };

function fixture(active = true, storedUsername = username) {
  const lookup = vi.fn(async () => ({ username: storedUsername, email: "test@users.maxi.local", active }));
  const verify = vi.fn(async (_email: string, candidate: string) => hash(candidate) === storedHash
    ? { session } : { error: "Provider detail must not escape" });
  return { lookup, verify, login: (input: unknown) => verifyExactLogin(input, lookup, verify) };
}

describe("exact login credentials", () => {
  it("authorizes only the correct username and original password", async () => {
    const f = fixture();
    expect(await f.login({ username, password })).toEqual({ session });
    expect(f.verify).toHaveBeenCalledWith("test@users.maxi.local", password);
  });

  it("rejects case changes in the username even if a lookup returns a similar account", async () => {
    const f = fixture();
    expect(await f.login({ username: username.toLowerCase(), password })).toEqual({ error: INVALID_CREDENTIALS });
    expect(f.verify).not.toHaveBeenCalled();
  });

  it.each([
    ["lowercase", password.toLowerCase()],
    ["uppercase", password.toUpperCase()],
    ["mixed case", password.replace("Word", "wOrd")],
    ["leading space added", ` ${password}`],
    ["trailing space added", `${password} `],
    ["spaces trimmed", password.trim()],
    ["internal space removed", password.replace("  ", " ")],
    ["consecutive space added", password.replace("  ", "   ")],
    ["accent removed", password.replace("á", "a")],
    ["accent changed", password.replace("á", "à")],
    ["Unicode decomposed", password.normalize("NFD")],
    ["symbol changed", password.replace("!", "?")],
    ["zero replaced with O", password.replace("0", "O")],
    ["one replaced with l", password.replace("1", "l")],
    ["visually similar Cyrillic letter", password.replace("P", "Р")],
    ["character added", `${password}x`],
    ["character missing", password.slice(1)],
    ["emoji changed", password.replace("🔐", "🔒")],
  ])("rejects password difference: %s", async (_label, candidate) => {
    const f = fixture();
    expect(await f.login({ username, password: candidate })).toEqual({ error: INVALID_CREDENTIALS });
    expect(f.verify).toHaveBeenCalledWith("test@users.maxi.local", candidate);
  });

  it.each([` ${username}`, `${username} `, "Maxi User", "Maxi  User", "MáxiUser", "ＭaxiUser", "MaxiUser\n", "Ma", "M".repeat(41)])(
    "rejects invalid identifier %j without normalization", async (candidate) => {
      const f = fixture();
      expect(await f.login({ username: candidate, password })).toEqual({ error: INVALID_CREDENTIALS });
      expect(f.lookup).not.toHaveBeenCalled();
    },
  );

  it.each(["MaxiUser.OO1", "MaxiUser.O0l", "MaxiUser.O01x", "MaxiUser.O0", "MaxiUser-O01"])(
    "rejects an altered valid identifier %s", async (candidate) => {
      const f = fixture();
      expect(await f.login({ username: candidate, password })).toEqual({ error: INVALID_CREDENTIALS });
      expect(f.verify).not.toHaveBeenCalled();
    },
  );

  it("does not coerce non-string credentials or accept extra fields", async () => {
    for (const input of [null, {}, { username: 123, password }, { username, password: 123 }, { username, password, admin: true }]) {
      const f = fixture();
      expect(await f.login(input)).toEqual({ error: INVALID_CREDENTIALS });
      expect(f.lookup).not.toHaveBeenCalled();
    }
  });

  it("rejects disabled accounts even when both credentials match", async () => {
    const f = fixture(false);
    expect(await f.login({ username, password })).toEqual({ error: INVALID_CREDENTIALS });
    expect(f.verify).not.toHaveBeenCalled();
  });

  it("gives the same generic denial for unknown users and failed hash verification", async () => {
    const unknown = await verifyExactLogin({ username, password }, async () => null, vi.fn());
    const incorrect = await fixture().login({ username, password: "Incorrect!" });
    expect(unknown).toEqual({ error: INVALID_CREDENTIALS });
    expect(incorrect).toEqual(unknown);
  });

  it("rejects suffixes beyond the 72-byte hash boundary before verification", async () => {
    expect(passwordSchema.safeParse("a".repeat(72)).success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(73)).success).toBe(false);
    expect(passwordSchema.safeParse("á".repeat(36)).success).toBe(true);
    expect(passwordSchema.safeParse("á".repeat(37)).success).toBe(false);
    const f = fixture();
    expect(await f.login({ username, password: `${"a".repeat(72)}x` })).toEqual({ error: INVALID_CREDENTIALS });
    expect(f.verify).not.toHaveBeenCalled();
  });

  it("rejects empty, NUL, and malformed Unicode passwords", () => {
    for (const candidate of ["", "Password\0", "Password\ud800", "Password\udc00"]) {
      expect(passwordSchema.safeParse(candidate).success).toBe(false);
    }
    expect(passwordSchema.safeParse(password).success).toBe(true);
  });

  it("requires eight characters at setup without silently strengthening the login minimum", () => {
    expect(setupCredentialsSchema.safeParse({ username, password: "a".repeat(7) }).success).toBe(false);
    expect(setupCredentialsSchema.safeParse({ username, password: "a".repeat(8) }).success).toBe(true);
    expect(loginCredentialsSchema.safeParse({ username, password: "a" }).success).toBe(true);
  });
});