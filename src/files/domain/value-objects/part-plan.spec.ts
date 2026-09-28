import { PartPlan } from "./part-plan";

const MIB = 1024 * 1024;

describe("PartPlan", () => {
  it("uses a single part for a small file", () => {
    const plan = PartPlan.for({ size: 1024 });
    expect(plan.partCount).toBe(1);
  });

  it("enforces the 5 MiB minimum part size", () => {
    const plan = PartPlan.for({ size: 10 * MIB, requestedPartSize: 1 });
    expect(plan.partSize).toBe(5 * MIB);
    expect(plan.partCount).toBe(2);
  });

  it("honors a requested part size within the allowed range", () => {
    const plan = PartPlan.for({ size: 20 * MIB, requestedPartSize: 10 * MIB });
    expect(plan.partSize).toBe(10 * MIB);
    expect(plan.partCount).toBe(2);
  });

  it("grows the part size to stay within 10000 parts", () => {
    const size = 100 * 1024 * MIB; // 100 GiB
    const plan = PartPlan.for({ size, requestedPartSize: 5 * MIB });
    expect(plan.partCount).toBeLessThanOrEqual(10_000);
    expect(plan.partSize).toBeGreaterThan(5 * MIB);
  });

  it("rounds the part count up so the last part is covered", () => {
    const plan = PartPlan.for({ size: 5 * MIB + 1, requestedPartSize: 5 * MIB });
    expect(plan.partCount).toBe(2);
  });
});
