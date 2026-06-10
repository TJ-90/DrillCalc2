import { describe, expect, test } from "bun:test";
import {
  adjustOwr,
  blendDensity,
  blendVolumeForTarget,
  buildObm,
  dilution,
  owrFromRetort,
  startingVolumeForFinal,
  weightUp,
} from "../mudmix";

describe("WBM mixing", () => {
  test("barite weight-up 9.0 -> 10.0 ppg on 100 bbl (classic 1470 formula)", () => {
    // sacks/100 bbl = 1470*(W2-W1)/(35-W2) = 1470*1/25 = 58.8
    const r = weightUp(100, 9, 10);
    expect(r.lbsPerBbl).toBeCloseTo(58.8, 2);
    expect(r.totalLbs).toBeCloseTo(5880, 1);
    expect(r.sacks).toBeCloseTo(58.8, 2);
    expect(r.volumeIncreaseBbl).toBeCloseTo(4, 3); // 5880 lb / 1470 lb/bbl
    expect(r.finalVolumeBbl).toBeCloseTo(104, 3);
  });

  test("CaCO3 weight-up uses agent density (22.5 ppg)", () => {
    const r = weightUp(100, 9, 9.5, 22.5);
    // lbs/bbl = 42*22.5*0.5/(22.5-9.5) = 945*0.5/13 = 36.35
    expect(r.lbsPerBbl).toBeCloseTo((945 * 0.5) / 13, 3);
  });

  test("weight-up rejects impossible targets", () => {
    expect(() => weightUp(100, 9, 36)).toThrow();
    expect(() => weightUp(100, 10, 9)).toThrow();
  });

  test("starting volume for a fixed final volume", () => {
    // V1 = Vf*(35-W2)/(35-W1) = 100*25/26 = 96.15
    expect(startingVolumeForFinal(100, 9, 10)).toBeCloseTo(96.15, 2);
  });

  test("dilution 11.0 -> 10.0 ppg with water on 100 bbl", () => {
    // Vw = 100*(11-10)/(10-8.34) = 60.24 bbl
    const r = dilution(100, 11, 10);
    expect(r.addedBbl).toBeCloseTo(60.24, 2);
    expect(r.finalVolumeBbl).toBeCloseTo(160.24, 2);
  });

  test("dilution rejects target below diluent density", () => {
    expect(() => dilution(100, 11, 8)).toThrow();
  });

  test("blending two muds", () => {
    expect(blendDensity(50, 9, 50, 11)).toBeCloseTo(10, 6);
    expect(blendVolumeForTarget(100, 9, 12, 10)).toBeCloseTo(50, 6);
    expect(() => blendVolumeForTarget(100, 9, 12, 13)).toThrow();
  });
});

describe("OBM mixing", () => {
  test("build 100 bbl of 12.0 ppg 80/20 OBM (diesel 7.0, water 8.34)", () => {
    const r = buildObm({
      finalVolumeBbl: 100,
      targetPpg: 12,
      oilPctOfLiquid: 80,
      baseOilPpg: 7.0,
      brinePpg: 8.34,
    });
    // Wl = 0.8*7 + 0.2*8.34 = 7.268; Vb = 100*(12-7.268)/(35-7.268) = 17.06 bbl
    expect(r.liquidPhasePpg).toBeCloseTo(7.268, 4);
    expect(r.bariteBbl).toBeCloseTo(17.06, 1);
    expect(r.baseOilBbl).toBeCloseTo(66.35, 1);
    expect(r.brineBbl).toBeCloseTo(16.59, 1);
    expect(r.bariteLbs).toBeCloseTo(((100 * (12 - 7.268)) / (35 - 7.268)) * 1470, 1);
    expect(r.owr).toBe("80/20");
    // mass balance closes back to target density
    expect(r.checkPpg).toBeCloseTo(12, 6);
  });

  test("build rejects target below liquid phase density", () => {
    expect(() =>
      buildObm({ finalVolumeBbl: 100, targetPpg: 7, oilPctOfLiquid: 80 }),
    ).toThrow();
  });

  test("OWR from retort: 54% oil, 18% water -> 75/25", () => {
    const r = owrFromRetort(54, 18);
    expect(r.oilOfLiquidPct).toBeCloseTo(75, 6);
    expect(r.owr).toBe("75/25");
  });

  test("raise OWR 75/25 -> 80/20 on 100 bbl: add 18 bbl oil", () => {
    const r = adjustOwr({
      mudVolumeBbl: 100,
      retortOilPct: 54,
      retortWaterPct: 18,
      targetOilPctOfLiquid: 80,
      currentMudPpg: 12,
      baseOilPpg: 7,
    });
    // Vo=54, Vw=18; oil needed = (0.8/0.2)*18 - 54 = 18 bbl
    expect(r.fluidToAdd).toBe("base oil");
    expect(r.addVolumeBbl).toBeCloseTo(18, 6);
    expect(r.newTotalVolumeBbl).toBeCloseTo(118, 6);
    // density drops when adding 7.0 ppg oil to 12.0 ppg mud
    expect(r.newMudPpg!).toBeCloseTo((100 * 12 + 18 * 7) / 118, 4);
  });

  test("lower OWR 75/25 -> 70/30 on 100 bbl: add water", () => {
    const r = adjustOwr({
      mudVolumeBbl: 100,
      retortOilPct: 54,
      retortWaterPct: 18,
      targetOilPctOfLiquid: 70,
    });
    // water needed = (0.3/0.7)*54 - 18 = 5.143 bbl
    expect(r.fluidToAdd).toBe("water/brine");
    expect(r.addVolumeBbl).toBeCloseTo(5.143, 3);
  });
});
