import { describe, expect, test } from "bun:test";
import { computeJarring } from "../jarring";

describe("jarring weights", () => {
  const base = {
    mudPpg: 10,
    buoyedWeightAboveJarLbs: 150000,
    dragLbs: 20000,
    upDetentLbs: 80000,
    downDetentLbs: 60000,
    cockUpLbs: 40000,
    cockDownLbs: 30000,
    pumpOpenAreaIn2: 30,
    diffPressurePsi: 1500,
  };

  test("pump-open force = area x differential pressure", () => {
    const r = computeJarring(base);
    expect(r.pumpOpenForceLbs).toBeCloseTo(45000, 6);
  });

  test("fire up = Wa + up detent + drag - POF", () => {
    const r = computeJarring(base);
    expect(r.fireUpHookloadLbs).toBeCloseTo(150000 + 80000 + 20000 - 45000, 6); // 205,000
    expect(r.fireUpOverpullLbs).toBeCloseTo(55000, 6);
  });

  test("fire down = Wa - down detent - drag - POF", () => {
    const r = computeJarring(base);
    expect(r.fireDownHookloadLbs).toBeCloseTo(150000 - 60000 - 20000 - 45000, 6); // 25,000
    expect(r.fireDownSetDownLbs).toBeCloseTo(125000, 6);
  });

  test("cocking loads", () => {
    const r = computeJarring(base);
    expect(r.cockUpHookloadLbs).toBeCloseTo(150000 + 40000 + 20000 - 45000, 6); // 165,000
    expect(r.cockDownHookloadLbs).toBeCloseTo(150000 - 30000 - 20000 - 45000, 6); // 55,000
  });

  test("air weight above jar gets buoyancy applied", () => {
    const r = computeJarring({
      mudPpg: 13,
      airWeightAboveJarLbs: 100000,
      upDetentLbs: 50000,
      downDetentLbs: 50000,
    });
    // BF = (65.4-13)/65.4 = 0.8012
    expect(r.buoyancyFactor).toBeCloseTo(0.8012, 4);
    expect(r.buoyedWeightAboveJarLbs).toBeCloseTo(80122, 0);
    expect(r.fireUpHookloadLbs).toBeCloseTo(130122, 0);
  });

  test("warns when down-jarring is impossible (negative hookload)", () => {
    const r = computeJarring({
      mudPpg: 10,
      buoyedWeightAboveJarLbs: 40000,
      upDetentLbs: 80000,
      downDetentLbs: 60000,
      pumpOpenAreaIn2: 30,
      diffPressurePsi: 1500,
    });
    expect(r.fireDownHookloadLbs).toBeLessThan(0);
    expect(r.warnings.some((w) => w.includes("negative"))).toBe(true);
  });
});
