/**
 * Mud Engineering Calculator — faithful port of MUDCALCU.EXE
 * ("Mud Engineering Calculator" v1.0, Jan 99, by Bruce Guthrie / Baroid).
 *
 * The original is a single Delphi form with a Function selector and global
 * unit choices (Density: PPG / SG / PSI/1000 ft, Volume: bbls / m³). The 13
 * functions, their inputs, and every result caption below are reproduced
 * verbatim from the program's form resources.
 *
 * The program works internally in SG + m³ + MT (mass in metric tonnes =
 * volume in m³ × specific gravity), which is why barite is reported in MT.
 * The mass/volume balances are therefore unit-agnostic; only the density
 * display conversions use constants (SG↔PPG = ×8.345, PSI/1000ft = PPG×52).
 * Where a function has no weighting-agent field (Add Barite, Adjust OWR) the
 * original assumes API barite SG 4.2; water/contamination assumes SG 1.0.
 */

export type DensityUnit = "ppg" | "sg" | "psi1000";
export type VolumeUnit = "bbls" | "m3";

export const PPG_PER_SG = 8.345;
export const PSI1000_PER_SG = PPG_PER_SG * 52; // 433.94 psi/1000 ft per SG
export const M3_PER_BBL = 0.1589873;
export const BARITE_SG = 4.2; // API barite, used where no SG field exists
export const WATER_SG = 1.0;

export const DENSITY_UNIT_LABELS: Record<DensityUnit, string> = {
  ppg: "PPG",
  sg: "SG",
  psi1000: "PSI/1000 ft",
};
export const VOLUME_UNIT_LABELS: Record<VolumeUnit, string> = {
  bbls: "bbls",
  m3: "m³",
};

/** Function selector — order matches the EXE's FunctionRadioGroup exactly. */
export const FUNCTIONS = [
  "Weight Up (volume increase)",
  "Weight Up (constant volume)",
  "Cut Mud Weight (volume increase)",
  "Cut Mud Weight (constant volume)",
  "Mix two/three muds",
  "Adjust OWR",
  "Add a known weight (MT) of Barite to mud",
  "Add a known volume of water to oil mud",
  "Add a known volume of base fluid to oil mud",
  "Suspected Water contamination of oil mud",
  "Mix Water based Mud",
  "Mix Oil based Mud",
  "Slug Displacement volume",
] as const;
export type MudFunction = (typeof FUNCTIONS)[number];

// ---------------------------------------------------------------- unit helpers

export function densityToSg(value: number, unit: DensityUnit): number {
  switch (unit) {
    case "ppg":
      return value / PPG_PER_SG;
    case "psi1000":
      return value / PSI1000_PER_SG;
    case "sg":
    default:
      return value;
  }
}

export function densityFromSg(sg: number, unit: DensityUnit): number {
  switch (unit) {
    case "ppg":
      return sg * PPG_PER_SG;
    case "psi1000":
      return sg * PSI1000_PER_SG;
    case "sg":
    default:
      return sg;
  }
}

/** m³ per one unit of the chosen volume unit (for MT = m³ × SG). */
export function m3PerVolume(unit: VolumeUnit): number {
  return unit === "m3" ? 1 : M3_PER_BBL;
}

// ---------------------------------------------------------------- result model

export type ResultKind = "density" | "volume" | "mt" | "owr" | "percent" | "text";

export interface MudResultLine {
  /** Verbatim caption from the EXE (the part before the value). */
  label: string;
  value: number;
  kind: ResultKind;
  /** For OWR lines, the water side of the "oil / water" pair. */
  value2?: number;
}

export interface MudError {
  error: string;
}

/** Verbatim error string from the EXE. */
export const INVALID_NUMBER = "This is NOT a valid number, please try again";

// ---------------------------------------------------------------- pure calcs
// All densities below are SG; all volumes are in the user's chosen volume unit.
// `agentSg` is the weighting-agent SG; `m3f` converts the volume unit to m³.

/** Weight Up (volume increase): add barite, volume grows. */
export function weightUpVolumeIncrease(
  v1: number,
  d1: number,
  d2: number,
  agentSg: number,
  m3f: number,
): { bariteMt: number; volumeIncrease: number } {
  const volumeIncrease = (v1 * (d2 - d1)) / (agentSg - d2); // user vol units
  const bariteMt = volumeIncrease * m3f * agentSg;
  return { bariteMt, volumeIncrease };
}

/** Weight Up (constant volume): jettison some mud, then weight up to keep volume. */
export function weightUpConstantVolume(
  v1: number,
  d1: number,
  d2: number,
  agentSg: number,
  m3f: number,
): { jet: number; bariteMt: number } {
  const jet = (v1 * (d2 - d1)) / (agentSg - d1);
  const bariteMt = jet * m3f * agentSg;
  return { jet, bariteMt };
}

/** Cut Mud Weight (volume increase): add diluting fluid, volume grows. */
export function cutWeightVolumeIncrease(
  v1: number,
  d1: number,
  d2: number,
  dDilute: number,
): number {
  return (v1 * (d1 - d2)) / (d2 - dDilute);
}

/** Cut Mud Weight (constant volume): jettison and add equal diluting fluid. */
export function cutWeightConstantVolume(
  v1: number,
  d1: number,
  d2: number,
  dDilute: number,
): number {
  return (v1 * (d1 - d2)) / (d1 - dDilute);
}

