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
import { computeJarring } from "@/lib/jarring";

export default function JarringScreen() {
  const [weightMode, setWeightMode] = useState<"air" | "buoyed">("air");
  const [mud, setMud] = useState("10");
  const [weight, setWeight] = useState("");
  const [drag, setDrag] = useState("0");
  const [up, setUp] = useState("");
  const [down, setDown] = useState("");
  const [cockUp, setCockUp] = useState("");
  const [cockDown, setCockDown] = useState("");
  const [pofArea, setPofArea] = useState("");
  const [diffP, setDiffP] = useState("");

  const result = useMemo(() => {
    const mudN = num(mud);
    const w = num(weight);
    const upN = num(up);
    const downN = num(down);
    if (mudN === undefined || w === undefined || upN === undefined || downN === undefined)
      return undefined;
    if (mudN <= 0 || w <= 0) return undefined;
    return computeJarring({
      mudPpg: mudN,
      airWeightAboveJarLbs: weightMode === "air" ? w : undefined,
      buoyedWeightAboveJarLbs: weightMode === "buoyed" ? w : undefined,
      dragLbs: num(drag),
      upDetentLbs: upN,
      downDetentLbs: downN,
      cockUpLbs: num(cockUp),
      cockDownLbs: num(cockDown),
      pumpOpenAreaIn2: num(pofArea),
      diffPressurePsi: num(diffP),
    });
  }, [weightMode, mud, weight, drag, up, down, cockUp, cockDown, pofArea, diffP]);

  return (
    <Screen>
      <Note text="Weight-indicator targets for firing and re-cocking a hydraulic drilling jar. Pump-open force extends the jar: it helps up-jarring and opposes down-jarring." />

      <Section title="String above the jar">
        <SegButtons
          options={[
            { label: "Air weight (apply buoyancy)", value: "air" },
            { label: "Buoyed weight (direct)", value: "buoyed" },
          ]}
          value={weightMode}
          onChange={setWeightMode}
        />
        <Row>
          <NumField
            label={weightMode === "air" ? "Air weight above jar" : "Buoyed weight above jar"}
            suffix="lbs"
            value={weight}
            onChangeText={setWeight}
          />
          <NumField label="Mud weight" suffix="ppg" value={mud} onChangeText={setMud} />
        </Row>
        <NumField label="Friction / drag" suffix="lbs" value={drag} onChangeText={setDrag} />
      </Section>

      <Section title="Jar settings">
        <Row>
          <NumField label="Up detent (trip) load" suffix="lbs" value={up} onChangeText={setUp} />
          <NumField label="Down detent (trip) load" suffix="lbs" value={down} onChangeText={setDown} />
        </Row>
        <Row>
          <NumField label="Cock-up load (opt.)" suffix="lbs" value={cockUp} onChangeText={setCockUp} />
          <NumField label="Cock-down load (opt.)" suffix="lbs" value={cockDown} onChangeText={setCockDown} />
        </Row>
        <Row>
          <NumField label="Pump-open area" suffix="in²" value={pofArea} onChangeText={setPofArea} />
          <NumField label="Diff. pressure" suffix="psi" value={diffP} onChangeText={setDiffP} />
        </Row>
      </Section>

      {result ? (
        <>
          <Warnings items={result.warnings} />
          <Results title="Weight-indicator targets">
            <ResultRow label="Buoyancy factor" value={fmt(result.buoyancyFactor, 4)} />
            <ResultRow label="Buoyed weight above jar" value={fmt(result.buoyedWeightAboveJarLbs / 1000, 1)} unit="klbs" />
            <ResultRow label="Pump-open force" value={fmt(result.pumpOpenForceLbs / 1000, 1)} unit="klbs" />
            <ResultRow label="Fire UP at" value={fmt(result.fireUpHookloadLbs / 1000, 1)} unit="klbs" strong />
            <ResultRow label="  (overpull above buoyed weight)" value={fmt(result.fireUpOverpullLbs / 1000, 1)} unit="klbs" />
            <ResultRow label="Fire DOWN at" value={fmt(result.fireDownHookloadLbs / 1000, 1)} unit="klbs" strong />
            <ResultRow label="  (set-down below buoyed weight)" value={fmt(result.fireDownSetDownLbs / 1000, 1)} unit="klbs" />
            <ResultRow label="Cock UP at (after down hit)" value={fmt(result.cockUpHookloadLbs / 1000, 1)} unit="klbs" strong />
            <ResultRow label="Cock DOWN at (after up hit)" value={fmt(result.cockDownHookloadLbs / 1000, 1)} unit="klbs" strong />
          </Results>
          <Note text="Cock loads default to the detent loads when not entered. Always check your jar vendor's operating manual for the actual detent and reset values." />
        </>
      ) : (
        <ErrorBox message="Enter weight above jar, mud weight and both detent loads." />
      )}
    </Screen>
  );
}
