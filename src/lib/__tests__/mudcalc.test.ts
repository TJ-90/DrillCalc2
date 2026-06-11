import { describe, expect, test } from "@jest/globals";
import {
  BARITE_SG,
  M3_PER_BBL,
  PPG_PER_SG,
  PSI1000_PER_SG,
  addBarite,
  addOilToOilMud,
  addWaterToOilMud,
  adjustOwr,
  cutWeightConstantVolume,
  cutWeightVolumeIncrease,
  densityFromSg,
  densityToSg,
  mixMuds,
  mixOilMud,
  mixWaterMud,
  slugFlowback,
  waterContamination,
  weightUpConstantVolume,
  weightUpVolumeIncrease,
} from "../mudcalc";

const m3f = M3_PER_BBL;

describe("density unit conversions", () => {
  test("SG ↔ PPG via 8.345", () => {
    expect(densityFromSg(1, "ppg")).toBeCloseTo(8.345, 6);
    expect(densityToSg(16.69, "ppg")).toBeCloseTo(2, 4);
  });
  test("SG ↔ PSI/1000 ft via PPG×52", () => {
    expect(PSI1000_PER_SG).toBeCloseTo(433.94, 4);
    expect(densityFromSg(1, "psi1000")).toBeCloseTo(433.94, 4);
    expect(densityToSg(PPG_PER_SG * 52, "psi1000")).toBeCloseTo(1, 6);
  });
  test("SG passes through unchanged", () => {
    expect(densityToSg(1.25, "sg")).toBe(1.25);
    expect(densityFromSg(1.25, "sg")).toBe(1.25);
  });
});

describe("Weight Up", () => {
  test("volume increase: barite (MT) and volume increase", () => {
    const r = weightUpVolumeIncrease(100, 1.2, 1.44, BARITE_SG, m3f);
    expect(r.volumeIncrease).toBeCloseTo((100 * 0.24) / (4.2 - 1.44), 4); // 8.6957 bbls
    expect(r.bariteMt).toBeCloseTo(8.69565 * m3f * 4.2, 4); // ~5.807 MT
  });
  test("constant volume: jettison volume and barite (MT)", () => {
    const r = weightUpConstantVolume(100, 1.2, 1.44, BARITE_SG, m3f);
    expect(r.jet).toBeCloseTo((100 * 0.24) / (4.2 - 1.2), 6); // 8.0 bbls
    expect(r.bariteMt).toBeCloseTo(8.0 * m3f * 4.2, 6);
  });
});

describe("Cut Mud Weight", () => {
  test("volume increase: diluting fluid volume required", () => {
    expect(cutWeightVolumeIncrease(100, 1.32, 1.2, 1.0)).toBeCloseTo(60, 6);
  });
  test("constant volume: jet/add volume", () => {
    expect(cutWeightConstantVolume(100, 1.32, 1.2, 1.0)).toBeCloseTo(37.5, 6);
  });
});

describe("Mix two/three muds", () => {
  test("volume-weighted average density and total volume", () => {
    const r = mixMuds([
      { density: 1.2, volume: 50 },
      { density: 1.4, volume: 50 },
      { density: 0, volume: 0 },
    ]);
    expect(r.density).toBeCloseTo(1.3, 6);
    expect(r.volume).toBeCloseTo(100, 6);
  });
});

describe("Adjust OWR", () => {
  test("oil required, barite to maintain weight, volume increase", () => {
    const r = adjustOwr(100, 1.3, 75, 80, 54, 0.84, m3f);
    expect(r.oilRequired).toBeCloseTo(18, 6); // 75→80 OWR
    const bariteVol = (1.3 * 118 - (130 + 18 * 0.84)) / (4.2 - 1.3);
    expect(r.volumeIncrease).toBeCloseTo(bariteVol, 4); // ~2.855 bbls
    expect(r.bariteMt).toBeCloseTo(bariteVol * m3f * 4.2, 4);
  });
});

describe("Add a known weight (MT) of Barite", () => {
  test("volume increase and new mud weight", () => {
    const r = addBarite(5.0, 1.2, 100, m3f);
    const bariteVol = 5.0 / 4.2 / m3f;
    expect(r.volumeIncrease).toBeCloseTo(bariteVol, 4);
    expect(r.newDensity).toBeCloseTo((120 + 5.0 / m3f) / (100 + bariteVol), 4);
  });
});

describe("Add water to oil mud", () => {
  test("new mud weight and resultant OWR", () => {
    const r = addWaterToOilMud(20, 1.3, 100, 80, 64);
    expect(r.newDensity).toBeCloseTo(1.25, 6);
    expect(r.oilPct).toBeCloseTo(64, 6); // 64 oil / (16 + 20) water
    expect(r.waterPct).toBeCloseTo(36, 6);
  });
});

describe("Add oil to oil mud", () => {
  test("new mud weight and resultant OWR", () => {
    const r = addOilToOilMud(20, 0.84, 1.3, 100, 80, 64);
    expect(r.newDensity).toBeCloseTo((130 + 20 * 0.84) / 120, 6);
    expect(r.oilPct).toBeCloseTo(84, 6); // (64+20) oil / 16 water
    expect(r.waterPct).toBeCloseTo(16, 6);
  });
});

describe("Suspected water contamination", () => {
  test("water volume and resultant OWR (density drops 1.30 → 1.25)", () => {
    const r = waterContamination(1.3, 1.25, 100, 80, 64);
    expect(r.waterVolume).toBeCloseTo(20, 6);
    expect(r.oilPct).toBeCloseTo(64, 6);
    expect(r.waterPct).toBeCloseTo(36, 6);
  });
});

describe("Mix Water based Mud", () => {
  test("water and barite volumes", () => {
    const r = mixWaterMud(100, 1.2, 4.2);
    expect(r.bariteVolume).toBeCloseTo(20 / 3.2, 6); // 6.25 bbls
    expect(r.waterVolume).toBeCloseTo(93.75, 6);
    // mass balance closes
    expect(r.waterVolume * 1.0 + r.bariteVolume * 4.2).toBeCloseTo(100 * 1.2, 6);
  });
});

describe("Mix Oil based Mud", () => {
  test("oil, water and barite volumes for 80% OWR", () => {
    const r = mixOilMud(1.3, 100, 80, 4.2, 0.84);
    const liquidSg = 0.8 * 0.84 + 0.2 * 1.0; // 0.872
    const bariteVol = (100 * (1.3 - liquidSg)) / (4.2 - liquidSg);
    expect(r.bariteVolume).toBeCloseTo(bariteVol, 4);
    expect(r.oilVolume + r.waterVolume + r.bariteVolume).toBeCloseTo(100, 6);
    // mass balance closes to target density
    expect(
      (r.oilVolume * 0.84 + r.waterVolume * 1.0 + r.bariteVolume * 4.2) / 100,
    ).toBeCloseTo(1.3, 6);
    // OWR split honoured
    expect(r.oilVolume / (r.oilVolume + r.waterVolume)).toBeCloseTo(0.8, 6);
  });
});

describe("Slug Displacement volume", () => {
  test("flowback volume of mud", () => {
    expect(slugFlowback(1.2, 1.44, 20)).toBeCloseTo(4.0, 6);
  });
});
