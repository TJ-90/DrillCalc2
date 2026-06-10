import { describe, expect, test } from "bun:test";
import { computeBalancedPlug } from "../cementplug";

// Common geometry: 3-1/2" stinger (ID 2.764) in 8-1/2" open hole / 9-5/8" 47# casing (ID 8.681)
const HOLE_CAP = 8.5 ** 2 / 1029.4; // 0.070187 bbl/ft
const CSG_CAP = 8.681 ** 2 / 1029.4; // 0.073208 bbl/ft
const STINGER_CAP = 2.764 ** 2 / 1029.4; // 0.0074216 bbl/ft
const ANN_OH = (8.5 ** 2 - 3.5 ** 2) / 1029.4; // 0.058287
const ANN_CSG = (8.681 ** 2 - 3.5 ** 2) / 1029.4; // 0.061307

describe("balanced plug — case 1: entirely in open hole", () => {
  const r = computeBalancedPlug({
    plugCase: "open-hole",
    plugBaseMd: 6000,
    plugLengthFt: 500,
    lowerIdIn: 8.5,
    stingerOdIn: 3.5,
    stingerIdIn: 2.764,
    slurryYieldFt3Sk: 1.15,
    mixWaterGalSk: 5.2,
    spacerAheadBbl: 10,
  });

  test("slurry volume = plug length x hole capacity", () => {
    expect(r.slurryVolumeBbl).toBeCloseTo(500 * HOLE_CAP, 3); // 35.09 bbl
    expect(r.sacks).toBeCloseTo((500 * HOLE_CAP * 5.6146) / 1.15, 1); // ~171
    expect(r.mixWaterGal!).toBeCloseTo(r.sacks * 5.2, 3);
  });

  test("wet plug length fills annulus + pipe", () => {
    const wet = (500 * HOLE_CAP) / (ANN_OH + STINGER_CAP);
    expect(r.wetPlugLengthFt).toBeCloseTo(wet, 2); // ~534 ft
    expect(r.tocWithPipeMd).toBeCloseTo(6000 - wet, 2);
    expect(r.tocFinalMd).toBeCloseTo(5500, 6);
  });

  test("spacer behind balances spacer ahead", () => {
    expect(r.spacerBehindBbl).toBeCloseTo((10 * STINGER_CAP) / ANN_OH, 4); // 1.27 bbl
  });

  test("displacement = pipe volume to balanced level - spacer behind", () => {
    const wet = (500 * HOLE_CAP) / (ANN_OH + STINGER_CAP);
    const expected = STINGER_CAP * (6000 - wet) - (10 * STINGER_CAP) / ANN_OH;
    expect(r.displacementBbl).toBeCloseTo(expected, 2); // ~39.3 bbl
  });

  test("balance check: annulus and pipe cement heights are equal", () => {
    // By construction the wet plug height is the same inside and outside;
    // slurry volume = wet length * (ann + pipe capacity)
    expect(r.wetPlugLengthFt * (ANN_OH + STINGER_CAP)).toBeCloseTo(r.slurryVolumeBbl, 6);
  });
});

describe("balanced plug — case 2: entirely in cased hole", () => {
  test("uses casing ID capacities", () => {
    const r = computeBalancedPlug({
      plugCase: "cased-hole",
      plugBaseMd: 5000,
      plugLengthFt: 400,
      lowerIdIn: 8.681,
      stingerOdIn: 3.5,
      stingerIdIn: 2.764,
      slurryYieldFt3Sk: 1.15,
    });
    expect(r.slurryVolumeBbl).toBeCloseTo(400 * CSG_CAP, 3);
    expect(r.wetPlugLengthFt).toBeCloseTo((400 * CSG_CAP) / (ANN_CSG + STINGER_CAP), 2);
  });
});

