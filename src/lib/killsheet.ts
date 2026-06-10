/**
 * Kill sheet (Driller's method / Wait & Weight surface data).
 *
 * Standard API field formulas:
 *  - Kill mud weight  KMW = OMW + SIDPP / (0.052 * TVD)         [rounded UP to 0.1 ppg]
 *  - ICP              = SIDPP + SCRP (slow circ rate pressure)
 *  - FCP              = SCRP * KMW / OMW
 *  - MAASP            = (LOT EMW - mud in hole) * 0.052 * shoe TVD
 *  - Influx gradient  = mud gradient - (SICP - SIDPP) / influx height
 *
 * Directional wells: all VOLUMES/STROKES use measured depth (lengths along
 * hole), while all PRESSURES use true vertical depth. In a vertical well
 * MD = TVD, so the MD inputs are hidden and TVD is used for both.
 */
import { PSI_PER_FT_PER_PPG, roundTo, roundUpTo } from "./units";

export interface KillSheetInput {
  directional: boolean;
  /** True vertical depth of the hole, ft */
  tvdFt: number;
  /** Measured depth of the hole, ft (directional only; defaults to TVD) */
  mdFt?: number;
  /** Casing shoe TVD, ft */
  shoeTvdFt: number;
  /** Casing shoe MD, ft (directional only; defaults to shoe TVD) */
  shoeMdFt?: number;
  currentMudPpg: number;
  sidppPsi: number;
  sicpPsi: number;
  pitGainBbl?: number;
  /** Slow circulating rate pressure at the kill rate, psi */
  scrPsi: number;
  /** Kill rate, strokes per minute (optional, enables time estimates) */
  scrSpm?: number;
  /** Pump output, bbl/stk */
  pumpOutputBblStk: number;
  /** Leak-off / FIT equivalent mud weight at the shoe, ppg */
  lotEmwPpg?: number;
  /** Drill string internal volume, bbl (from well config or manual) */
  drillStringVolumeBbl: number;
  /** Annular volume in open hole (around BHA/DP below the shoe), bbl */
  annulusOpenHoleBbl: number;
  /** Annular volume inside casing, bbl */
  annulusCasedBbl: number;
  /** Annular capacity around the BHA, bbl/ft (for influx height) */
  bhaAnnularCapacityBblFt?: number;
  /** Number of rows in the pressure step-down schedule (default 10) */
  scheduleSteps?: number;
}

export interface ScheduleRow {
  strokes: number;
  volumeBbl: number;
  pressurePsi: number;
  timeMin?: number;
}

export interface KillSheetResult {
  killMudPpg: number;
  killMudExactPpg: number;
  initialCirculatingPressurePsi: number;
  finalCirculatingPressurePsi: number;
  /** MAASP with current mud in the annulus */
  maaspInitialPsi?: number;
  /** MAASP once kill mud fills the annulus */
  maaspKillMudPsi?: number;
  surfaceToBitStrokes: number;
  bitToShoeStrokes: number;
  shoeToSurfaceStrokes: number;
  bitToSurfaceStrokes: number;
  totalStrokes: number;
  surfaceToBitMin?: number;
  bitToSurfaceMin?: number;
  totalMin?: number;
  /** Hydrostatic pressure increase from kill mud at TD, psi */
  killMudHydrostaticGainPsi: number;
  influxHeightFt?: number;
  influxGradientPsiFt?: number;
  influxType?: "gas" | "oil / gas-cut mud" | "water" | "unknown";
  schedule: ScheduleRow[];
  warnings: string[];
}

