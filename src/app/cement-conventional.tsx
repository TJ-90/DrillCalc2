import React, { useMemo, useState } from "react";
import {
  ErrorBox,
  Note,
  NumField,
  ResultRow,
  Results,
  Row,
  Screen,
  Section,
  Warnings,
  fmt,
  num,
} from "@/components/ui";
import { computeConventionalCementation } from "@/lib/cementation";

export default function ConventionalCementScreen() {
  const [casingOd, setCasingOd] = useState("9.625");
  const [casingId, setCasingId] = useState("8.681");
  const [shoe, setShoe] = useState("5000");
  const [holeId, setHoleId] = useState("12.25");
  const [holeTd, setHoleTd] = useState("");
  const [prevId, setPrevId] = useState("12.415");
  const [prevShoe, setPrevShoe] = useState("2500");
  const [toc, setToc] = useState("2000");
  const [fc, setFc] = useState("4920");
  const [excess, setExcess] = useState("20");
  const [yieldFt3, setYieldFt3] = useState("1.15");
  const [mixWater, setMixWater] = useState("5.2");
  const [slurryPpg, setSlurryPpg] = useState("15.8");
  const [mudPpg, setMudPpg] = useState("10");
  const [pumpOut, setPumpOut] = useState("0.119");

  const result = useMemo(() => {
    const co = num(casingOd);
    const ci = num(casingId);
    const sh = num(shoe);
    const hi = num(holeId);
    const pi = num(prevId);
    const ps = num(prevShoe);
    const t = num(toc);
    const f = num(fc);
    const y = num(yieldFt3);
    if (
      co === undefined || ci === undefined || sh === undefined || hi === undefined ||
      pi === undefined || ps === undefined || t === undefined || f === undefined ||
      y === undefined || sh <= 0 || y <= 0
    )
      return undefined;
    if (ci >= co) return { error: "Casing ID must be smaller than casing OD" };
    if (hi <= co) return { error: "Open hole diameter must be larger than casing OD" };
    try {
      return computeConventionalCementation({
        casingOdIn: co,
        casingIdIn: ci,
        shoeMd: sh,
        openHoleIdIn: hi,
        prevCasingIdIn: pi,
        prevShoeMd: ps,
        holeTdMd: num(holeTd),
        tocMd: t,
        floatCollarMd: f,
        excessOpenHolePct: num(excess),
        slurryYieldFt3Sk: y,
        mixWaterGalSk: num(mixWater),
        slurryPpg: num(slurryPpg),
        mudPpg: num(mudPpg),
        pumpOutputBblStk: num(pumpOut),
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [casingOd, casingId, shoe, holeId, holeTd, prevId, prevShoe, toc, fc, excess, yieldFt3, mixWater, slurryPpg, mudPpg, pumpOut]);

  return (
    <Screen>
      <Note text="Single-stage job with bottom and top plugs. Slurry fills rathole, open-hole annulus (with excess), cased annulus up to TOC and the shoe track. Displacement bumps the top plug on the float collar." />

      <Section title="Casing being cemented">
        <Row>
          <NumField label="Casing OD" suffix="in" value={casingOd} onChangeText={setCasingOd} />
          <NumField label="Casing ID" suffix="in" value={casingId} onChangeText={setCasingId} />
        </Row>
        <Row>
          <NumField label="Shoe MD" suffix="ft" value={shoe} onChangeText={setShoe} />
          <NumField label="Float collar MD" suffix="ft" value={fc} onChangeText={setFc} />
        </Row>
      </Section>

      <Section title="Hole & previous casing">
        <Row>
          <NumField label="Open hole size" suffix="in" value={holeId} onChangeText={setHoleId} />
          <NumField label="Hole TD (opt.)" suffix="ft" value={holeTd} onChangeText={setHoleTd} />
        </Row>
        <Row>
          <NumField label="Prev. casing ID" suffix="in" value={prevId} onChangeText={setPrevId} />
          <NumField label="Prev. shoe MD" suffix="ft" value={prevShoe} onChangeText={setPrevShoe} />
        </Row>
        <Row>
          <NumField label="Planned TOC" suffix="ft" value={toc} onChangeText={setToc} />
          <NumField label="OH excess" suffix="%" value={excess} onChangeText={setExcess} />
        </Row>
      </Section>

      <Section title="Slurry & displacement">
        <Row>
          <NumField label="Slurry yield" suffix="ft³/sk" value={yieldFt3} onChangeText={setYieldFt3} />
          <NumField label="Mix water" suffix="gal/sk" value={mixWater} onChangeText={setMixWater} />
        </Row>
        <Row>
          <NumField label="Slurry weight" suffix="ppg" value={slurryPpg} onChangeText={setSlurryPpg} />
          <NumField label="Mud weight" suffix="ppg" value={mudPpg} onChangeText={setMudPpg} />
        </Row>
        <NumField label="Pump output (opt.)" suffix="bbl/stk" value={pumpOut} onChangeText={setPumpOut} />
      </Section>

      {result === undefined ? (
        <ErrorBox message="Enter casing, hole and slurry data to compute the job." />
      ) : "error" in result ? (
        <ErrorBox message={result.error!} />
      ) : (
        <>
          <Warnings items={result.warnings} />
          <Results title="Slurry volume">
            {result.breakdown.map((b, i) => (
              <ResultRow
                key={i}
                label={`${b.name} — ${fmt(b.lengthFt, 0)} ft${b.excessPct ? ` +${b.excessPct}%` : ""}`}
                value={fmt(b.volumeBbl, 1)}
                unit="bbl"
              />
            ))}
            <ResultRow label="Total slurry" value={`${fmt(result.slurryVolumeBbl, 1)} bbl (${fmt(result.slurryVolumeFt3, 0)} ft³)`} strong />
            <ResultRow label="Sacks of cement" value={fmt(result.sacks, 0)} unit="sx" strong />
            {result.mixWaterGal !== undefined && (
              <ResultRow label="Mix water" value={`${fmt(result.mixWaterGal, 0)} gal (${fmt(result.mixWaterBbl, 1)} bbl)`} />
            )}
          </Results>
          <Results title="Displacement">
            <ResultRow label="Displacement to bump plug" value={fmt(result.displacementBbl, 1)} unit="bbl" strong />
            {result.displacementStrokes !== undefined && (
              <ResultRow label="Displacement strokes" value={fmt(result.displacementStrokes, 0)} unit="stk" strong />
            )}
            {result.liftPressurePsi !== undefined && (
              <ResultRow label="Differential (lift) pressure at bump" value={fmt(result.liftPressurePsi, 0)} unit="psi" />
            )}
          </Results>
          <Note text="Watch for the pressure spike at bump — do not exceed casing test pressure. Under-displace by the company-man's preference rather than over-displacing past the float collar." />
        </>
      )}
    </Screen>
  );
}
