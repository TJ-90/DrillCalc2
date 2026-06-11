# DrillCalc

Drilling field calculators for iOS and Android, built with Expo (React Native + TypeScript).
All calculations use API field units (ft, in, ppg, psi, bbl, gpm) and follow the standard
formulas from Lapeyrouse *Formulas and Calculations for Drilling, Production and Workover*
and the Amoco/API Bingham-plastic hydraulics equations.

[![Build](https://github.com/TJ-90/DrillCalc2/actions/workflows/build.yml/badge.svg)](https://github.com/TJ-90/DrillCalc2/actions/workflows/build.yml)

## Calculators

| Calculator | What it does |
| --- | --- |
| **Kill Sheet** | Vertical/directional toggle (MD inputs only appear for directional wells). KMW, ICP, FCP, MAASP, strokes & times, influx characterization, ICP→FCP step-down schedule. |
| **Bit Nozzles / TFA** | TFA from nozzle sizes in 32nds, nozzle ΔP across a list of GPMs, jet velocity, HHP, HSI, impact force. |
| **Mud Engineering Calculator** | Faithful port of MUDCALCU.EXE (Bruce Guthrie / Baroid). 13 functions — Weight Up (volume increase / constant volume), Cut Mud Weight (volume increase / constant volume), Mix two/three muds, Adjust OWR, Add Barite (MT), Add water / base fluid to oil mud, Suspected water contamination, Mix WBM, Mix OBM, Slug displacement. Density in PPG / SG / PSI per 1000 ft; volume in bbls / m³; barite in MT. Captions reproduced verbatim from the original. |
| **Jarring Weights** | Up/down jarring and cock-up/cock-down weight-indicator targets, with buoyancy, drag and pump-open force. |
| **Balanced Cement Plug** | All four cases: entirely open hole, entirely cased, across the casing shoe, across a liner top. Sacks, spacer-behind balance, displacement, TOC with pipe in/out. |
| **Casing Cementation** | Conventional two-plug job: rathole + OH annulus (excess) + cased annulus + shoe track, displacement to bump, lift pressure. |
| **Stab-in Cementation** | Inner-string job through drill pipe stabbed into the float collar. |
| **Mud Hydraulics** | Bingham-plastic system losses per section (surface, string, bit, annulus), expected pump pressure, ECD, bottoms-up time. |
| **Well Configuration** | Drill string components (OD/ID/ppf/length) and casing/hole sections with a quick-add catalog. Feeds volumes to the kill sheet and hydraulics. |

## Key formulas implemented

- Capacity (bbl/ft) = ID² / 1029.4; annular capacity = (D₂² − D₁²) / 1029.4
- Kill mud weight = OMW + SIDPP / (0.052 × TVD)
- ICP = SIDPP + SCRP; FCP = SCRP × KMW / OMW
- TFA = Σ π/4 × (d/32)²; bit ΔP = MW·Q² / (12031·Cd²·TFA²), Cd = 0.95
- Barite weight-up: sx/100 bbl = 1470 (W₂ − W₁) / (35 − W₂)
- OBM barite volume: V_b = V_f (W_t − W_l) / (35 − W_l), W_l = f_o·W_o + f_w·W_w
- Balanced plug: spacer behind = spacer ahead × C_pipe / C_annulus
- Bingham pipe laminar ΔP = PV·L·v/(1500·d²) + YP·L/(225·d); turbulent ΔP = ρ^0.75 v^1.75 PV^0.25 L / (1800 d^1.25) (annulus constants 1000/200/1396)
- ECD = MW + ΣΔP_annulus / (0.052 × TVD)

The engine is pure TypeScript in [`src/lib`](src/lib) with **89 unit tests**
([`src/lib/__tests__`](src/lib/__tests__), Jest) verified against hand-worked textbook examples.

## Development

```bash
npm install
npm start            # Expo dev server (scan QR with Expo Go)
npm test             # engine unit tests (Jest)
npm run typecheck    # tsc --noEmit
```

## CI builds (GitHub Actions)

Every push to `main` runs [build.yml](.github/workflows/build.yml):

1. **test** — TypeScript check + engine unit tests
2. **android** — `expo prebuild` + Gradle release build → installable APK artifact (debug-signed)
3. **ios** — `expo prebuild` + `xcodebuild` without code signing → unsigned `.ipa` artifact

Download artifacts from the Actions run page. For store distribution:

- **Play Store**: sign the AAB/APK with your upload key (or switch the workflow to `bundleRelease`).
- **App Store**: the unsigned IPA proves the build; submitting requires an Apple Developer
  account — easiest path is [EAS Build](https://docs.expo.dev/build/introduction/) (`eas build -p ios`).

## Disclaimer

Field estimates only. Always verify against your operator's approved kill sheet,
cementing program and jar operating manual before operational use.
