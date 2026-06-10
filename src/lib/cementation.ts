/**
 * Primary casing cementation calculators.
 *
 * Conventional single-stage job (bottom + top plug):
 *  - Slurry = rathole + open-hole annulus (with excess) + cased annulus
 *             (above previous shoe up to TOC) + shoe track
 *  - Displacement = casing capacity x float collar depth (bump the top plug)
 *  - Lift (differential) pressure at bump = 0.052*(slurry - mud)*(FC - TOC)
 *    (vertical-well approximation: MD = TVD)
 *
 * Stab-in (inner string) job:
 *  - Cement pumped through drill pipe stabbed into the float collar/shoe
 *  - Slurry = rathole + open-hole annulus (with excess) + cased annulus + shoe track
 *  - Displacement = drill-pipe capacity x stab-in depth
 */
import {
  FT3_PER_BBL,
  GAL_PER_BBL,
  PSI_PER_FT_PER_PPG,
  annularCapacityBblFt,
  pipeCapacityBblFt,
} from "./units";

export interface VolumeBreakdownRow {
  name: string;
  lengthFt: number;
  capacityBblFt: number;
  excessPct: number;
  volumeBbl: number;
}

export interface CementJobResult {
  breakdown: VolumeBreakdownRow[];
  slurryVolumeBbl: number;
  slurryVolumeFt3: number;
  sacks: number;
  mixWaterGal?: number;
  mixWaterBbl?: number;
  displacementBbl: number;
  displacementStrokes?: number;
  liftPressurePsi?: number;
  warnings: string[];
}

export interface ConventionalCementInput {
  casingOdIn: number;
  casingIdIn: number;
  /** Casing shoe MD, ft */
  shoeMd: number;
  /** Open hole (bit) diameter, in */
  openHoleIdIn: number;
  /** Previous casing ID, in */
  prevCasingIdIn: number;
  /** Previous casing shoe MD, ft */
  prevShoeMd: number;
  /** Hole TD, ft (>= shoe MD; rathole below the shoe is filled with cement) */
  holeTdMd?: number;
  /** Planned top of cement MD, ft */
  tocMd: number;
  /** Float collar MD, ft (shoe track = shoe - float collar) */
  floatCollarMd: number;
  excessOpenHolePct?: number;
  slurryYieldFt3Sk: number;
  mixWaterGalSk?: number;
  slurryPpg?: number;
  mudPpg?: number;
  pumpOutputBblStk?: number;
}

function buildJob(
  breakdown: VolumeBreakdownRow[],
  yieldFt3Sk: number,
  mixWaterGalSk: number | undefined,
  displacementBbl: number,
  pumpOutputBblStk: number | undefined,
  liftPressurePsi: number | undefined,
  warnings: string[],
): CementJobResult {
  const slurryVolumeBbl = breakdown.reduce((s, r) => s + r.volumeBbl, 0);
  const slurryVolumeFt3 = slurryVolumeBbl * FT3_PER_BBL;
  const sacks = slurryVolumeFt3 / yieldFt3Sk;
  const mixWaterGal = mixWaterGalSk !== undefined ? sacks * mixWaterGalSk : undefined;
  return {
    breakdown,
    slurryVolumeBbl,
    slurryVolumeFt3,
    sacks,
    mixWaterGal,
    mixWaterBbl: mixWaterGal !== undefined ? mixWaterGal / GAL_PER_BBL : undefined,
    displacementBbl,
    displacementStrokes:
      pumpOutputBblStk && pumpOutputBblStk > 0 ? displacementBbl / pumpOutputBblStk : undefined,
    liftPressurePsi,
    warnings,
  };
}

