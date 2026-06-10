import React, { useMemo, useState } from "react";
import {
  ErrorBox,
  Note,
  NumField,
  ResultRow,
  Results,
  Row,
  Screen,
  SegButtons,
  Section,
  Warnings,
  fmt,
  num,
} from "@/components/ui";
import { PlugCase, computeBalancedPlug } from "@/lib/cementplug";

const CASE_LABELS: Record<PlugCase, { lower: string; upper?: string; crossover?: string }> = {
  "open-hole": { lower: "Open hole diameter" },
  "cased-hole": { lower: "Casing ID" },
  "across-shoe": { lower: "Open hole diameter", upper: "Casing ID (above shoe)", crossover: "Casing shoe MD" },
  "liner-overlap": { lower: "Liner ID", upper: "Host casing ID", crossover: "Liner top MD" },
};

export default function BalancedPlugScreen() {
  const [plugCase, setPlugCase] = useState<PlugCase>("open-hole");
  const [baseMd, setBaseMd] = useState("6000");
  const [length, setLength] = useState("500");
  const [lowerId, setLowerId] = useState("8.5");
  const [upperId, setUpperId] = useState("8.681");
  const [crossover, setCrossover] = useState("5800");
  const [stingerOd, setStingerOd] = useState("3.5");
  const [stingerId, setStingerId] = useState("2.764");
  const [stingerLen, setStingerLen] = useState("");
  const [dpId, setDpId] = useState("");
  const [yieldFt3, setYieldFt3] = useState("1.15");
  const [mixWater, setMixWater] = useState("5.2");
  const [excessLower, setExcessLower] = useState("0");
  const [excessUpper, setExcessUpper] = useState("0");
  const [spacer, setSpacer] = useState("10");
  const [pumpOut, setPumpOut] = useState("");

  const labels = CASE_LABELS[plugCase];
  const twoZone = plugCase === "across-shoe" || plugCase === "liner-overlap";

  const result = useMemo(() => {
    const base = num(baseMd);
    const len = num(length);
    const lo = num(lowerId);
    const so = num(stingerOd);
    const si = num(stingerId);
    const y = num(yieldFt3);
    if (
      base === undefined || len === undefined || lo === undefined ||
      so === undefined || si === undefined || y === undefined ||
      base <= 0 || len <= 0 || y <= 0
    )
      return undefined;
    if (len > base) return { error: "Plug length cannot exceed the plug base depth" };
    try {
      return computeBalancedPlug({
        plugCase,
        plugBaseMd: base,
        plugLengthFt: len,
        lowerIdIn: lo,
        upperIdIn: twoZone ? num(upperId) : undefined,
        crossoverMd: twoZone ? num(crossover) : undefined,
        stingerOdIn: so,
        stingerIdIn: si,
        stingerLengthFt: num(stingerLen),
        upperPipeIdIn: num(dpId),
        slurryYieldFt3Sk: y,
        mixWaterGalSk: num(mixWater),
        excessLowerPct: num(excessLower),
        excessUpperPct: num(excessUpper),
        spacerAheadBbl: num(spacer),
        pumpOutputBblStk: num(pumpOut),
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [plugCase, baseMd, length, lowerId, upperId, crossover, stingerOd, stingerId, stingerLen, dpId, yieldFt3, mixWater, excessLower, excessUpper, spacer, pumpOut, twoZone]);

  return (
    <Screen>
      <SegButtons
        options={[
          { label: "Open hole", value: "open-hole" },
          { label: "Cased", value: "cased-hole" },
          { label: "Across shoe", value: "across-shoe" },
          { label: "Liner overlap", value: "liner-overlap" },
        ]}
        value={plugCase}
        onChange={setPlugCase}
      />
      <Note text="Balanced plug: sacks from the final plug length (pipe out); displacement leaves equal cement heights inside and outside the stinger." />

      <Section title="Plug geometry">
        <Row>
          <NumField label="Plug base MD" suffix="ft" value={baseMd} onChangeText={setBaseMd} />
          <NumField label="Plug length" suffix="ft" value={length} onChangeText={setLength} />
        </Row>
        <Row>
          <NumField label={labels.lower} suffix="in" value={lowerId} onChangeText={setLowerId} />
          {twoZone ? (
            <NumField label={labels.upper!} suffix="in" value={upperId} onChangeText={setUpperId} />
          ) : (
            <NumField label="Excess (hole)" suffix="%" value={excessLower} onChangeText={setExcessLower} />
          )}
        </Row>
        {twoZone && (
          <Row>
            <NumField label={labels.crossover!} suffix="ft" value={crossover} onChangeText={setCrossover} />
            <NumField label="Excess (lower zone)" suffix="%" value={excessLower} onChangeText={setExcessLower} />
          </Row>
        )}
        {twoZone && (
          <NumField label="Excess (upper zone)" suffix="%" value={excessUpper} onChangeText={setExcessUpper} />
        )}
      </Section>

      <Section title="Stinger / work string">
        <Row>
          <NumField label="Stinger OD" suffix="in" value={stingerOd} onChangeText={setStingerOd} />
          <NumField label="Stinger ID" suffix="in" value={stingerId} onChangeText={setStingerId} />
        </Row>
        <Row>
          <NumField label="Stinger length (opt.)" suffix="ft" value={stingerLen} onChangeText={setStingerLen} />
          <NumField label="DP ID above stinger (opt.)" suffix="in" value={dpId} onChangeText={setDpId} />
        </Row>
      </Section>

      <Section title="Slurry & spacer">
        <Row>
          <NumField label="Slurry yield" suffix="ft³/sk" value={yieldFt3} onChangeText={setYieldFt3} />
          <NumField label="Mix water" suffix="gal/sk" value={mixWater} onChangeText={setMixWater} />
        </Row>
        <Row>
          <NumField label="Spacer ahead" suffix="bbl" value={spacer} onChangeText={setSpacer} />
          <NumField label="Pump output (opt.)" suffix="bbl/stk" value={pumpOut} onChangeText={setPumpOut} />
        </Row>
      </Section>

      {result === undefined ? (
        <ErrorBox message="Enter plug base, length, hole/casing ID, stinger OD/ID and slurry yield." />
      ) : "error" in result ? (
        <ErrorBox message={result.error!} />
      ) : (
        <>
          <Warnings items={result.warnings} />
          <Results title="Slurry">
            {result.zones.map((z, i) => (
              <ResultRow
                key={i}
                label={`${z.name} — ${fmt(z.lengthFt, 0)} ft @ ${fmt(z.holeCapacityBblFt, 4)} bbl/ft${z.excessPct ? ` +${z.excessPct}%` : ""}`}
                value={fmt(z.volumeBbl, 1)}
                unit="bbl"
              />
            ))}
            <ResultRow label="Slurry volume" value={fmt(result.slurryVolumeBbl, 1)} unit="bbl" strong />
            <ResultRow label="Sacks of cement" value={fmt(result.sacks, 0)} unit="sx" strong />
            {result.mixWaterGal !== undefined && (
              <ResultRow label="Mix water" value={`${fmt(result.mixWaterGal, 0)} gal (${fmt(result.mixWaterBbl, 1)} bbl)`} />
            )}
          </Results>
          <Results title="Placement">
            <ResultRow label="Wet plug length (pipe in hole)" value={fmt(result.wetPlugLengthFt, 0)} unit="ft" />
            <ResultRow label="TOC with pipe in hole" value={fmt(result.tocWithPipeMd, 0)} unit="ft MD" />
            <ResultRow label="TOC after pulling pipe" value={fmt(result.tocFinalMd, 0)} unit="ft MD" strong />
            <ResultRow label="Spacer behind (in pipe)" value={fmt(result.spacerBehindBbl, 1)} unit="bbl" strong />
            <ResultRow label="Displacement" value={fmt(result.displacementBbl, 1)} unit="bbl" strong />
            {result.displacementStrokes !== undefined && (
              <ResultRow label="Displacement strokes" value={fmt(result.displacementStrokes, 0)} unit="stk" />
            )}
          </Results>
          <Note text="Pull the stinger slowly to the calculated TOC before reversing/circulating out excess cement." />
        </>
      )}
    </Screen>
  );
}
