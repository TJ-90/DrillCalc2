/**
 * Balanced cement plug calculator (Lapeyrouse method), generalized to a
 * two-zone geometry so it covers all four cases:
 *
 *  1. "open-hole"     — plug entirely in open hole (single zone)
 *  2. "cased-hole"    — plug entirely inside casing (single zone)
 *  3. "across-shoe"   — plug straddles the casing shoe (open hole below,
 *                       casing above; crossover = shoe MD)
 *  4. "liner-overlap" — plug straddles a liner top (liner ID below,
 *                       host casing ID above; crossover = liner top MD)
 *
 * Method:
 *  - Sacks from the FINAL plug length (pipe pulled out of the plug):
 *      V = SUM over zones [ length * full-hole capacity * (1 + excess) ]
 *  - Wet plug length with the stinger still in the hole fills
 *      (annular capacity + stinger capacity) per ft, from the base up.
 *  - Spacer behind (in the pipe) balances the spacer ahead:
 *      V_behind = V_ahead * pipe capacity / annular capacity (at slurry top)
 *  - Displacement = pipe volume from surface to the balanced cement level
 *      inside the string, minus the spacer behind.
 */
import {
  FT3_PER_BBL,
  annularCapacityBblFt,
  pipeCapacityBblFt,
} from "./units";

export type PlugCase = "open-hole" | "cased-hole" | "across-shoe" | "liner-overlap";

export interface BalancedPlugInput {
  plugCase: PlugCase;
  /** MD of the bottom of the plug, ft */
  plugBaseMd: number;
  /** Desired final plug length (after pulling the stinger), ft */
  plugLengthFt: number;
  /** Hole/casing/liner ID at the plug base, in */
  lowerIdIn: number;
  /** ID above the crossover (casing above shoe, or host casing above liner top), in */
  upperIdIn?: number;
  /** Crossover MD: casing shoe MD or liner top MD, ft */
  crossoverMd?: number;
  stingerOdIn: number;
  stingerIdIn: number;
  /** Length of the stinger/tubing at the bottom of the string, ft (optional) */
  stingerLengthFt?: number;
  /** ID of the pipe above the stinger (drill pipe), in (optional) */
  upperPipeIdIn?: number;
  slurryYieldFt3Sk: number;
  mixWaterGalSk?: number;
  /** Excess on the lower zone, % (typically open hole) */
  excessLowerPct?: number;
  /** Excess on the upper zone, % */
  excessUpperPct?: number;
  spacerAheadBbl?: number;
  pumpOutputBblStk?: number;
}

export interface PlugZoneBreakdown {
  name: string;
  lengthFt: number;
  holeCapacityBblFt: number;
  excessPct: number;
  volumeBbl: number;
}

export interface BalancedPlugResult {
  zones: PlugZoneBreakdown[];
  slurryVolumeBbl: number;
  slurryVolumeFt3: number;
  sacks: number;
  mixWaterGal?: number;
  mixWaterBbl?: number;
  /** Plug length while the stinger is still in the hole, ft */
  wetPlugLengthFt: number;
  /** Top of cement with the pipe in the hole, MD ft */
  tocWithPipeMd: number;
  /** Top of cement after pulling the pipe (the designed plug top), MD ft */
  tocFinalMd: number;
  spacerAheadBbl: number;
  spacerAheadAnnulusHeightFt: number;
  spacerBehindBbl: number;
  displacementBbl: number;
  displacementStrokes?: number;
  warnings: string[];
}

interface Zone {
  name: string;
  idIn: number;
  /** Height available in this zone measured from the plug base upward, ft (Infinity for topmost) */
  availableFt: number;
  excessPct: number;
}

