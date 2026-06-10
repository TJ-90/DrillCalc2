/**
 * Mud mixing calculations — water based mud (WBM) and oil based mud (OBM).
 *
 * Standard field formulas (Lapeyrouse, "Formulas and Calculations for
 * Drilling, Production and Workover"):
 *
 * Weight-up with a solid weighting agent of density Ws (ppg equiv):
 *   lbs per bbl of initial mud = 42 * Ws * (W2 - W1) / (Ws - W2)
 *   (barite SG 4.20 -> Ws = 35 ppg -> the familiar 1470*(W2-W1)/(35-W2) per 100 bbl)
 *
 * Dilution:  Vadded = V1 * (W1 - W2) / (W2 - Wd)
 * Blending:  Wf = (V1*W1 + V2*W2) / (V1 + V2)
 *
 * OBM build for target density Wt, oil fraction fo of the liquid phase:
 *   liquid density  Wl = fo*Wo + (1-fo)*Ww
 *   barite volume   Vb = Vf * (Wt - Wl) / (35 - Wl)
 */
import { BARITE_PPG, WATER_PPG } from "./units";

// ---------------------------------------------------------------- WBM

export interface WeightUpResult {
  lbsPerBbl: number;
  totalLbs: number;
  sacks: number;
  /** metric tonnes, for bulk barite */
  tonnes: number;
  volumeIncreaseBbl: number;
  finalVolumeBbl: number;
}

/**
 * Weight up an initial volume V1 from W1 to W2 with a solid weighting agent.
 * Default agent is API barite (35 ppg / SG 4.20); pass e.g. 22.5 for CaCO3
 * (SG 2.7) or 40 for hematite (SG ~4.8). sackLbs defaults to 100 lb sacks.
 */
export function weightUp(
  v1Bbl: number,
  w1Ppg: number,
  w2Ppg: number,
  agentPpg: number = BARITE_PPG,
  sackLbs = 100,
): WeightUpResult {
  if (w2Ppg >= agentPpg) {
    throw new Error(`Target density must be below the weighting agent density (${agentPpg} ppg)`);
  }
  if (w2Ppg < w1Ppg) {
    throw new Error("Target density must be above current density — use dilution instead");
  }
  const lbsPerBbl = (42 * agentPpg * (w2Ppg - w1Ppg)) / (agentPpg - w2Ppg);
  const totalLbs = lbsPerBbl * v1Bbl;
  const volumeIncreaseBbl = totalLbs / (42 * agentPpg);
  return {
    lbsPerBbl,
    totalLbs,
    sacks: totalLbs / sackLbs,
    tonnes: totalLbs / 2204.62,
    volumeIncreaseBbl,
    finalVolumeBbl: v1Bbl + volumeIncreaseBbl,
  };
}

/** Starting volume of W1 mud so that after weighting up to W2 the final volume is Vf */
export function startingVolumeForFinal(
  vfBbl: number,
  w1Ppg: number,
  w2Ppg: number,
  agentPpg: number = BARITE_PPG,
): number {
  return (vfBbl * (agentPpg - w2Ppg)) / (agentPpg - w1Ppg);
}

export interface DilutionResult {
  addedBbl: number;
  finalVolumeBbl: number;
}

/** Volume of diluent (default fresh water) to cut mud from W1 down to W2 */
export function dilution(
  v1Bbl: number,
  w1Ppg: number,
  w2Ppg: number,
  diluentPpg: number = WATER_PPG,
): DilutionResult {
  if (w2Ppg >= w1Ppg) throw new Error("Target density must be below current density");
  if (w2Ppg <= diluentPpg) {
    throw new Error(`Target density must be above the diluent density (${diluentPpg} ppg)`);
  }
  const addedBbl = (v1Bbl * (w1Ppg - w2Ppg)) / (w2Ppg - diluentPpg);
  return { addedBbl, finalVolumeBbl: v1Bbl + addedBbl };
}

/** Density after blending two muds */
export function blendDensity(v1: number, w1: number, v2: number, w2: number): number {
  return (v1 * w1 + v2 * w2) / (v1 + v2);
}

/** Volume of mud 2 to blend with V1 of mud 1 to reach target density Wt */
export function blendVolumeForTarget(
  v1: number,
  w1: number,
  w2: number,
  wt: number,
): number {
  if ((wt - w1) * (w2 - wt) <= 0) {
    throw new Error("Target density must lie between the two mud densities");
  }
  return (v1 * (wt - w1)) / (w2 - wt);
}

// ---------------------------------------------------------------- OBM

export interface ObmBuildInput {
  finalVolumeBbl: number;
  targetPpg: number;
  /** Oil percentage of the liquid phase, e.g. 80 for an 80/20 OWR */
  oilPctOfLiquid: number;
  /** Base oil density, ppg (diesel ~7.0, mineral oil ~6.7) */
  baseOilPpg?: number;
  /** Water/brine density, ppg (fresh 8.34, CaCl2 brine up to ~11.6) */
  brinePpg?: number;
  /** Weighting agent density, ppg equivalent (barite 35) */
  agentPpg?: number;
}

export interface ObmBuildResult {
  baseOilBbl: number;
  brineBbl: number;
  bariteBbl: number;
  bariteLbs: number;
  bariteSacks: number;
  liquidPhasePpg: number;
  owr: string;
  checkPpg: number;
}

