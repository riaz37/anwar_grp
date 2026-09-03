import { describe, expect, it } from "vitest";
import { STAGE_GATE_TEMPLATES } from "@/lib/stage-gate-templates";

describe("STAGE_GATE_TEMPLATES", () => {
  it("has the exact exit criteria from the assignment Sec 5, verbatim", () => {
    expect(STAGE_GATE_TEMPLATES.DISCOVERY?.map((i) => i.label)).toEqual([
      "Business problem documented",
      "Current process understood",
      "Users identified",
      "Expected outcome defined",
    ]);
    expect(STAGE_GATE_TEMPLATES.REQUIREMENTS_DESIGN?.map((i) => i.label)).toEqual([
      "Requirements completed",
      "Workflow approved",
      "UI/UX or solution design completed",
      "Technical approach defined",
    ]);
    expect(STAGE_GATE_TEMPLATES.DEVELOPMENT?.map((i) => i.label)).toEqual([
      "Required functionality developed",
      "Internal testing completed",
      "Major known bugs resolved",
    ]);
    expect(STAGE_GATE_TEMPLATES.BUSINESS_TESTING_UAT?.map((i) => i.label)).toEqual([
      "Business testing completed",
      "Feedback recorded",
      "Critical issues resolved",
      "Business approval received",
    ]);
  });

  it("every template item is required=true — the assignment lists no optional exit criteria", () => {
    for (const items of Object.values(STAGE_GATE_TEMPLATES)) {
      for (const item of items ?? []) {
        expect(item.required).toBe(true);
      }
    }
  });

  it("stages with no fixed gate in the assignment carry no template (IDEA, APPROVAL, INTERNAL_TESTING, DEPLOYMENT, STABILIZATION, COMPLETED)", () => {
    for (const stage of [
      "IDEA",
      "APPROVAL",
      "INTERNAL_TESTING",
      "DEPLOYMENT",
      "STABILIZATION",
      "COMPLETED",
    ] as const) {
      expect(STAGE_GATE_TEMPLATES[stage]).toBeUndefined();
    }
  });
});
