import { describe, expect, test } from "bun:test";
import {
  annularCapacityBblFt,
  buoyancyFactor,
  emwPpg,
  hydrostaticPsi,
  pipeCapacityBblFt,
  pipeDisplacementBblFt,
  roundUpTo,
} from "../units";
import {
  HoleSection,
  StringComponent,
  annulusSegments,
  annulusVolumeBbl,
  annulusVolumeSplit,
  stringAirWeightLbs,
  stringBottomMd,
  stringBuoyedWeightLbs,
  stringCapacityBbl,
} from "../well";

describe("units", () => {
  test("pipe capacity of 5\" 19.5# DP (ID 4.276)", () => {
    // 4.276^2 / 1029.4 = 0.01776 bbl/ft
    expect(pipeCapacityBblFt(4.276)).toBeCloseTo(0.01776, 4);
  });

  test("annular capacity 8.5\" hole x 5\" DP", () => {
    // (72.25 - 25) / 1029.4 = 0.0459 bbl/ft
    expect(annularCapacityBblFt(8.5, 5)).toBeCloseTo(0.0459, 4);
  });

  test("displacement of 5\" x 4.276\" pipe", () => {
    expect(pipeDisplacementBblFt(5, 4.276)).toBeCloseTo((25 - 18.284176) / 1029.4, 6);
  });

  test("hydrostatic pressure 10 ppg @ 10000 ft = 5200 psi", () => {
    expect(hydrostaticPsi(10, 10000)).toBeCloseTo(5200, 6);
  });

  test("EMW of 2600 psi @ 10000 ft = 5 ppg", () => {
    expect(emwPpg(2600, 10000)).toBeCloseTo(5, 6);
  });

  test("buoyancy factor in 10 ppg mud", () => {
    expect(buoyancyFactor(10)).toBeCloseTo(0.8471, 4);
  });

  test("roundUpTo rounds kill mud weight up to next 0.1", () => {
    expect(roundUpTo(10.523, 0.1)).toBeCloseTo(10.6, 6);
    expect(roundUpTo(10.6, 0.1)).toBeCloseTo(10.6, 6);
  });
});

describe("well geometry", () => {
  const string: StringComponent[] = [
    { name: "5\" DP", odIn: 5, idIn: 4.276, weightPpf: 19.5, lengthFt: 9000 },
    { name: "6.5\" DC", odIn: 6.5, idIn: 2.5, weightPpf: 91.6, lengthFt: 600 },
  ];
  const holes: HoleSection[] = [
    { name: "9-5/8\" casing", idIn: 8.681, bottomMd: 5000, cased: true },
    { name: "8-1/2\" OH", idIn: 8.5, bottomMd: 9600, cased: false },
  ];

  test("string bottom and internal volume", () => {
    expect(stringBottomMd(string)).toBe(9600);
    const expected = (4.276 ** 2 / 1029.4) * 9000 + (2.5 ** 2 / 1029.4) * 600;
    expect(stringCapacityBbl(string)).toBeCloseTo(expected, 6); // ~163.5 bbl
    expect(stringCapacityBbl(string)).toBeCloseTo(163.5, 0);
  });

  test("string weight in air and buoyed", () => {
    expect(stringAirWeightLbs(string)).toBeCloseTo(9000 * 19.5 + 600 * 91.6, 6); // 230,460
    expect(stringBuoyedWeightLbs(string, 10)).toBeCloseTo(230460 * (55.4 / 65.4), 1);
  });

  test("annulus segments: DP-in-casing, DP-in-OH, DC-in-OH", () => {
    const segs = annulusSegments(string, holes);
    expect(segs.length).toBe(3);
    expect(segs[0]).toMatchObject({ topMd: 0, bottomMd: 5000, pipeOdIn: 5, cased: true });
    expect(segs[1]).toMatchObject({ topMd: 5000, bottomMd: 9000, pipeOdIn: 5, cased: false });
    expect(segs[2]).toMatchObject({ topMd: 9000, bottomMd: 9600, pipeOdIn: 6.5, cased: false });

    const casedVol = ((8.681 ** 2 - 25) / 1029.4) * 5000; // ~244.6
    const ohDpVol = ((72.25 - 25) / 1029.4) * 4000; // ~183.6
    const ohDcVol = ((72.25 - 42.25) / 1029.4) * 600; // ~17.5
    expect(annulusVolumeBbl(segs)).toBeCloseTo(casedVol + ohDpVol + ohDcVol, 4);

    const split = annulusVolumeSplit(segs);
    expect(split.casedBbl).toBeCloseTo(casedVol, 4);
    expect(split.openHoleBbl).toBeCloseTo(ohDpVol + ohDcVol, 4);
    expect(split.noPipeBbl).toBe(0);
  });

  test("rathole below the string becomes a no-pipe segment", () => {
    const shortString: StringComponent[] = [
      { name: "5\" DP", odIn: 5, idIn: 4.276, weightPpf: 19.5, lengthFt: 9000 },
    ];
    const segs = annulusSegments(shortString, holes);
    const noPipe = segs.find((s) => s.pipeOdIn === 0);
    expect(noPipe).toBeDefined();
    expect(noPipe!.topMd).toBe(9000);
    expect(noPipe!.bottomMd).toBe(9600);
    expect(noPipe!.capacityBblFt).toBeCloseTo(72.25 / 1029.4, 6);
  });
});