describe("balanced plug — case 3: across the casing shoe", () => {
  const r = computeBalancedPlug({
    plugCase: "across-shoe",
    plugBaseMd: 7000,
    plugLengthFt: 500,
    lowerIdIn: 8.5,
    upperIdIn: 8.681,
    crossoverMd: 6800,
    stingerOdIn: 3.5,
    stingerIdIn: 2.764,
    slurryYieldFt3Sk: 1.15,
  });

  test("slurry volume splits 200 ft OH + 300 ft casing", () => {
    const expected = 200 * HOLE_CAP + 300 * CSG_CAP; // 14.04 + 21.96 = 36.0
    expect(r.zones.length).toBe(2);
    expect(r.zones[0].lengthFt).toBeCloseTo(200, 6);
    expect(r.zones[1].lengthFt).toBeCloseTo(300, 6);
    expect(r.slurryVolumeBbl).toBeCloseTo(expected, 3);
  });

  test("wet plug fills OH first, then casing", () => {
    const v = 200 * HOLE_CAP + 300 * CSG_CAP;
    const vOh = 200 * (ANN_OH + STINGER_CAP); // 13.14 bbl fills the 200 ft of OH
    const hCsg = (v - vOh) / (ANN_CSG + STINGER_CAP);
    expect(r.wetPlugLengthFt).toBeCloseTo(200 + hCsg, 2); // ~532.6 ft
    expect(r.tocWithPipeMd).toBeCloseTo(7000 - (200 + hCsg), 2);
  });

  test("open-hole excess applies only to the lower zone", () => {
    const rx = computeBalancedPlug({
      plugCase: "across-shoe",
      plugBaseMd: 7000,
      plugLengthFt: 500,
      lowerIdIn: 8.5,
      upperIdIn: 8.681,
      crossoverMd: 6800,
      stingerOdIn: 3.5,
      stingerIdIn: 2.764,
      slurryYieldFt3Sk: 1.15,
      excessLowerPct: 50,
    });
    expect(rx.zones[0].volumeBbl).toBeCloseTo(200 * HOLE_CAP * 1.5, 3);
    expect(rx.zones[1].volumeBbl).toBeCloseTo(300 * CSG_CAP, 3);
  });
});

describe("balanced plug — case 4: across a liner top", () => {
  test("liner ID below, host casing ID above", () => {
    // 7" 29# liner (ID 6.184), host 9-5/8" 47# (ID 8.681), liner top at 8500
    const linerCap = 6.184 ** 2 / 1029.4;
    const r = computeBalancedPlug({
      plugCase: "liner-overlap",
      plugBaseMd: 9000,
      plugLengthFt: 800,
      lowerIdIn: 6.184,
      upperIdIn: 8.681,
      crossoverMd: 8500,
      stingerOdIn: 3.5,
      stingerIdIn: 2.764,
      slurryYieldFt3Sk: 1.15,
    });
    expect(r.zones[0].name).toBe("inside liner");
    expect(r.zones[1].name).toBe("host casing");
    expect(r.slurryVolumeBbl).toBeCloseTo(500 * linerCap + 300 * CSG_CAP, 3);
  });

  test("rejects stinger that does not fit the liner", () => {
    expect(() =>
      computeBalancedPlug({
        plugCase: "liner-overlap",
        plugBaseMd: 9000,
        plugLengthFt: 800,
        lowerIdIn: 3.0,
        upperIdIn: 8.681,
        crossoverMd: 8500,
        stingerOdIn: 3.5,
        stingerIdIn: 2.764,
        slurryYieldFt3Sk: 1.15,
      }),
    ).toThrow();
  });

  test("requires crossover inputs for two-zone cases", () => {
    expect(() =>
      computeBalancedPlug({
        plugCase: "across-shoe",
        plugBaseMd: 7000,
        plugLengthFt: 500,
        lowerIdIn: 8.5,
        stingerOdIn: 3.5,
        stingerIdIn: 2.764,
        slurryYieldFt3Sk: 1.15,
      }),
    ).toThrow();
  });
});

describe("balanced plug — displacement with DP above stinger", () => {
  test("uses DP capacity above the stinger top", () => {
    const r = computeBalancedPlug({
      plugCase: "open-hole",
      plugBaseMd: 6000,
      plugLengthFt: 500,
      lowerIdIn: 8.5,
      stingerOdIn: 3.5,
      stingerIdIn: 2.764,
      stingerLengthFt: 600,
      upperPipeIdIn: 4.276,
      slurryYieldFt3Sk: 1.15,
    });
    const wet = (500 * HOLE_CAP) / (ANN_OH + STINGER_CAP);
    const stingerTop = 6000 - 600;
    const dpCap = 4.276 ** 2 / 1029.4;
    const expected = dpCap * stingerTop + STINGER_CAP * (6000 - wet - stingerTop);
    expect(r.displacementBbl).toBeCloseTo(expected, 2);
  });
});
