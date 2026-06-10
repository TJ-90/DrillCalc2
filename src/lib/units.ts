/**
 * Oilfield unit helpers and constants.
 *
 * Units used throughout the engine (API field units):
 *  - depth/length: ft
 *  - diameter: in
 *  - mud weight/density: ppg
 *  - pressure: psi
 *  - volume: bbl
 *  - flow rate: gpm
 *  - weight: lbs
 */

export const PSI_PER_FT_PER_PPG = 0.052;
/** Capacity (bbl/ft) = d(in)^2 / 1029.4 */
export const CAPACITY_DIVISOR = 1029.4;
export const FT3_PER_BBL = 5.6146;
export const GAL_PER_BBL = 42;
/** Fresh water density, ppg */
export const WATER_PPG = 8.34;
/** API barite (SG 4.20) density expressed in ppg */
export const BARITE_PPG = 35.0;
/** Steel density in ppg, used for the buoyancy factor */
export const STEEL_PPG = 65.4;

export function hydrostaticPsi(ppg: number, tvdFt: number): number {
  return PSI_PER_FT_PER_PPG * ppg * tvdFt;
}

/** Equivalent mud weight (ppg) of a pressure at a TVD */
export function emwPpg(pressurePsi: number, tvdFt: number): number {
  return tvdFt > 0 ? pressurePsi / (PSI_PER_FT_PER_PPG * tvdFt) : 0;
}

/** Buoyancy factor BF = (65.4 - MW) / 65.4 */
export function buoyancyFactor(mudPpg: number): number {
  return (STEEL_PPG - mudPpg) / STEEL_PPG;
}

/** Internal capacity of a pipe, bbl/ft */
export function pipeCapacityBblFt(idIn: number): number {
  return (idIn * idIn) / CAPACITY_DIVISOR;
}

/** Annular capacity between a hole/casing ID and a pipe OD, bbl/ft */
export function annularCapacityBblFt(holeIdIn: number, pipeOdIn: number): number {
  return (holeIdIn * holeIdIn - pipeOdIn * pipeOdIn) / CAPACITY_DIVISOR;
}

/** Steel (open-ended) displacement of a pipe, bbl/ft */
export function pipeDisplacementBblFt(odIn: number, idIn: number): number {
  return (odIn * odIn - idIn * idIn) / CAPACITY_DIVISOR;
}

export function sgToPpg(sg: number): number {
  return sg * 8.345;
}

export function ppgToSg(ppg: number): number {
  return ppg / 8.345;
}

export function roundTo(x: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

/** Round up to the nearest step (e.g. kill mud weight to the next 0.1 ppg) */
export function roundUpTo(x: number, step = 0.1): number {
  return Math.ceil(x / step - 1e-9) * step;
}
