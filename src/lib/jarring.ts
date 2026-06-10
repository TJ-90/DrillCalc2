/**
 * Drilling jar operating weights.
 *
 * Sign conventions (weight-indicator readings, lbs):
 *  - Wa  = buoyed weight of string ABOVE the jar
 *  - D   = friction/drag (acts against string movement)
 *  - POF = pump-open force = pump-open area * differential pressure.
 *          POF acts to EXTEND the jar, so it assists up-jarring (less overpull
 *          needed) and opposes down-jarring (more slack-off needed).
 *
 *  Fire UP    hookload = Wa + up detent load    + drag - POF
 *  Fire DOWN  hookload = Wa - down detent load  - drag - POF
 *  Cock DOWN  hookload = Wa - cock-down load    - drag - POF   (reset after up-jarring)
 *  Cock UP    hookload = Wa + cock-up load      + drag - POF   (reset after down-jarring)
 */
import { buoyancyFactor } from "./units";

export interface JarringInput {
  mudPpg: number;
  /** Air weight of the string above the jar, lbs (buoyancy applied internally) */
  airWeightAboveJarLbs?: number;
  /** Buoyed weight above the jar, lbs — overrides airWeightAboveJarLbs if set */
  buoyedWeightAboveJarLbs?: number;
  /** Friction / drag, lbs */
  dragLbs?: number;
  /** Jar up trip (detent) load, lbs */
  upDetentLbs: number;
  /** Jar down trip (detent) load, lbs */
  downDetentLbs: number;
  /** Load to re-cock moving up (after firing down); defaults to up detent */
  cockUpLbs?: number;
  /** Load to re-cock moving down (after firing up); defaults to down detent */
  cockDownLbs?: number;
  /** Pump-open area of the jar, in^2 */
  pumpOpenAreaIn2?: number;
  /** Differential pressure across the jar while circulating, psi */
  diffPressurePsi?: number;
}

export interface JarringResult {
  buoyancyFactor: number;
  buoyedWeightAboveJarLbs: number;
  pumpOpenForceLbs: number;
  /** Hookload to fire the jar UP */
  fireUpHookloadLbs: number;
  /** Overpull above the buoyed string weight to fire up */
  fireUpOverpullLbs: number;
  /** Indicator weight to slack down to, to fire the jar DOWN */
  fireDownHookloadLbs: number;
  /** Set-down below the buoyed string weight to fire down */
  fireDownSetDownLbs: number;
  /** Indicator weight to re-cock after an up hit (cocking down) */
  cockDownHookloadLbs: number;
  /** Indicator weight to re-cock after a down hit (cocking up) */
  cockUpHookloadLbs: number;
  warnings: string[];
}

export function computeJarring(input: JarringInput): JarringResult {
  const warnings: string[] = [];
  const bf = buoyancyFactor(input.mudPpg);
  const wa =
    input.buoyedWeightAboveJarLbs ??
    (input.airWeightAboveJarLbs !== undefined ? input.airWeightAboveJarLbs * bf : 0);
  if (wa <= 0) warnings.push("Weight above jar is zero — enter air or buoyed weight above the jar.");

  const drag = input.dragLbs ?? 0;
  const pof =
    (input.pumpOpenAreaIn2 ?? 0) * (input.diffPressurePsi ?? 0);
  const cockUp = input.cockUpLbs ?? input.upDetentLbs;
  const cockDown = input.cockDownLbs ?? input.downDetentLbs;

  const fireUp = wa + input.upDetentLbs + drag - pof;
  const fireDown = wa - input.downDetentLbs - drag - pof;
  const cockDownHl = wa - cockDown - drag - pof;
  const cockUpHl = wa + cockUp + drag - pof;

  if (fireDown < 0) {
    warnings.push(
      "Down-jar hookload is negative — not enough string weight above the jar to fire down " +
        "(pump-open force and drag included). Consider bleeding off pump pressure before jarring down.",
    );
  }
  if (pof > 0) {
    warnings.push(
      "Pump-open force included: bleeding pumps off makes down-jarring easier and up-jarring harder.",
    );
  }

  return {
    buoyancyFactor: bf,
    buoyedWeightAboveJarLbs: wa,
    pumpOpenForceLbs: pof,
    fireUpHookloadLbs: fireUp,
    fireUpOverpullLbs: fireUp - wa,
    fireDownHookloadLbs: fireDown,
    fireDownSetDownLbs: wa - fireDown,
    cockDownHookloadLbs: cockDownHl,
    cockUpHookloadLbs: cockUpHl,
    warnings,
  };
}
