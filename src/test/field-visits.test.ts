import { describe, expect, it } from "vitest";

import {
  BOX_STEP,
  PRIORITIES,
  QUANTITY_PRESETS,
  addQuantity,
  canCompleteVisit,
  durationInMinutes,
  formatDuration,
} from "@/lib/field-visits";

describe("field visit rules", () => {
  it("keeps the requested quick quantity steps and adds a box as one unit", () => {
    expect(QUANTITY_PRESETS).toEqual([1, 5, 10, 50]);
    expect(BOX_STEP).toBe(1);
    expect(addQuantity(2, 50)).toBe(52);
  });

  it("uses the requested priority choices", () => {
    expect(PRIORITIES).toEqual(["Urgente", "Normal", "Baixa"]);
  });

  it("does not allow finishing an empty inspection", () => {
    expect(canCompleteVisit(0)).toBe(false);
    expect(canCompleteVisit(1)).toBe(true);
  });

  it("calculates and displays a 75-minute inspection as 1 hour and 15 minutes", () => {
    expect(durationInMinutes("2026-11-23T08:00:00.000Z", "2026-11-23T09:15:00.000Z")).toBe(75);
    expect(formatDuration(75)).toBe("1 h 15 min");
  });
});