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
import { computeStabInCementation } from "@/lib/cementation";

export default function StabInCementScreen() {
  const [casingOd, setCasingOd] = useState("13.375");
  const [casingId, setCasingId] = useState("12.415");
  const [shoe, setShoe] = useState("2500");
  const [fc, setFc] = useState("2460");
  const [holeId, setHoleId] = useState("17.5");
  const [holeTd, setHoleTd] = useState("");
  const [prevId, setPrevId] = useState("19.124");
  const [prevShoe, setPrevShoe] = useState("500");
  const [toc, setToc] = useState("0");
  const [dpId, setDpId] = useState("4.276");
  const [excess, setExcess] = useState("50");
  const [yieldFt3, setYieldFt3] = useState("1.18");
  const [mixWater, setMixWater] = useState("5.2");
  const [pumpOut, setPumpOut] = useState("0.119");

  const result = useMemo(() => {
    const co = num(casingOd);
    const ci = num(casingId);
    const sh = num(shoe);
    const f = num(fc);
    const hi = num(holeId);
    const pi = num(prevId);
    const ps = num(prevShoe);
    const t = num(toc);
    const dp = num(dpId);
    const y = num(yieldFt3);
    if (
      co === undefined || ci === undefined || sh === undefined || f === undefined ||
      hi === undefined || pi === undefined || ps === undefined || t === undefined ||
      dp === undefined || y === undefined || sh <= 0 || y <= 0
    )
      return undefined;
    try {
      return computeStabInCementation({
        casingOdIn: co,
        casingIdIn: ci,
        shoeMd: sh,
        floatCollarMd: f,
        openHoleIdIn: hi,
        prevCasingIdIn: pi,
        prevShoeMd: ps,
        holeTdMd: num(holeTd),
        tocMd: t,
        dpIdIn: dp,
        excessOpenHolePct: num(excess),
        slurryYieldFt3Sk: y,
        mixWaterGalSk: num(mixWater),
        pumpOutputBblStk: num(pumpOut),
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [casingOd, casingId, shoe, fc, holeId, holeTd, prevId, prevShoe, toc, dpId, excess, yieldFt3, mixWater, pumpOut]);

  return (
    <Screen>
      <Note text="Inner-string (stab-in) job: drill pipe is stabbed into the stab-in float collar and cement is pumped through the DP — typical for large surface/conductor casing. TOC = 0 means cement to surface." />

      <Section title="Casing being cemented">
        <Row>
          <NumField label="Casing OD" suffix="in" value={casingOd} onChangeText={setCasingOd} />
          <NumField label="Casing ID" suffix="in" value={casingId} onChangeText={setCasingId} />
        </Row>
        <Row>
          <NumField label="Shoe MD" suffix="ft" value={shoe} onChangeText={setShoe} />
          <NumField label="Stab-in collar MD" suffix="ft" value={fc} onChangeText={setFc} />
        </Row>
      </Section>

      <Section title="Hole & previous casing">
        <Row>
          <NumField label="Open hole size" suffix="in" value={holeId} onChangeText={setHoleId} />
          <NumField label="Hole TD (opt.)" suffix="ft" value={holeTd} onChangeText={setHoleTd} />
        </Row>
        <Row>
          <NumField label="Prev. casing/cond. ID" suffix="in" value={prevId} onChangeText={setPrevId} />
          <NumField label="Prev. shoe MD" suffix="ft" value={prevShoe} onChangeText={setPrevShoe} />
        </Row>
        <Row>
          <NumField label="Planned TOC" suffix="ft" value={toc} onChangeText={setToc} />
          <NumField label="OH excess" suffix="%" value={excess} onChangeText={setExcess} />
        </Row>
      </Section>

      <Section title="Inner string & slurry">
        <NumField label="Drill pipe ID" suffix="in" value={dpId} onChangeText={setDpId} />
        <Row>
          <NumField label="Slurry yield" suffix="ft³/sk" value={yieldFt3} onChangeText={setYieldFt3} />
          <NumField label="Mix water" suffix="gal/sk" value={mixWater} onChangeText={setMixWater} />
        </Row>
        <NumField label="Pump output (opt.)" suffix="bbl/stk" value={pumpOut} onChangeText={setPumpOut} />
      </Section>

      {result === undefined ? (
        <ErrorBox message="Enter casing, hole, drill pipe and slurry data." />
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
            <ResultRow label="DP displacement to clear stab-in" value={fmt(result.displacementBbl, 1)} unit="bbl" strong />
            {result.displacementStrokes !== undefined && (
              <ResultRow label="Displacement strokes" value={fmt(result.displacementStrokes, 0)} unit="stk" strong />
            )}
          </Results>
        </>
      )}
    </Screen>
  );
}
