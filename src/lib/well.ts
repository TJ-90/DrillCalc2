/**
 * Well geometry: drill string components, hole/casing sections, and
 * volume/weight calculations used by the kill sheet, hydraulics and
 * cementing calculators.
 */
import {
  annularCapacityBblFt,
  buoyancyFactor,
  pipeCapacityBblFt,
  pipeDisplacementBblFt,
} from "./units";

export interface StringComponent {
  /** e.g. `5" DP 19.5 ppf` */
  name: string;
  odIn: number;
  idIn: number;
  weightPpf: number;
  lengthFt: number;
}

export interface HoleSection {
  /** e.g. `9-5/8" 47# casing` or `8-1/2" open hole` */
  name: string;
  /** Casing/liner ID, or open-hole (bit) diameter, inches */
  idIn: number;
  /** Measured depth of the bottom of this section, ft (sections ordered from surface down) */
  bottomMd: number;
  cased: boolean;
}

export interface AnnulusSegment {
  topMd: number;
  bottomMd: number;
  lengthFt: number;
  holeIdIn: number;
  holeName: string;
  /** 0 when no pipe crosses this segment (e.g. rathole below the bit) */
  pipeOdIn: number;
  pipeName: string;
  cased: boolean;
  capacityBblFt: number;
  volumeBbl: number;
}

/** Measured depth of the bottom of the string (bit), ft */
export function stringBottomMd(components: StringComponent[]): number {
  return components.reduce((s, c) => s + c.lengthFt, 0);
}

/** Total internal volume of the string, bbl */
export function stringCapacityBbl(components: StringComponent[]): number {
  return components.reduce((s, c) => s + pipeCapacityBblFt(c.idIn) * c.lengthFt, 0);
}

/** Total steel displacement of the string, bbl */
export function stringDisplacementBbl(components: StringComponent[]): number {
  return components.reduce(
    (s, c) => s + pipeDisplacementBblFt(c.odIn, c.idIn) * c.lengthFt,
    0,
  );
}

/** Air weight of the string, lbs */
export function stringAirWeightLbs(components: StringComponent[]): number {
  return components.reduce((s, c) => s + c.weightPpf * c.lengthFt, 0);
}

/** Buoyed weight of the string in mud, lbs */
export function stringBuoyedWeightLbs(
  components: StringComponent[],
  mudPpg: number,
): number {
  return stringAirWeightLbs(components) * buoyancyFactor(mudPpg);
}

/**
 * Build annular segments from surface to the deepest hole section, pairing
 * the pipe present at each depth with the hole/casing around it. Depths below
 * the bottom of the string become open-ended (no-pipe) segments.
 *
 * String components are positioned from surface down in array order.
 */
export function annulusSegments(
  components: StringComponent[],
  holes: HoleSection[],
): AnnulusSegment[] {
  if (holes.length === 0) return [];

  const sortedHoles = [...holes].sort((a, b) => a.bottomMd - b.bottomMd);
  const td = sortedHoles[sortedHoles.length - 1].bottomMd;

  // Cumulative pipe intervals from surface
  const pipeIntervals: { top: number; bottom: number; c: StringComponent }[] = [];
  let depth = 0;
  for (const c of components) {
    pipeIntervals.push({ top: depth, bottom: depth + c.lengthFt, c });
    depth += c.lengthFt;
  }

  const breaks = new Set<number>([0, td]);
  for (const p of pipeIntervals) {
    if (p.top < td) breaks.add(p.top);
    if (p.bottom < td) breaks.add(p.bottom);
  }
  for (const h of sortedHoles) {
    if (h.bottomMd < td) breaks.add(h.bottomMd);
  }
  const pts = [...breaks].sort((a, b) => a - b);

  const segments: AnnulusSegment[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const top = pts[i];
    const bottom = pts[i + 1];
    if (bottom - top <= 0) continue;
    const mid = (top + bottom) / 2;
    const hole = sortedHoles.find((h) => mid < h.bottomMd) ?? sortedHoles[sortedHoles.length - 1];
    const pipe = pipeIntervals.find((p) => mid >= p.top && mid < p.bottom);
    const cap = pipe
      ? annularCapacityBblFt(hole.idIn, pipe.c.odIn)
      : pipeCapacityBblFt(hole.idIn); // full hole, no pipe
    segments.push({
      topMd: top,
      bottomMd: bottom,
      lengthFt: bottom - top,
      holeIdIn: hole.idIn,
      holeName: hole.name,
      pipeOdIn: pipe ? pipe.c.odIn : 0,
      pipeName: pipe ? pipe.c.name : "(no pipe)",
      cased: hole.cased,
      capacityBblFt: cap,
      volumeBbl: cap * (bottom - top),
    });
  }
  return segments;
}

export function annulusVolumeBbl(segments: AnnulusSegment[]): number {
  return segments.reduce((s, x) => s + x.volumeBbl, 0);
}

/** Annular volume split for the kill sheet: open hole vs inside casing (pipe present only) */
export function annulusVolumeSplit(segments: AnnulusSegment[]): {
  openHoleBbl: number;
  casedBbl: number;
  noPipeBbl: number;
} {
  let openHoleBbl = 0;
  let casedBbl = 0;
  let noPipeBbl = 0;
  for (const s of segments) {
    if (s.pipeOdIn === 0) noPipeBbl += s.volumeBbl;
    else if (s.cased) casedBbl += s.volumeBbl;
    else openHoleBbl += s.volumeBbl;
  }
  return { openHoleBbl, casedBbl, noPipeBbl };
}
