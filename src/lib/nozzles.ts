/**
 * Bit nozzle hydraulics (API field units).
 *
 * References (standard field formulas):
 *  - TFA (in^2)            = SUM[ pi/4 * (d/32)^2 ]
 *  - Nozzle velocity (ft/s) = 0.32086 * Q / TFA
 *  - Bit dP (psi)           = (MW * Q^2) / (12031 * Cd^2 * TFA^2)
 *                             (with Cd = 0.95 this is the familiar MW*Q^2/(10858*TFA^2))
 *  - Bit HHP                = dP * Q / 1714
 *  - HSI                    = HHP / bit area
 *  - Impact force (lbf)     = (MW * Q * Vn) / 1930
 */

export const DEFAULT_CD = 0.95;

/** Total flow area from nozzle sizes given in 32nds of an inch */
export function totalFlowAreaIn2(nozzles32nds: number[]): number {
  return nozzles32nds.reduce((s, d) => s + (Math.PI / 4) * (d / 32) ** 2, 0);
}

export function nozzleVelocityFtS(gpm: number, tfaIn2: number): number {
  return (0.32086 * gpm) / tfaIn2;
}

export function bitPressureDropPsi(
  mudPpg: number,
  gpm: number,
  tfaIn2: number,
  cd: number = DEFAULT_CD,
): number {
  return (mudPpg * gpm * gpm) / (12031 * cd * cd * tfaIn2 * tfaIn2);
}

export interface BitHydraulicsRow {
  gpm: number;
  tfaIn2: number;
  nozzleVelocityFtS: number;
  pressureDropPsi: number;
  hydraulicHp: number;
  /** Hydraulic horsepower per square inch of bit area (needs bit diameter) */
  hsi?: number;
  impactForceLbs: number;
  /** % of pump pressure consumed at the bit (needs pump pressure) */
  pctOfPumpPressure?: number;
}

export interface BitHydraulicsInput {
  nozzles32nds: number[];
  mudPpg: number;
  bitDiameterIn?: number;
  cd?: number;
  pumpPressurePsi?: number;
}

export function bitHydraulicsAt(input: BitHydraulicsInput, gpm: number): BitHydraulicsRow {
  const tfa = totalFlowAreaIn2(input.nozzles32nds);
  const cd = input.cd ?? DEFAULT_CD;
  const vn = nozzleVelocityFtS(gpm, tfa);
  const dP = bitPressureDropPsi(input.mudPpg, gpm, tfa, cd);
  const hhp = (dP * gpm) / 1714;
  const row: BitHydraulicsRow = {
    gpm,
    tfaIn2: tfa,
    nozzleVelocityFtS: vn,
    pressureDropPsi: dP,
    hydraulicHp: hhp,
    impactForceLbs: (input.mudPpg * gpm * vn) / 1930,
  };
  if (input.bitDiameterIn && input.bitDiameterIn > 0) {
    const bitArea = (Math.PI / 4) * input.bitDiameterIn ** 2;
    row.hsi = hhp / bitArea;
  }
  if (input.pumpPressurePsi && input.pumpPressurePsi > 0) {
    row.pctOfPumpPressure = (dP / input.pumpPressurePsi) * 100;
  }
  return row;
}

/** Table of bit hydraulics across a list of flow rates */
export function bitHydraulicsTable(
  input: BitHydraulicsInput,
  gpms: number[],
): BitHydraulicsRow[] {
  return gpms.map((q) => bitHydraulicsAt(input, q));
}