/** Mix two or three muds (zero-volume entries ignored). */
export function mixMuds(
  pairs: { density: number; volume: number }[],
): { density: number; volume: number } {
  let mass = 0;
  let vol = 0;
  for (const p of pairs) {
    if (p.volume > 0) {
      mass += p.density * p.volume;
      vol += p.volume;
    }
  }
  return { density: vol > 0 ? mass / vol : 0, volume: vol };
}

/**
 * Adjust OWR: raise/lower oil fraction of the liquid phase, then re-weight
 * with barite to maintain mud density. oilPctOfMud is the retort oil reading
 * (oil as % of whole mud).
 */
export function adjustOwr(
  v1: number,
  mudSg: number,
  startOwrOilPct: number,
  desiredOwrOilPct: number,
  oilPctOfMud: number,
  oilSg: number,
  m3f: number,
): { oilRequired: number; bariteMt: number; volumeIncrease: number } {
  const oilVol = (v1 * oilPctOfMud) / 100;
  const waterVol = (oilVol * (100 - startOwrOilPct)) / startOwrOilPct;
  const oilTarget = (waterVol * desiredOwrOilPct) / (100 - desiredOwrOilPct);
  const oilRequired = oilTarget - oilVol;

  // barite to restore density after adding the oil
  const v0 = v1 + oilRequired;
  const m0 = v1 * mudSg + oilRequired * oilSg;
  const bariteVol = (mudSg * v0 - m0) / (BARITE_SG - mudSg); // user vol units
  const bariteMt = bariteVol * m3f * BARITE_SG;
  return { oilRequired, bariteMt, volumeIncrease: bariteVol };
}

/** Add a known weight (MT) of Barite to mud. */
export function addBarite(
  bariteMt: number,
  d1: number,
  v1: number,
  m3f: number,
): { volumeIncrease: number; newDensity: number } {
  const bariteVol = bariteMt / BARITE_SG / m3f; // user vol units
  const newDensity = (v1 * d1 + bariteMt / m3f) / (v1 + bariteVol);
  return { volumeIncrease: bariteVol, newDensity };
}

/** Resultant OWR (oil%, water%) after changing the liquid phase of an OBM. */
function resultantOwr(
  oilVol: number,
  waterVol: number,
): { oilPct: number; waterPct: number } {
  const liq = oilVol + waterVol;
  if (liq <= 0) return { oilPct: 0, waterPct: 0 };
  const oilPct = (oilVol / liq) * 100;
  return { oilPct, waterPct: 100 - oilPct };
}

/** Add a known volume of water to oil mud. */
export function addWaterToOilMud(
  waterAdd: number,
  d1: number,
  v1: number,
  startOwrOilPct: number,
  oilPctOfMud: number,
): { newDensity: number; oilPct: number; waterPct: number } {
  const newDensity = (v1 * d1 + waterAdd * WATER_SG) / (v1 + waterAdd);
  const oilVol = (v1 * oilPctOfMud) / 100;
  const waterVol = (oilVol * (100 - startOwrOilPct)) / startOwrOilPct;
  const owr = resultantOwr(oilVol, waterVol + waterAdd);
  return { newDensity, ...owr };
}

/** Add a known volume of base fluid (oil) to oil mud. */
export function addOilToOilMud(
  oilAdd: number,
  oilSg: number,
  d1: number,
  v1: number,
  startOwrOilPct: number,
  oilPctOfMud: number,
): { newDensity: number; oilPct: number; waterPct: number } {
  const newDensity = (v1 * d1 + oilAdd * oilSg) / (v1 + oilAdd);
  const oilVol = (v1 * oilPctOfMud) / 100;
  const waterVol = (oilVol * (100 - startOwrOilPct)) / startOwrOilPct;
  const owr = resultantOwr(oilVol + oilAdd, waterVol);
  return { newDensity, ...owr };
}

/** Suspected Water contamination of oil mud (density dropped d1 → d2). */
export function waterContamination(
  d1: number,
  d2: number,
  v1: number,
  startOwrOilPct: number,
  oilPctOfMud: number,
): { waterVolume: number; oilPct: number; waterPct: number } {
  const waterVolume = (v1 * (d2 - d1)) / (WATER_SG - d2);
  const oilVol = (v1 * oilPctOfMud) / 100;
  const waterVol = (oilVol * (100 - startOwrOilPct)) / startOwrOilPct;
  const owr = resultantOwr(oilVol, waterVol + waterVolume);
  return { waterVolume, ...owr };
}

/** Mix Water based Mud: water + barite to a target density. */
export function mixWaterMud(
  vMud: number,
  dMud: number,
  agentSg: number,
): { waterVolume: number; bariteVolume: number } {
  const bariteVolume = (vMud * (dMud - WATER_SG)) / (agentSg - WATER_SG);
  return { waterVolume: vMud - bariteVolume, bariteVolume };
}

/** Mix Oil based Mud: oil + water + barite to a target density and OWR. */
export function mixOilMud(
  dMud: number,
  vMud: number,
  oilPct: number,
  agentSg: number,
  oilSg: number,
): { waterVolume: number; oilVolume: number; bariteVolume: number } {
  const f = oilPct / 100;
  const liquidSg = f * oilSg + (1 - f) * WATER_SG;
  const bariteVolume = (vMud * (dMud - liquidSg)) / (agentSg - liquidSg);
  const liquidVol = vMud - bariteVolume;
  return {
    oilVolume: liquidVol * f,
    waterVolume: liquidVol * (1 - f),
    bariteVolume,
  };
}

/** Slug Displacement: estimated flowback of mud after pumping a heavier slug. */
export function slugFlowback(dMud: number, dSlug: number, vSlug: number): number {
  return (vSlug * (dSlug - dMud)) / dMud;
}
