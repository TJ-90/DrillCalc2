import { describe, expect, test } from "bun:test";
import {
  bitHydraulicsAt,
  bitHydraulicsTable,
  bitPressureDropPsi,
  nozzleVelocityFtS,
  totalFlowAreaIn2,
} from "../nozzles";

describe("bit nozzle hydraulics", () => {
  test("TFA of 3 x 12/32nds", () => {
    // 3 * pi/4 * (12/32)^2 = 0.3313 in^2
    expect(totalFlowAreaIn2([12, 12, 12])).toBeCloseTo(0.3313, 3);
  });

  test("TFA of mixed nozzles 13-13-12", () => {
    const expected =
      (Math.PI / 4) * ((13 / 32) ** 2 + (13 / 32) ** 2 + (12 / 32) ** 2);
    expect(totalFlowAreaIn2([13, 13, 12])).toBeCloseTo(expected, 6);
  });

  test("bit pressure drop: 12.5 ppg, 350 gpm, TFA 0.3313, Cd 0.95 ~ 1285 psi", () => {
    const tfa = totalFlowAreaIn2([12, 12, 12]);
    const dP = bitPressureDropPsi(12.5, 350, tfa, 0.95);
    // dP = MW*Q^2 / (10858 * TFA^2) = 12.5*122500/(10858*0.10976) ~ 1285
    expect(dP).toBeGreaterThan(1280);
    expect(dP).toBeLessThan(1290);
  });

  test("nozzle velocity 0.32086*Q/TFA ~ 339 ft/s", () => {
    const tfa = totalFlowAreaIn2([12, 12, 12]);
    expect(nozzleVelocityFtS(350, tfa)).toBeCloseTo(338.9, 0);
  });

  test("full row: HHP, HSI, impact force", () => {
    const row = bitHydraulicsAt(
      { nozzles32nds: [12, 12, 12], mudPpg: 12.5, bitDiameterIn: 8.5, pumpPressurePsi: 3000 },
      350,
    );
    // HHP = dP*Q/1714 ~ 262 hp; HSI = HHP / (pi/4*8.5^2 = 56.75) ~ 4.6
    expect(row.hydraulicHp).toBeCloseTo(262, 0);
    expect(row.hsi!).toBeCloseTo(4.62, 1);
    // IF = MW*Q*Vn/1930 ~ 768 lbf
    expect(row.impactForceLbs).toBeCloseTo(768, 0);
    expect(row.pctOfPumpPressure!).toBeCloseTo((row.pressureDropPsi / 3000) * 100, 6);
  });

  test("table covers multiple GPMs and dP scales with Q^2", () => {
    const rows = bitHydraulicsTable({ nozzles32nds: [12, 12, 12], mudPpg: 10 }, [200, 400]);
    expect(rows.length).toBe(2);
    expect(rows[1].pressureDropPsi / rows[0].pressureDropPsi).toBeCloseTo(4, 5);
  });
});
