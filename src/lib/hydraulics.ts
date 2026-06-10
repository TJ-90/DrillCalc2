/**
 * Mud hydraulics — system pressure losses and expected pump pressure,
 * Bingham plastic model in API field units (Amoco / Lapeyrouse equations).
 *
 *  Pipe velocity (ft/s)     v = Q / (2.448 * d^2)
 *  Annular velocity (ft/s)  v = Q / (2.448 * (d2^2 - d1^2))
 *
 *  Pipe:    mu_e = PV + 6.66 * YP * d / v,  Re = 928 * rho * v * d / mu_e
 *  Annulus: mu_e = PV + 5 * YP * (d2-d1) / v,  Re = 757 * rho * v * (d2-d1) / mu_e
 *  Laminar if Re < 2100.
 *
 *  Pipe laminar:    dP = PV*L*v/(1500*d^2) + YP*L/(225*d)
 *  Pipe turbulent:  dP = rho^0.75 * v^1.75 * PV^0.25 * L / (1800 * d^1.25)
 *  Ann. laminar:    dP = PV*L*v/(1000*(d2-d1)^2) + YP*L/(200*(d2-d1))
 *  Ann. turbulent:  dP = rho^0.75 * v^1.75 * PV^0.25 * L / (1396 * (d2-d1)^1.25)
 *
 *  Surface equipment: dP = E * rho^0.8 * Q^1.8 * PV^0.2
 *    (E: case 1 = 2.5e-4, case 2 = 9.6e-5, case 3 = 5.3e-5, case 4 = 4.2e-5)
 *
 *  ECD = MW + sum(annular losses) / (0.052 * TVD)
 */
import { bitPressureDropPsi, totalFlowAreaIn2 } from "./nozzles";
import { PSI_PER_FT_PER_PPG } from "./units";
import {
  HoleSection,
  StringComponent,
  annulusSegments,
  stringBottomMd,
} from "./well";

export const SURFACE_CASE_E: Record<number, number> = {
  1: 2.5e-4,
  2: 9.6e-5,
  3: 5.3e-5,
  4: 4.2e-5,
};

export interface SectionLoss {
  name: string;
  kind: "surface" | "pipe" | "annulus" | "bit";
  lengthFt?: number;
  velocityFtS?: number;
  velocityFtMin?: number;
  criticalVelocityFtS?: number;
  reynolds?: number;
  regime?: "laminar" | "turbulent";
  dPsi: number;
}

export interface HydraulicsInput {
  mudPpg: number;
  pvCp: number;
  ypLbf100ft2: number;
  gpm: number;
  string: StringComponent[];
  holes: HoleSection[];
  nozzles32nds?: number[];
  cd?: number;
  /** Surface equipment case 1–4 (omit for none) */
  surfaceCase?: 1 | 2 | 3 | 4;
  /** Direct surface-equipment loss override, psi */
  surfacePsiOverride?: number;
  /** TVD for ECD (defaults to string bottom MD — vertical assumption) */
  tvdFt?: number;
}

export interface HydraulicsResult {
  sections: SectionLoss[];
  surfacePsi: number;
  pipePsi: number;
  bitPsi: number;
  annulusPsi: number;
  totalPsi: number;
  ecdPpg?: number;
  /** Bottoms-up time at this rate, min */
  bottomsUpMin?: number;
  tfaIn2?: number;
  warnings: string[];
}

function pipeLoss(
  rho: number,
  pv: number,
  yp: number,
  q: number,
  d: number,
  L: number,
): Omit<SectionLoss, "name" | "kind"> {
  const v = q / (2.448 * d * d);
  if (v <= 0) return { dPsi: 0 };
  const mu = pv + (6.66 * yp * d) / v;
  const re = (928 * rho * v * d) / mu;
  const vc = (1.08 * pv + 1.08 * Math.sqrt(pv * pv + 12.34 * d * d * yp * rho)) / (rho * d);
  const laminar = re < 2100;
  const dPsi = laminar
    ? (pv * L * v) / (1500 * d * d) + (yp * L) / (225 * d)
    : (rho ** 0.75 * v ** 1.75 * pv ** 0.25 * L) / (1800 * d ** 1.25);
  return {
    lengthFt: L,
    velocityFtS: v,
    velocityFtMin: v * 60,
    criticalVelocityFtS: vc,
    reynolds: re,
    regime: laminar ? "laminar" : "turbulent",
    dPsi,
  };
}

