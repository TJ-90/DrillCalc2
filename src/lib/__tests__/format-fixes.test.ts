import { describe, expect, test } from "@jest/globals";
import { computeBalancedPlug } from "../cementplug";
import { fmt, num } from "../format";
import { computeHydraulics } from "../hydraulics";
import { computeKillSheet } from "../killsheet";

describe("fmt — display formatting", () => {
  test("drops trailing zeros after a significant decimal", () => {
    expect(fmt(15.8, 2)).toBe("15.8");
    expect(fmt(10.5, 2)).toBe("10.5");
    expect(fmt(0.1, 2)).toBe("0.1");
    expect(fmt(1.23, 3)).toBe("1.23");
  });

  test("integers render without a decimal point", () => {
    expect(fmt(12, 2)).toBe("12");
    expect(fmt(1285.0, 0)).toBe("1285");
  });

  test("never renders negative zero", () => {
    expect(fmt(-0.0001, 1)).toBe("0");
    expect(fmt(-0, 2)).toBe("0");
  });

  test("handles missing / non-finite values", () => {
    expect(fmt(undefined)).toBe("—");
    expect(fmt(null)).toBe("—");
    expect(fmt(NaN)).toBe("—");
    expect(fmt(Infinity)).toBe("—");
  });
});

describe("num — input parsing", () => {
  test("parses decimals and comma as decimal separator", () => {
    expect(num("12.5")).toBe(12.5);
    expect(num("12,5")).toBe(12.5);
  });
  test("rejects garbage and empty input", () => {
    expect(num("")).toBeUndefined();
    expect(num("12abc")).toBeUndefined();
    expect(num("1.2.3")).toBeUndefined();
  });
});

describe("review fixes — engine edge cases", () => {
  test("kill sheet: physically impossible (negative) influx gradient is flagged", () => {
    const r = computeKillSheet({
      directional: false,
      tvdFt: 10000,
      shoeTvdFt: 4000,
      currentMudPpg: 9.6,
      sidppPsi: 100,
      sicpPsi: 2000, // huge SICP/SIDPP spread vs small influx height
      pitGainBbl: 5,
      scrPsi: 800,
      pumpOutputBblStk: 0.119,
      drillStringVolumeBbl: 160,
      annulusOpenHoleBbl: 80,
      annulusCasedBbl: 240,
      bhaAnnularCapacityBblFt: 0.0291,
    });
    expect(r.influxGradientPsiFt!).toBeLessThan(0);
    expect(r.influxType).toBe("unknown");
    expect(r.warnings.some((w) => w.includes("negative"))).toBe(true);
  });

  test("balanced plug: over-long plug warns instead of returning silent nonsense", () => {
    const r = computeBalancedPlug({
      plugCase: "open-hole",
      plugBaseMd: 6000,
      plugLengthFt: 5900, // wet length > 6000 ft
      lowerIdIn: 8.5,
      stingerOdIn: 3.5,
      stingerIdIn: 2.764,
      slurryYieldFt3Sk: 1.15,
    });
    expect(r.wetPlugLengthFt).toBeGreaterThan(6000);
    expect(r.warnings.some((w) => w.includes("reach surface"))).toBe(true);
    expect(r.displacementBbl).toBeGreaterThanOrEqual(0);
  });

  test("hydraulics: pipe that does not fit the hole produces a warning, not silent zero", () => {
    const r = computeHydraulics({
      mudPpg: 10,
      pvCp: 20,
      ypLbf100ft2: 15,
      gpm: 350,
      string: [{ name: '9" DC', odIn: 9, idIn: 3, weightPpf: 195, lengthFt: 1000 }],
      holes: [{ name: '8-1/2" OH', idIn: 8.5, bottomMd: 1000, cased: false }],
    });
    expect(r.warnings.some((w) => w.includes("does not fit"))).toBe(true);
  });
});
