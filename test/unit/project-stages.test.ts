import { describe, expect, it } from "vitest";
import { nextStage, STAGE_ORDER } from "@/lib/project-stages";

describe("STAGE_ORDER", () => {
  it("matches the assignment's Sec 3 sequence exactly, in order", () => {
    expect(STAGE_ORDER).toEqual([
      "IDEA",
      "DISCOVERY",
      "REQUIREMENTS_DESIGN",
      "APPROVAL",
      "DEVELOPMENT",
      "INTERNAL_TESTING",
      "BUSINESS_TESTING_UAT",
      "DEPLOYMENT",
      "STABILIZATION",
      "COMPLETED",
    ]);
  });
});

describe("nextStage", () => {
  it("returns the immediately following stage for every non-terminal stage", () => {
    for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
      expect(nextStage(STAGE_ORDER[i])).toBe(STAGE_ORDER[i + 1]);
    }
  });

  it("returns null for COMPLETED — there is no stage after the final one", () => {
    expect(nextStage("COMPLETED")).toBeNull();
  });
});
