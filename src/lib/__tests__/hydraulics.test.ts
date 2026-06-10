import { describe, expect, test } from "bun:test";
import { computeHydraulics } from "../hydraulics";
import { HoleSection, StringComponent } from "../well";

const string: StringComponent[] = [
  { name: "5\" DP", odIn: 5, idIn: 4.276, weightPpf: 19.5, lengthFt: 10000 },
];
const holes: HoleSection[] = [
  { name: "8-1/2\" OH", idIn: 8.5, bottomMd: 10000, cased: false },
];

describe("mud hydraulics — Bingham plastic", () => {
  const r = computeHydraulics({
    mudPpg: 10,
    pvCp: 20,
    ypLbf100ft2: 15,
    gpm: 350,
    string,
    holes,
    nozzles32nds: [12, 12, 12],
    cd: 0.95,
  });

  test("drill pipe internal loss (turbulent) ~ 393 psi", () => {
    const pipe = r.sections.find((s) => s.kind === "pipe")!;
    // v = 350/(2.448*4.276^2) = 7.82 ft/s, Re ~ 4160 -> turbulent
    expect(pipe.velocityFtS!).toBeCloseTo(7.82, 1);
    expect(pipe.regime).toBe("turbulent");
    expect(pipe.dPsi).toBeGreaterThan(380);
    expect(pipe.dPsi).toBeLessThan(405);
  });

  test("annular loss (laminar) ~ 264 psi", () => {
    const ann = r.sections.find((s) => s.kind === "annulus")!;
    // v = 350/(2.448*(72.25-25)) = 3.03 ft/s, Re ~ 750 -> laminar
    expect(ann.velocityFtS!).toBeCloseTo(3.03, 1);
    expect(ann.regime).toBe("laminar");
    // dP = 20*10000*3.026/(1000*12.25) + 15*10000/(200*3.5) = 49.4 + 214.3
    expect(ann.dPsi).toBeGreaterThan(258);
    expect(ann.dPsi).toBeLessThan(270);
  });

  test("bit loss ~ 1028 psi and totals add up", () => {
    expect(r.bitPsi).toBeGreaterThan(1020);
    expect(r.bitPsi).toBeLessThan(1035);
    expect(r.totalPsi).toBeCloseTo(r.surfacePsi + r.pipePsi + r.bitPsi + r.annulusPsi, 6);
    // expected pump pressure ~ 1685 psi
    expect(r.totalPsi).toBeGreaterThan(1660);
    expect(r.totalPsi).toBeLessThan(1710);
  });

  test("ECD = MW + annular losses/(0.052*TVD) ~ 10.5 ppg", () => {
    expect(r.ecdPpg!).toBeGreaterThan(10.4);
    expect(r.ecdPpg!).toBeLessThan(10.6);
  });

  test("bottoms-up time from annular volume", () => {
    const annVolBbl = ((8.5 ** 2 - 25) / 1029.4) * 10000;
    expect(r.bottomsUpMin!).toBeCloseTo(annVolBbl / (350 / 42), 1); // ~55 min
  });

  test("surface equipment case 3 adds ~23 psi", () => {
    const rs = computeHydraulics({
      mudPpg: 10,
      pvCp: 20,
      ypLbf100ft2: 15,
      gpm: 350,
      string,
      holes,
      surfaceCase: 3,
    });
    expect(rs.surfacePsi).toBeGreaterThan(20);
    expect(rs.surfacePsi).toBeLessThan(26);
  });

  test("losses rise with flow rate", () => {
    const lo = computeHydraulics({ mudPpg: 10, pvCp: 20, ypLbf100ft2: 15, gpm: 250, string, holes });
    const hi = computeHydraulics({ mudPpg: 10, pvCp: 20, ypLbf100ft2: 15, gpm: 500, string, holes });
    expect(hi.totalPsi).toBeGreaterThan(lo.totalPsi);
    expect(hi.ecdPpg!).toBeGreaterThan(lo.ecdPpg!);
  });

  test("multi-section well builds one annulus loss per segment", () => {
    const deepHoles: HoleSection[] = [
      { name: "9-5/8\" casing", idIn: 8.681, bottomMd: 5000, cased: true },
      { name: "8-1/2\" OH", idIn: 8.5, bottomMd: 10000, cased: false },
    ];
    const rr = computeHydraulics({
      mudPpg: 10,
      pvCp: 20,
      ypLbf100ft2: 15,
      gpm: 350,
      string,
      holes: deepHoles,
    });
    expect(rr.sections.filter((s) => s.kind === "annulus").length).toBe(2);
  });

  test("rejects zero flow", () => {
    expect(() =>
      computeHydraulics({ mudPpg: 10, pvCp: 20, ypLbf100ft2: 15, gpm: 0, string, holes }),
    ).toThrow();
  });
});
