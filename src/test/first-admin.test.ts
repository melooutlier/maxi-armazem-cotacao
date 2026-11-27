import { describe, expect, it } from "vitest";

import { canCreateFirstAdmin } from "@/lib/first-admin";

describe("first administrator setup", () => {
  it("offers setup only while there are zero administrators", () => {
    expect(canCreateFirstAdmin(0)).toBe(true);
    expect(canCreateFirstAdmin(1)).toBe(false);
    expect(canCreateFirstAdmin(12)).toBe(false);
  });

  it("does not offer setup when the administrator count is unavailable", () => {
    expect(canCreateFirstAdmin(null)).toBe(false);
    expect(canCreateFirstAdmin(undefined)).toBe(false);
  });
});