export function computeKillSheet(input: KillSheetInput): KillSheetResult {
  const warnings: string[] = [];
  const md = input.directional ? (input.mdFt ?? input.tvdFt) : input.tvdFt;
  if (input.directional && input.mdFt !== undefined && input.mdFt < input.tvdFt) {
    warnings.push("MD is less than TVD — check depth inputs.");
  }
  if (!input.directional && input.mdFt !== undefined && input.mdFt !== input.tvdFt) {
    warnings.push("Vertical well: MD input ignored (MD = TVD).");
  }
  void md;

  const gradient = PSI_PER_FT_PER_PPG * input.currentMudPpg;

  const killMudExactPpg =
    input.currentMudPpg + input.sidppPsi / (PSI_PER_FT_PER_PPG * input.tvdFt);
  const killMudPpg = roundTo(roundUpTo(killMudExactPpg, 0.1), 2);

  const icp = input.sidppPsi + input.scrPsi;
  const fcp = (input.scrPsi * killMudPpg) / input.currentMudPpg;

  let maaspInitialPsi: number | undefined;
  let maaspKillMudPsi: number | undefined;
  if (input.lotEmwPpg && input.lotEmwPpg > 0) {
    maaspInitialPsi =
      (input.lotEmwPpg - input.currentMudPpg) * PSI_PER_FT_PER_PPG * input.shoeTvdFt;
    maaspKillMudPsi =
      (input.lotEmwPpg - killMudPpg) * PSI_PER_FT_PER_PPG * input.shoeTvdFt;
    if (maaspKillMudPsi < 0) {
      warnings.push(
        "Kill mud EMW exceeds shoe LOT/FIT — the shoe may break down while circulating kill mud.",
      );
    }
    if (input.sicpPsi > maaspInitialPsi) {
      warnings.push("SICP exceeds initial MAASP — risk of formation breakdown at the shoe.");
    }
  }

  const out = input.pumpOutputBblStk;
  const surfaceToBitStrokes = input.drillStringVolumeBbl / out;
  const bitToShoeStrokes = input.annulusOpenHoleBbl / out;
  const shoeToSurfaceStrokes = input.annulusCasedBbl / out;
  const bitToSurfaceStrokes = bitToShoeStrokes + shoeToSurfaceStrokes;
  const totalStrokes = surfaceToBitStrokes + bitToSurfaceStrokes;

  const spm = input.scrSpm;
  const surfaceToBitMin = spm ? surfaceToBitStrokes / spm : undefined;
  const bitToSurfaceMin = spm ? bitToSurfaceStrokes / spm : undefined;
  const totalMin = spm ? totalStrokes / spm : undefined;

  // Influx characterization
  let influxHeightFt: number | undefined;
  let influxGradientPsiFt: number | undefined;
  let influxType: KillSheetResult["influxType"];
  if (input.pitGainBbl && input.bhaAnnularCapacityBblFt && input.bhaAnnularCapacityBblFt > 0) {
    influxHeightFt = input.pitGainBbl / input.bhaAnnularCapacityBblFt;
    influxGradientPsiFt = gradient - (input.sicpPsi - input.sidppPsi) / influxHeightFt;
    if (influxGradientPsiFt < 0) {
      influxType = "unknown";
      warnings.push(
        "Computed influx gradient is negative — check SIDPP, SICP and pit gain inputs.",
      );
    } else if (influxGradientPsiFt < 0.25) influxType = "gas";
    else if (influxGradientPsiFt < 0.4) influxType = "oil / gas-cut mud";
    else if (influxGradientPsiFt <= 0.5) influxType = "water";
    else influxType = "unknown";
  }

  // Pressure step-down schedule: ICP -> FCP linearly over surface-to-bit strokes
  const steps = Math.max(2, input.scheduleSteps ?? 10);
  const schedule: ScheduleRow[] = [];
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    const strokes = surfaceToBitStrokes * frac;
    schedule.push({
      strokes: Math.round(strokes),
      volumeBbl: strokes * out,
      pressurePsi: icp - (icp - fcp) * frac,
      timeMin: spm ? strokes / spm : undefined,
    });
  }
  if (input.directional) {
    warnings.push(
      "Directional well: the linear strokes schedule is the standard kill-sheet approximation. " +
        "For long tangent/horizontal sections, pressures fall with TVD of the kill mud front, not MD — " +
        "the linear schedule is conservative in the build section.",
    );
  }

  return {
    killMudPpg,
    killMudExactPpg,
    initialCirculatingPressurePsi: icp,
    finalCirculatingPressurePsi: fcp,
    maaspInitialPsi,
    maaspKillMudPsi,
    surfaceToBitStrokes,
    bitToShoeStrokes,
    shoeToSurfaceStrokes,
    bitToSurfaceStrokes,
    totalStrokes,
    surfaceToBitMin,
    bitToSurfaceMin,
    totalMin,
    killMudHydrostaticGainPsi:
      (killMudPpg - input.currentMudPpg) * PSI_PER_FT_PER_PPG * input.tvdFt,
    influxHeightFt,
    influxGradientPsiFt,
    influxType,
    schedule,
    warnings,
  };
}
