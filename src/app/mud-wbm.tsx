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
  fmt,
  num,
} from "@/components/ui";
import {
  blendDensity,
  blendVolumeForTarget,
  dilution,
  startingVolumeForFinal,
  weightUp,
} from "@/lib/mudmix";

type Mode = "weightup" | "dilute" | "blend";

export default function WbmScreen() {
  const [mode, setMode] = useState<Mode>("weightup");

  // weight-up
  const [v1, setV1] = useState("1000");
  const [w1, setW1] = useState("9.0");
  const [w2, setW2] = useState("10.0");
  const [agent, setAgent] = useState<"barite" | "caco3" | "hematite">("barite");
  const [keepFinal, setKeepFinal] = useState<"initial" | "final">("initial");

  // dilution
  const [dv1, setDv1] = useState("1000");
  const [dw1, setDw1] = useState("11.0");
  const [dw2, setDw2] = useState("10.0");
  const [diluent, setDiluent] = useState("8.34");

  // blend
  const [bv1, setBv1] = useState("500");
  const [bw1, setBw1] = useState("9.0");
  const [bv2, setBv2] = useState("500");
  const [bw2, setBw2] = useState("11.0");
  const [bTarget, setBTarget] = useState("");

  const agentPpg = agent === "barite" ? 35.0 : agent === "caco3" ? 22.5 : 40.0;

  const wu = useMemo(() => {
    const v = num(v1);
    const a = num(w1);
    const b = num(w2);
    if (v === undefined || a === undefined || b === undefined || v <= 0) return undefined;
    try {
      if (keepFinal === "final") {
        const start = startingVolumeForFinal(v, a, b, agentPpg);
        return { start, ...weightUp(start, a, b, agentPpg) };
      }
      return { start: undefined as number | undefined, ...weightUp(v, a, b, agentPpg) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [v1, w1, w2, agentPpg, keepFinal]);

  const dil = useMemo(() => {
    const v = num(dv1);
    const a = num(dw1);
    const b = num(dw2);
    const d = num(diluent);
    if (v === undefined || a === undefined || b === undefined || d === undefined || v <= 0)
      return undefined;
    try {
      return dilution(v, a, b, d);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [dv1, dw1, dw2, diluent]);

  const blend = useMemo(() => {
    const va = num(bv1);
    const wa = num(bw1);
    const vb = num(bv2);
    const wb = num(bw2);
    const wt = num(bTarget);
    if (va === undefined || wa === undefined || wb === undefined) return undefined;
    try {
      if (wt !== undefined) {
        const v2 = blendVolumeForTarget(va, wa, wb, wt);
        return { mixed: wt, v2Needed: v2, final: va + v2 };
      }
      if (vb === undefined) return undefined;
      return { mixed: blendDensity(va, wa, vb, wb), v2Needed: undefined, final: va + vb };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [bv1, bw1, bv2, bw2, bTarget]);

  return (
    <Screen>
      <SegButtons
        options={[
          { label: "Weight up", value: "weightup" },
          { label: "Dilute", value: "dilute" },
          { label: "Blend", value: "blend" },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === "weightup" && (
        <>
          <Note text="Barite (SG 4.20): sacks/100 bbl = 1470·(W2−W1)/(35−W2). Same formula generalized for CaCO3 (SG 2.7) and hematite (SG ~4.8)." />
          <Section title="Weight up">
            <SegButtons
              options={[
                { label: "Barite", value: "barite" },
                { label: "CaCO₃", value: "caco3" },
                { label: "Hematite", value: "hematite" },
              ]}
              value={agent}
              onChange={setAgent}
            />
            <SegButtons
              options={[
                { label: "I have this volume now", value: "initial" },
                { label: "I need this final volume", value: "final" },
              ]}
              value={keepFinal}
              onChange={setKeepFinal}
            />
            <NumField
              label={keepFinal === "initial" ? "Current mud volume" : "Required final volume"}
              suffix="bbl"
              value={v1}
              onChangeText={setV1}
            />
            <Row>
              <NumField label="Current weight" suffix="ppg" value={w1} onChangeText={setW1} />
              <NumField label="Target weight" suffix="ppg" value={w2} onChangeText={setW2} />
            </Row>
          </Section>
          {wu === undefined ? (
            <ErrorBox message="Enter volume and both densities." />
          ) : "error" in wu ? (
            <ErrorBox message={wu.error!} />
          ) : (
            <Results>
              {wu.start !== undefined && (
                <ResultRow label="Start with (before weighting)" value={fmt(wu.start, 1)} unit="bbl" strong />
              )}
              <ResultRow label={`${agent === "caco3" ? "CaCO₃" : agent} required`} value={fmt(wu.totalLbs, 0)} unit="lbs" />
              <ResultRow label="Sacks (100 lb)" value={fmt(wu.sacks, 1)} unit="sx" strong />
              <ResultRow label="Metric tonnes" value={fmt(wu.tonnes, 2)} unit="t" />
              <ResultRow label="Addition rate" value={fmt(wu.lbsPerBbl, 1)} unit="lb/bbl" />
              <ResultRow label="Volume increase" value={fmt(wu.volumeIncreaseBbl, 1)} unit="bbl" />
              <ResultRow label="Final volume" value={fmt(wu.finalVolumeBbl, 1)} unit="bbl" strong />
            </Results>
          )}
        </>
      )}

      {mode === "dilute" && (
        <>
          <Note text="Volume of diluent = V1·(W1−W2)/(W2−Wdiluent). Use 8.34 for fresh water, brine density for brines, base-oil density to cut OBM." />
          <Section title="Dilution / weight reduction">
            <NumField label="Current mud volume" suffix="bbl" value={dv1} onChangeText={setDv1} />
            <Row>
              <NumField label="Current weight" suffix="ppg" value={dw1} onChangeText={setDw1} />
              <NumField label="Target weight" suffix="ppg" value={dw2} onChangeText={setDw2} />
            </Row>
            <NumField label="Diluent density" suffix="ppg" value={diluent} onChangeText={setDiluent} />
          </Section>
          {dil === undefined ? (
            <ErrorBox message="Enter volume and densities." />
          ) : "error" in dil ? (
            <ErrorBox message={dil.error!} />
          ) : (
            <Results>
              <ResultRow label="Diluent to add" value={fmt(dil.addedBbl, 1)} unit="bbl" strong />
              <ResultRow label="Final volume" value={fmt(dil.finalVolumeBbl, 1)} unit="bbl" />
            </Results>
          )}
        </>
      )}

      {mode === "blend" && (
        <>
          <Note text="Leave 'target weight' empty to mix two known volumes; set it to solve for the volume of mud 2 needed." />
          <Section title="Blend two muds">
            <Row>
              <NumField label="Mud 1 volume" suffix="bbl" value={bv1} onChangeText={setBv1} />
              <NumField label="Mud 1 weight" suffix="ppg" value={bw1} onChangeText={setBw1} />
            </Row>
            <Row>
              <NumField label="Mud 2 volume" suffix="bbl" value={bv2} onChangeText={setBv2} />
              <NumField label="Mud 2 weight" suffix="ppg" value={bw2} onChangeText={setBw2} />
            </Row>
            <NumField label="Target weight (optional)" suffix="ppg" value={bTarget} onChangeText={setBTarget} />
          </Section>
          {blend === undefined ? (
            <ErrorBox message="Enter mud 1 volume/weight and mud 2 weight (plus volume or target)." />
          ) : "error" in blend ? (
            <ErrorBox message={blend.error!} />
          ) : (
            <Results>
              {blend.v2Needed !== undefined && (
                <ResultRow label="Mud 2 volume needed" value={fmt(blend.v2Needed, 1)} unit="bbl" strong />
              )}
              <ResultRow label="Blended density" value={fmt(blend.mixed, 2)} unit="ppg" strong />
              <ResultRow label="Final volume" value={fmt(blend.final, 1)} unit="bbl" />
            </Results>
          )}
        </>
      )}
    </Screen>
  );
}