function annulusBreakdown(
  input: Pick<
    ConventionalCementInput,
    | "casingOdIn"
    | "openHoleIdIn"
    | "prevCasingIdIn"
    | "prevShoeMd"
    | "shoeMd"
    | "holeTdMd"
    | "tocMd"
    | "excessOpenHolePct"
  >,
  warnings: string[],
): VolumeBreakdownRow[] {
  const rows: VolumeBreakdownRow[] = [];
  const excess = input.excessOpenHolePct ?? 0;
  const holeTd = input.holeTdMd ?? input.shoeMd;

  if (holeTd < input.shoeMd) warnings.push("Hole TD is above the casing shoe — rathole ignored.");
  if (input.tocMd >= input.shoeMd) warnings.push("TOC is at/below the shoe — no annular cement column.");
  if (input.prevShoeMd >= input.shoeMd) {
    warnings.push("Previous shoe is at/below the new shoe — check casing depths.");
  }

  // Rathole below the shoe (no casing): full hole capacity
  if (holeTd > input.shoeMd) {
    const cap = pipeCapacityBblFt(input.openHoleIdIn);
    const len = holeTd - input.shoeMd;
    rows.push({
      name: "Rathole below shoe",
      lengthFt: len,
      capacityBblFt: cap,
      excessPct: excess,
      volumeBbl: len * cap * (1 + excess / 100),
    });
  }

  // Open-hole annulus: shoe up to previous shoe (or TOC if TOC is in open hole)
  const ohTop = Math.max(input.prevShoeMd, input.tocMd);
  if (input.shoeMd > ohTop) {
    const cap = annularCapacityBblFt(input.openHoleIdIn, input.casingOdIn);
    const len = input.shoeMd - ohTop;
    rows.push({
      name: "Open-hole annulus",
      lengthFt: len,
      capacityBblFt: cap,
      excessPct: excess,
      volumeBbl: len * cap * (1 + excess / 100),
    });
  }

  // Cased annulus: previous shoe up to TOC (no excess inside casing)
  if (input.tocMd < input.prevShoeMd) {
    const cap = annularCapacityBblFt(input.prevCasingIdIn, input.casingOdIn);
    const len = input.prevShoeMd - input.tocMd;
    rows.push({
      name: "Cased annulus",
      lengthFt: len,
      capacityBblFt: cap,
      excessPct: 0,
      volumeBbl: len * cap,
    });
  }
  return rows;
}

export function computeConventionalCementation(
  input: ConventionalCementInput,
): CementJobResult {
  const warnings: string[] = [];
  if (input.floatCollarMd >= input.shoeMd) {
    warnings.push("Float collar is at/below the shoe — shoe track length is zero.");
  }

  const rows = annulusBreakdown(input, warnings);

  // Shoe track inside the casing (float collar to shoe)
  const casingCap = pipeCapacityBblFt(input.casingIdIn);
  const shoeTrackLen = Math.max(0, input.shoeMd - input.floatCollarMd);
  if (shoeTrackLen > 0) {
    rows.push({
      name: "Shoe track (FC to shoe)",
      lengthFt: shoeTrackLen,
      capacityBblFt: casingCap,
      excessPct: 0,
      volumeBbl: shoeTrackLen * casingCap,
    });
  }

  // Displacement: pump the top plug down to the float collar
  const displacementBbl = casingCap * input.floatCollarMd;

  let liftPressurePsi: number | undefined;
  if (input.slurryPpg && input.mudPpg) {
    liftPressurePsi =
      PSI_PER_FT_PER_PPG *
      (input.slurryPpg - input.mudPpg) *
      Math.max(0, input.floatCollarMd - input.tocMd);
    warnings.push(
      "Lift pressure assumes a vertical well (MD = TVD) and single slurry density.",
    );
  }

  return buildJob(
    rows,
    input.slurryYieldFt3Sk,
    input.mixWaterGalSk,
    displacementBbl,
    input.pumpOutputBblStk,
    liftPressurePsi,
    warnings,
  );
}

export interface StabInCementInput {
  casingOdIn: number;
  casingIdIn: number;
  shoeMd: number;
  /** Stab-in float collar MD, ft */
  floatCollarMd: number;
  openHoleIdIn: number;
  prevCasingIdIn: number;
  prevShoeMd: number;
  holeTdMd?: number;
  tocMd: number;
  /** Drill pipe ID for the inner string, in */
  dpIdIn: number;
  excessOpenHolePct?: number;
  slurryYieldFt3Sk: number;
  mixWaterGalSk?: number;
  pumpOutputBblStk?: number;
}

export function computeStabInCementation(input: StabInCementInput): CementJobResult {
  const warnings: string[] = [
    "Stab-in job: watch annulus returns — stop mixing on cement to surface if TOC is surface.",
  ];
  const rows = annulusBreakdown(input, warnings);

  const casingCap = pipeCapacityBblFt(input.casingIdIn);
  const shoeTrackLen = Math.max(0, input.shoeMd - input.floatCollarMd);
  if (shoeTrackLen > 0) {
    rows.push({
      name: "Shoe track (FC to shoe)",
      lengthFt: shoeTrackLen,
      capacityBblFt: casingCap,
      excessPct: 0,
      volumeBbl: shoeTrackLen * casingCap,
    });
  }

  // Displacement: drill pipe capacity down to the stab-in point
  const displacementBbl = pipeCapacityBblFt(input.dpIdIn) * input.floatCollarMd;

  return buildJob(
    rows,
    input.slurryYieldFt3Sk,
    input.mixWaterGalSk,
    displacementBbl,
    input.pumpOutputBblStk,
    undefined,
    warnings,
  );
}
