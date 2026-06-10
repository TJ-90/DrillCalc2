import { describe, expect, test } from "@jest/globals";
import { KillSheetInput, computeKillSheet } from "../killsheet";

const base: KillSheetInput = {
  directional: false,
  tvdFt: 10000,
  shoeTvdFt: 4000,
  currentMudPpg: 9.6,
  sidppPsi: 480,
  sicpPsi: 600,
  pitGainBbl: 15,
  scrPsi: 800,
  scrSpm: 30,
  pumpOutputBblStk: 0.119,
  lotEmwPpg: 14.2,
  drillStringVolumeBbl: 160,
  annulusOpenHoleBbl: 80,
  annulusCasedBbl: 240,
  bhaAnnularCapacityBblFt: 0.0291,
};

describe("kill sheet — vertical well", () => {
  const r = computeKillSheet(base);

  test("kill mud weight = OMW + SIDPP/(0.052*TVD), rounded up to 0.1", () => {
    expect(r.killMudExactPpg).toBeCloseTo(9.6 + 480 / (0.052 * 10000), 4); // 10.523
    expect(r.killMudPpg).toBeCloseTo(10.6, 6);
  });

  test("ICP = SIDPP + SCRP = 1280 psi", () => {
    expect(r.initialCirculatingPressurePsi).toBeCloseTo(1280, 6);
  });

  test("FCP = SCRP * KMW / OMW", () => {
    expect(r.finalCirculatingPressurePsi).toBeCloseTo((800 * 10.6) / 9.6, 2); // 883.3
  });

  test("MAASP with original and kill mud", () => {
    expect(r.maaspInitialPsi!).toBeCloseTo((14.2 - 9.6) * 0.052 * 4000, 2); // 956.8
    expect(r.maaspKillMudPsi!).toBeCloseTo((14.2 - 10.6) * 0.052 * 4000, 2); // 748.8
  });

  test("strokes from volumes / pump output", () => {
    expect(r.surfaceToBitStrokes).toBeCloseTo(160 / 0.119, 1); // 1344.5
    expect(r.bitToShoeStrokes).toBeCloseTo(80 / 0.119, 1);
    expect(r.shoeToSurfaceStrokes).toBeCloseTo(240 / 0.119, 1);
    expect(r.totalStrokes).toBeCloseTo(480 / 0.119, 1);
    expect(r.surfaceToBitMin!).toBeCloseTo(160 / 0.119 / 30, 2);
  });

  test("influx characterization (gradient between mud and gas)", () => {
    expect(r.influxHeightFt!).toBeCloseTo(15 / 0.0291, 1); // 515.5
    const grad = 9.6 * 0.052 - (600 - 480) / (15 / 0.0291);
    expect(r.influxGradientPsiFt!).toBeCloseTo(grad, 4); // ~0.266 -> oil/gas-cut
    expect(r.influxType).toBe("oil / gas-cut mud");
  });

  test("schedule runs linearly from ICP to FCP over surface-to-bit strokes", () => {
    expect(r.schedule[0].pressurePsi).toBeCloseTo(1280, 6);
    expect(r.schedule[r.schedule.length - 1].pressurePsi).toBeCloseTo(
      r.finalCirculatingPressurePsi,
      6,
    );
    expect(r.schedule[r.schedule.length - 1].strokes).toBe(Math.round(160 / 0.119));
  });
});

describe("kill sheet — directional well", () => {
  test("KMW uses TVD even when MD is much longer", () => {
    const r = computeKillSheet({ ...base, directional: true, mdFt: 12000, shoeMdFt: 4600 });
    expect(r.killMudPpg).toBeCloseTo(10.6, 6); // unchanged from vertical case
    expect(r.warnings.some((w) => w.includes("Directional"))).toBe(true);
  });

  test("warns when MD < TVD", () => {
    const r = computeKillSheet({ ...base, directional: true, mdFt: 9000 });
    expect(r.warnings.some((w) => w.includes("MD is less than TVD"))).toBe(true);
  });

  test("gas influx detected for a low-gradient kick", () => {
    const r = computeKillSheet({ ...base, sicpPsi: 700 });
    // gradient = 0.4992 - 220/515.5 = 0.0725 -> gas
    expect(r.influxType).toBe("gas");
  });

  test("warns when kill mud exceeds shoe strength", () => {
    const r = computeKillSheet({ ...base, lotEmwPpg: 10.4 });
    expect(r.maaspKillMudPsi!).toBeLessThan(0);
    expect(r.warnings.some((w) => w.includes("shoe may break down"))).toBe(true);
  });
});
