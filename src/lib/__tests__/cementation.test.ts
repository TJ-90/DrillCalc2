import { describe, expect, test } from "@jest/globals";
import {
  computeConventionalCementation,
  computeStabInCementation,
} from "../cementation";

// 9-5/8" 47# casing (OD 9.625, ID 8.681) in 12-1/4" hole,
// previous 13-3/8" 68# (ID 12.415) shoe at 2500 ft
const OH_ANN = (12.25 ** 2 - 9.625 ** 2) / 1029.4; // 0.055782
const CASED_ANN = (12.415 ** 2 - 9.625 ** 2) / 1029.4; // 0.059735
const CSG_CAP = 8.681 ** 2 / 1029.4; // 0.073208
const DP_CAP = 4.276 ** 2 / 1029.4; // 0.017762

describe("conventional casing cementation (top/bottom plug)", () => {
  const r = computeConventionalCementation({
    casingOdIn: 9.625,
    casingIdIn: 8.681,
    shoeMd: 5000,
    openHoleIdIn: 12.25,
    prevCasingIdIn: 12.415,
    prevShoeMd: 2500,
    tocMd: 2000,
    floatCollarMd: 4920,
    excessOpenHolePct: 20,
    slurryYieldFt3Sk: 1.15,
    mixWaterGalSk: 5.2,
    slurryPpg: 15.8,
    mudPpg: 10,
    pumpOutputBblStk: 0.119,
  });

  test("volume breakdown: OH annulus (+20%), cased annulus, shoe track", () => {
    const oh = 2500 * OH_ANN * 1.2; // 167.3 bbl
    const cased = 500 * CASED_ANN; // 29.9 bbl
    const track = 80 * CSG_CAP; // 5.86 bbl
    expect(r.slurryVolumeBbl).toBeCloseTo(oh + cased + track, 2); // ~203 bbl
    expect(r.breakdown.length).toBe(3);
    expect(r.breakdown.find((b) => b.name.includes("Open-hole"))!.volumeBbl).toBeCloseTo(oh, 2);
    expect(r.breakdown.find((b) => b.name.includes("Cased"))!.volumeBbl).toBeCloseTo(cased, 2);
    expect(r.breakdown.find((b) => b.name.includes("Shoe track"))!.volumeBbl).toBeCloseTo(track, 2);
  });

  test("sacks and mix water from yield", () => {
    expect(r.sacks).toBeCloseTo((r.slurryVolumeBbl * 5.6146) / 1.15, 1); // ~991 sx
    expect(r.mixWaterGal!).toBeCloseTo(r.sacks * 5.2, 1);
  });

  test("displacement bumps the top plug on the float collar", () => {
    expect(r.displacementBbl).toBeCloseTo(4920 * CSG_CAP, 2); // ~360 bbl
    expect(r.displacementStrokes!).toBeCloseTo((4920 * CSG_CAP) / 0.119, 0);
  });

  test("lift pressure at bump = 0.052*(slurry-mud)*(FC-TOC)", () => {
    expect(r.liftPressurePsi!).toBeCloseTo(0.052 * 5.8 * (4920 - 2000), 1); // ~880 psi
  });

  test("rathole below the shoe is cemented when hole TD > shoe", () => {
    const r2 = computeConventionalCementation({
      casingOdIn: 9.625,
      casingIdIn: 8.681,
      shoeMd: 5000,
      openHoleIdIn: 12.25,
      prevCasingIdIn: 12.415,
      prevShoeMd: 2500,
      holeTdMd: 5030,
      tocMd: 2000,
      floatCollarMd: 4920,
      slurryYieldFt3Sk: 1.15,
    });
    const rathole = r2.breakdown.find((b) => b.name.includes("Rathole"));
    expect(rathole).toBeDefined();
    expect(rathole!.volumeBbl).toBeCloseTo(30 * (12.25 ** 2 / 1029.4), 3);
  });

  test("TOC inside open hole leaves no cased-annulus cement", () => {
    const r3 = computeConventionalCementation({
      casingOdIn: 9.625,
      casingIdIn: 8.681,
      shoeMd: 5000,
      openHoleIdIn: 12.25,
      prevCasingIdIn: 12.415,
      prevShoeMd: 2500,
      tocMd: 3500,
      floatCollarMd: 4920,
      slurryYieldFt3Sk: 1.15,
    });
    expect(r3.breakdown.some((b) => b.name.includes("Cased"))).toBe(false);
    expect(
      r3.breakdown.find((b) => b.name.includes("Open-hole"))!.lengthFt,
    ).toBeCloseTo(1500, 6);
  });
});

describe("stab-in cementation", () => {
  const r = computeStabInCementation({
    casingOdIn: 9.625,
    casingIdIn: 8.681,
    shoeMd: 5000,
    floatCollarMd: 4960,
    openHoleIdIn: 12.25,
    prevCasingIdIn: 12.415,
    prevShoeMd: 2500,
    tocMd: 2000,
    dpIdIn: 4.276,
    excessOpenHolePct: 20,
    slurryYieldFt3Sk: 1.15,
    pumpOutputBblStk: 0.119,
  });

  test("slurry covers annulus and shoe track", () => {
    const oh = 2500 * OH_ANN * 1.2;
    const cased = 500 * CASED_ANN;
    const track = 40 * CSG_CAP;
    expect(r.slurryVolumeBbl).toBeCloseTo(oh + cased + track, 2);
  });

  test("displacement is the drill pipe volume to the stab-in point", () => {
    expect(r.displacementBbl).toBeCloseTo(4960 * DP_CAP, 2); // ~88 bbl — far less than full casing
    // sanity: stab-in displacement is much smaller than a conventional job
    expect(r.displacementBbl).toBeLessThan(100);
  });
});