/** Volumes of base oil, brine and barite to build an OBM of target density and OWR */
export function buildObm(input: ObmBuildInput): ObmBuildResult {
  const oilPpg = input.baseOilPpg ?? 7.0;
  const brinePpg = input.brinePpg ?? WATER_PPG;
  const agentPpg = input.agentPpg ?? BARITE_PPG;
  const fo = input.oilPctOfLiquid / 100;
  if (fo < 0 || fo > 1) throw new Error("Oil % of liquid phase must be 0–100");
  const wl = fo * oilPpg + (1 - fo) * brinePpg;
  if (input.targetPpg < wl) {
    throw new Error(
      `Target density (${input.targetPpg} ppg) is below the unweighted liquid phase density (${wl.toFixed(2)} ppg)`,
    );
  }
  if (input.targetPpg >= agentPpg) {
    throw new Error(`Target density must be below the weighting agent density (${agentPpg} ppg)`);
  }
  const vb = (input.finalVolumeBbl * (input.targetPpg - wl)) / (agentPpg - wl);
  const vl = input.finalVolumeBbl - vb;
  const vo = vl * fo;
  const vw = vl * (1 - fo);
  const bariteLbs = vb * 42 * agentPpg;
  const checkPpg =
    (vo * oilPpg + vw * brinePpg + vb * agentPpg) / input.finalVolumeBbl;
  return {
    baseOilBbl: vo,
    brineBbl: vw,
    bariteBbl: vb,
    bariteLbs,
    bariteSacks: bariteLbs / 100,
    liquidPhasePpg: wl,
    owr: `${Math.round(fo * 100)}/${Math.round((1 - fo) * 100)}`,
    checkPpg,
  };
}

/** Oil/water ratio from retort oil and water percentages (% of whole mud) */
export function owrFromRetort(oilPct: number, waterPct: number): {
  oilOfLiquidPct: number;
  waterOfLiquidPct: number;
  owr: string;
} {
  const liquid = oilPct + waterPct;
  if (liquid <= 0) throw new Error("Retort oil + water must be > 0");
  const o = (oilPct / liquid) * 100;
  const w = 100 - o;
  return {
    oilOfLiquidPct: o,
    waterOfLiquidPct: w,
    owr: `${Math.round(o)}/${Math.round(w)}`,
  };
}

export interface OwrAdjustInput {
  mudVolumeBbl: number;
  /** Retort readings, % of whole mud */
  retortOilPct: number;
  retortWaterPct: number;
  /** Target oil % of the liquid phase (e.g. 75 for 75/25) */
  targetOilPctOfLiquid: number;
  currentMudPpg?: number;
  baseOilPpg?: number;
  brinePpg?: number;
}

export interface OwrAdjustResult {
  currentOwr: string;
  targetOwr: string;
  fluidToAdd: "base oil" | "water/brine" | "none";
  addVolumeBbl: number;
  newTotalVolumeBbl: number;
  newMudPpg?: number;
}

/**
 * Volume of base oil (to raise OWR) or water/brine (to lower OWR) to add to an
 * existing OBM. Raising OWR: oil added so target_o/target_w = (Vo+dV)/Vw.
 * Lowering OWR: water added so target ratio holds with (Vw+dV).
 */
export function adjustOwr(input: OwrAdjustInput): OwrAdjustResult {
  const vo = (input.mudVolumeBbl * input.retortOilPct) / 100;
  const vw = (input.mudVolumeBbl * input.retortWaterPct) / 100;
  if (vo <= 0 && vw <= 0) throw new Error("Retort oil and water are both zero");
  const current = owrFromRetort(input.retortOilPct, input.retortWaterPct);
  const ft = input.targetOilPctOfLiquid / 100;
  if (ft <= 0 || ft >= 1) throw new Error("Target oil % must be between 0 and 100 exclusive");
  const targetOwr = `${Math.round(ft * 100)}/${Math.round((1 - ft) * 100)}`;

  let fluidToAdd: OwrAdjustResult["fluidToAdd"] = "none";
  let addVolumeBbl = 0;
  let addPpg = 0;
  const currentFo = vo / (vo + vw);
  if (ft > currentFo + 1e-9) {
    // add oil: (vo + dv) / vw = ft / (1 - ft)
    addVolumeBbl = (ft / (1 - ft)) * vw - vo;
    fluidToAdd = "base oil";
    addPpg = input.baseOilPpg ?? 7.0;
  } else if (ft < currentFo - 1e-9) {
    // add water: vo / (vw + dv) = ft / (1 - ft)
    addVolumeBbl = ((1 - ft) / ft) * vo - vw;
    fluidToAdd = "water/brine";
    addPpg = input.brinePpg ?? WATER_PPG;
  }

  const newTotalVolumeBbl = input.mudVolumeBbl + addVolumeBbl;
  const newMudPpg =
    input.currentMudPpg !== undefined && addVolumeBbl > 0
      ? (input.mudVolumeBbl * input.currentMudPpg + addVolumeBbl * addPpg) /
        newTotalVolumeBbl
      : input.currentMudPpg;

  return { currentOwr: current.owr, targetOwr, fluidToAdd, addVolumeBbl, newTotalVolumeBbl, newMudPpg };
}