export function computeBalancedPlug(input: BalancedPlugInput): BalancedPlugResult {
  const warnings: string[] = [];
  const twoZone = input.plugCase === "across-shoe" || input.plugCase === "liner-overlap";

  if (twoZone) {
    if (!input.upperIdIn || !input.crossoverMd) {
      throw new Error("Across-shoe / liner-overlap cases need the upper ID and the crossover depth");
    }
    if (input.crossoverMd >= input.plugBaseMd) {
      throw new Error("Crossover depth must be above the plug base");
    }
    if (input.plugBaseMd - input.crossoverMd >= input.plugLengthFt) {
      warnings.push(
        "The plug does not reach the crossover depth — it sits entirely in the lower section. " +
          "Result is computed as a single-section plug.",
      );
    }
  }

  const lowerName =
    input.plugCase === "cased-hole"
      ? "cased hole"
      : input.plugCase === "liner-overlap"
        ? "inside liner"
        : "open hole";
  const upperName = input.plugCase === "liner-overlap" ? "host casing" : "cased hole";

  const zones: Zone[] = twoZone
    ? [
        {
          name: lowerName,
          idIn: input.lowerIdIn,
          availableFt: input.plugBaseMd - (input.crossoverMd as number),
          excessPct: input.excessLowerPct ?? 0,
        },
        {
          name: upperName,
          idIn: input.upperIdIn as number,
          availableFt: Infinity,
          excessPct: input.excessUpperPct ?? 0,
        },
      ]
    : [
        {
          name: lowerName,
          idIn: input.lowerIdIn,
          availableFt: Infinity,
          excessPct: input.excessLowerPct ?? 0,
        },
      ];

  // ---- Slurry volume from the FINAL plug interval (pipe out)
  const breakdown: PlugZoneBreakdown[] = [];
  let remainingLen = input.plugLengthFt;
  let slurryVolumeBbl = 0;
  for (const z of zones) {
    if (remainingLen <= 0) break;
    const len = Math.min(remainingLen, z.availableFt);
    const cap = pipeCapacityBblFt(z.idIn); // full hole capacity
    const vol = len * cap * (1 + z.excessPct / 100);
    breakdown.push({
      name: z.name,
      lengthFt: len,
      holeCapacityBblFt: cap,
      excessPct: z.excessPct,
      volumeBbl: vol,
    });
    slurryVolumeBbl += vol;
    remainingLen -= len;
  }

  const slurryVolumeFt3 = slurryVolumeBbl * FT3_PER_BBL;
  const sacks = slurryVolumeFt3 / input.slurryYieldFt3Sk;
  const mixWaterGal = input.mixWaterGalSk !== undefined ? sacks * input.mixWaterGalSk : undefined;

  // ---- Wet plug length with the stinger in the hole
  const stingerCap = pipeCapacityBblFt(input.stingerIdIn);
  let volLeft = slurryVolumeBbl;
  let wetPlugLengthFt = 0;
  for (const z of zones) {
    if (volLeft <= 1e-12) break;
    if (z.idIn <= input.stingerOdIn) {
      throw new Error(`Stinger OD (${input.stingerOdIn}") does not fit in the ${z.name} ID (${z.idIn}")`);
    }
    const fillCap = annularCapacityBblFt(z.idIn, input.stingerOdIn) + stingerCap;
    const zoneVolume = z.availableFt === Infinity ? Infinity : fillCap * z.availableFt;
    const v = Math.min(volLeft, zoneVolume);
    wetPlugLengthFt += v / fillCap;
    volLeft -= v;
  }
  const tocWithPipeMd = input.plugBaseMd - wetPlugLengthFt;
  const tocFinalMd = input.plugBaseMd - input.plugLengthFt;

  if (input.stingerLengthFt !== undefined && wetPlugLengthFt > input.stingerLengthFt) {
    warnings.push(
      `Wet plug length (${wetPlugLengthFt.toFixed(0)} ft) is longer than the stinger ` +
        `(${input.stingerLengthFt.toFixed(0)} ft) — cement will be around the drill pipe above the stinger. ` +
        "Consider a longer stinger or shorter plug.",
    );
  }

  // ---- Spacer balance (uses annular capacity at the top of the slurry)
  const topZone =
    twoZone && wetPlugLengthFt > (zones[0].availableFt as number) ? zones[1] : zones[0];
  const annCapTop = annularCapacityBblFt(topZone.idIn, input.stingerOdIn);
  const spacerAheadBbl = input.spacerAheadBbl ?? 0;
  const spacerAheadAnnulusHeightFt = spacerAheadBbl > 0 ? spacerAheadBbl / annCapTop : 0;
  const spacerBehindBbl = spacerAheadBbl > 0 ? (spacerAheadBbl * stingerCap) / annCapTop : 0;

  // ---- Displacement: pipe volume from surface down to the balanced level
  const balancedLevelMd = tocWithPipeMd; // equal heights inside and outside
  let pipeVolumeToLevel: number;
  if (
    input.stingerLengthFt !== undefined &&
    input.upperPipeIdIn !== undefined &&
    input.stingerLengthFt < input.plugBaseMd
  ) {
    const stingerTopMd = input.plugBaseMd - input.stingerLengthFt;
    const dpCap = pipeCapacityBblFt(input.upperPipeIdIn);
    if (balancedLevelMd >= stingerTopMd) {
      pipeVolumeToLevel = dpCap * stingerTopMd + stingerCap * (balancedLevelMd - stingerTopMd);
    } else {
      pipeVolumeToLevel = dpCap * balancedLevelMd;
    }
  } else {
    pipeVolumeToLevel = stingerCap * balancedLevelMd;
  }
  const displacementBbl = pipeVolumeToLevel - spacerBehindBbl;

  return {
    zones: breakdown,
    slurryVolumeBbl,
    slurryVolumeFt3,
    sacks,
    mixWaterGal,
    mixWaterBbl: mixWaterGal !== undefined ? mixWaterGal / 42 : undefined,
    wetPlugLengthFt,
    tocWithPipeMd,
    tocFinalMd,
    spacerAheadBbl,
    spacerAheadAnnulusHeightFt,
    spacerBehindBbl,
    displacementBbl,
    displacementStrokes:
      input.pumpOutputBblStk && input.pumpOutputBblStk > 0
        ? displacementBbl / input.pumpOutputBblStk
        : undefined,
    warnings,
  };
}
