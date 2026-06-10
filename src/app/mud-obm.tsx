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
import { adjustOwr, buildObm, owrFromRetort } from "@/lib/mudmix";

type Mode = "build" | "owr";

export default function ObmScreen() {
  const [mode, setMode] = useState<Mode>("build");

  // build
  const [vol, setVol] = useState("500");
  const [target, setTarget] = useState("12.0");
  const [oilPct, setOilPct] = useState("80");
  const [oilPpg, setOilPpg] = useState("7.0");
  const [brinePpg, setBrinePpg] = useState("8.34");

  // OWR adjust
  const [mudVol, setMudVol] = useState("1000");
  const [retOil, setRetOil] = useState("54");
  const [retWater, setRetWater] = useState("18");
  const [targetOil, setTargetOil] = useState("80");
  const [curPpg, setCurPpg] = useState("12.0");
  const [adjOilPpg, setAdjOilPpg] = useState("7.0");
  const [adjBrinePpg, setAdjBrinePpg] = useState("8.34");

  const build = useMemo(() => {
    const v = num(vol);
    const t = num(target);
    const o = num(oilPct);
    if (v === undefined || t === undefined || o === undefined || v <= 0) return undefined;
    try {
      return buildObm({
        finalVolumeBbl: v,
        targetPpg: t,
        oilPctOfLiquid: o,
        baseOilPpg: num(oilPpg),
        brinePpg: num(brinePpg),
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [vol, target, oilPct, oilPpg, brinePpg]);

  const owr = useMemo(() => {
    const v = num(mudVol);
    const ro = num(retOil);
    const rw = num(retWater);
    const t = num(targetOil);
    if (v === undefined || ro === undefined || rw === undefined || t === undefined || v <= 0)
      return undefined;
    try {
      const current = owrFromRetort(ro, rw);
      const adj = adjustOwr({
        mudVolumeBbl: v,
        retortOilPct: ro,
        retortWaterPct: rw,
        targetOilPctOfLiquid: t,
        currentMudPpg: num(curPpg),
        baseOilPpg: num(adjOilPpg),
        brinePpg: num(adjBrinePpg),
      });
      return { current, adj };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [mudVol, retOil, retWater, targetOil, curPpg, adjOilPpg, adjBrinePpg]);

  return (
    <Screen>
      <SegButtons
        options={[
          { label: "Build OBM", value: "build" },
          { label: "Adjust OWR", value: "owr" },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === "build" && (
        <>
          <Note text="Builds an OBM from base oil + brine + barite. Liquid density Wl = fo·Wo + fw·Ww; barite volume Vb = Vf·(Wt−Wl)/(35−Wl). Diesel ≈ 7.0 ppg, mineral oil ≈ 6.7 ppg, CaCl₂ brine up to ~11.6 ppg." />
          <Section title="Target mud">
            <Row>
              <NumField label="Final volume" suffix="bbl" value={vol} onChangeText={setVol} />
              <NumField label="Target weight" suffix="ppg" value={target} onChangeText={setTarget} />
            </Row>
            <NumField label="Oil % of liquid phase (OWR)" suffix="%" value={oilPct} onChangeText={setOilPct} />
            <Row>
              <NumField label="Base oil density" suffix="ppg" value={oilPpg} onChangeText={setOilPpg} />
              <NumField label="Brine density" suffix="ppg" value={brinePpg} onChangeText={setBrinePpg} />
            </Row>
          </Section>
          {build === undefined ? (
            <ErrorBox message="Enter volume, target weight and oil %." />
          ) : "error" in build ? (
            <ErrorBox message={build.error!} />
          ) : (
            <Results title={`Recipe — ${build.owr} OWR`}>
              <ResultRow label="Base oil" value={fmt(build.baseOilBbl, 1)} unit="bbl" strong />
              <ResultRow label="Water / brine" value={fmt(build.brineBbl, 1)} unit="bbl" strong />
              <ResultRow label="Barite" value={fmt(build.bariteLbs, 0)} unit="lbs" />
              <ResultRow label="Barite sacks (100 lb)" value={fmt(build.bariteSacks, 0)} unit="sx" strong />
              <ResultRow label="Barite volume" value={fmt(build.bariteBbl, 1)} unit="bbl" />
              <ResultRow label="Liquid phase density" value={fmt(build.liquidPhasePpg, 2)} unit="ppg" />
              <ResultRow label="Check density" value={fmt(build.checkPpg, 2)} unit="ppg" />
            </Results>
          )}
        </>
      )}

      {mode === "owr" && (
        <>
          <Note text="From retort oil/water % of whole mud. Raising OWR adds base oil; lowering OWR adds water/brine. Adding either cuts mud weight — re-weight with barite afterwards if needed." />
          <Section title="Current mud (retort)">
            <Row>
              <NumField label="Mud volume" suffix="bbl" value={mudVol} onChangeText={setMudVol} />
              <NumField label="Mud weight" suffix="ppg" value={curPpg} onChangeText={setCurPpg} />
            </Row>
            <Row>
              <NumField label="Retort oil" suffix="% vol" value={retOil} onChangeText={setRetOil} />
              <NumField label="Retort water" suffix="% vol" value={retWater} onChangeText={setRetWater} />
            </Row>
          </Section>
          <Section title="Target">
            <NumField label="Target oil % of liquid" suffix="%" value={targetOil} onChangeText={setTargetOil} />
            <Row>
              <NumField label="Base oil density" suffix="ppg" value={adjOilPpg} onChangeText={setAdjOilPpg} />
              <NumField label="Brine density" suffix="ppg" value={adjBrinePpg} onChangeText={setAdjBrinePpg} />
            </Row>
          </Section>
          {owr === undefined ? (
            <ErrorBox message="Enter mud volume, retort oil/water % and target OWR." />
          ) : "error" in owr ? (
            <ErrorBox message={owr.error!} />
          ) : (
            <Results>
              <ResultRow label="Current OWR" value={owr.current.owr} strong />
              <ResultRow label="Target OWR" value={owr.adj.targetOwr} strong />
              <ResultRow
                label={`Add ${owr.adj.fluidToAdd === "none" ? "nothing" : owr.adj.fluidToAdd}`}
                value={fmt(owr.adj.addVolumeBbl, 1)}
                unit="bbl"
                strong
              />
              <ResultRow label="New total volume" value={fmt(owr.adj.newTotalVolumeBbl, 1)} unit="bbl" />
              {owr.adj.newMudPpg !== undefined && (
                <ResultRow label="New mud weight (approx.)" value={fmt(owr.adj.newMudPpg, 2)} unit="ppg" />
              )}
            </Results>
          )}
        </>
      )}
    </Screen>
  );
}