function annulusLoss(
  rho: number,
  pv: number,
  yp: number,
  q: number,
  d2: number,
  d1: number,
  L: number,
): Omit<SectionLoss, "name" | "kind"> {
  const dh = d2 - d1;
  const v = q / (2.448 * (d2 * d2 - d1 * d1));
  if (v <= 0 || dh <= 0) return { dPsi: 0 };
  const mu = pv + (5 * yp * dh) / v;
  const re = (757 * rho * v * dh) / mu;
  const vc = (1.08 * pv + 1.08 * Math.sqrt(pv * pv + 9.26 * dh * dh * yp * rho)) / (rho * dh);
  const laminar = re < 2100;
  const dPsi = laminar
    ? (pv * L * v) / (1000 * dh * dh) + (yp * L) / (200 * dh)
    : (rho ** 0.75 * v ** 1.75 * pv ** 0.25 * L) / (1396 * dh ** 1.25);
  return {
    lengthFt: L,
    velocityFtS: v,
    velocityFtMin: v * 60,
    criticalVelocityFtS: vc,
    reynolds: re,
    regime: laminar ? "laminar" : "turbulent",
    dPsi,
  };
}

export function computeHydraulics(input: HydraulicsInput): HydraulicsResult {
  const warnings: string[] = [];
  const { mudPpg: rho, pvCp: pv, ypLbf100ft2: yp, gpm: q } = input;
  const sections: SectionLoss[] = [];

  if (q <= 0) throw new Error("Flow rate must be > 0");
  if (input.string.length === 0) warnings.push("No drill string components defined.");
  if (input.holes.length === 0) warnings.push("No hole/casing sections defined.");

  // Surface equipment
  let surfacePsi = 0;
  if (input.surfacePsiOverride !== undefined) {
    surfacePsi = input.surfacePsiOverride;
  } else if (input.surfaceCase) {
    surfacePsi = SURFACE_CASE_E[input.surfaceCase] * rho ** 0.8 * q ** 1.8 * pv ** 0.2;
  }
  if (surfacePsi > 0) {
    sections.push({ name: "Surface equipment", kind: "surface", dPsi: surfacePsi });
  }

  // String internal losses
  let pipePsi = 0;
  for (const c of input.string) {
    const r = pipeLoss(rho, pv, yp, q, c.idIn, c.lengthFt);
    pipePsi += r.dPsi;
    sections.push({ name: `Inside ${c.name}`, kind: "pipe", ...r });
  }

  // Bit
  let bitPsi = 0;
  let tfaIn2: number | undefined;
  if (input.nozzles32nds && input.nozzles32nds.length > 0) {
    tfaIn2 = totalFlowAreaIn2(input.nozzles32nds);
    bitPsi = bitPressureDropPsi(rho, q, tfaIn2, input.cd);
    sections.push({ name: "Bit nozzles", kind: "bit", dPsi: bitPsi });
  } else {
    warnings.push("No nozzles defined — bit pressure drop excluded.");
  }

  // Annulus losses (only where pipe is present — the flow path back up)
  const segs = annulusSegments(input.string, input.holes).filter((s) => s.pipeOdIn > 0);
  let annulusPsi = 0;
  let annulusVolumeBbl = 0;
  for (const s of segs) {
    if (s.pipeOdIn >= s.holeIdIn) {
      warnings.push(
        `Pipe OD ${s.pipeOdIn}" does not fit inside ${s.holeName} (ID ${s.holeIdIn}") — ` +
          "annulus section contributes no loss. Check the well configuration.",
      );
    }
    const r = annulusLoss(rho, pv, yp, q, s.holeIdIn, s.pipeOdIn, s.lengthFt);
    annulusPsi += r.dPsi;
    annulusVolumeBbl += s.volumeBbl;
    sections.push({
      name: `Annulus ${s.holeName} × ${s.pipeName}`,
      kind: "annulus",
      ...r,
    });
    if (r.criticalVelocityFtS && r.velocityFtS && r.velocityFtS < r.criticalVelocityFtS) {
      // laminar annular flow is normal/desired; no warning
    }
  }

  const totalPsi = surfacePsi + pipePsi + bitPsi + annulusPsi;
  const tvd = input.tvdFt ?? stringBottomMd(input.string);
  const ecdPpg = tvd > 0 ? rho + annulusPsi / (PSI_PER_FT_PER_PPG * tvd) : undefined;
  const bottomsUpMin = annulusVolumeBbl > 0 ? annulusVolumeBbl / (q / 42) : undefined;

  return {
    sections,
    surfacePsi,
    pipePsi,
    bitPsi,
    annulusPsi,
    totalPsi,
    ecdPpg,
    bottomsUpMin,
    tfaIn2,
    warnings,
  };
}
