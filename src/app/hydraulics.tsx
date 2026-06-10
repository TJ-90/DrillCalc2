import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  C,
  ErrorBox,
  Note,
  NumField,
  ResultRow,
  Results,
  Row,
  Screen,
  SegButtons,
  Section,
  TextField,
  Warnings,
  fmt,
  num,
} from "@/components/ui";
import { computeHydraulics } from "@/lib/hydraulics";
import { useWell } from "@/store/well";

function parseList(s: string): number[] | undefined {
  const parts = s.split(/[,\s]+/).map((x) => x.trim()).filter((x) => x !== "");
  if (parts.length === 0) return undefined;
  const nums = parts.map((p) => Number(p));
  return nums.every((n) => isFinite(n) && n > 0) ? nums : undefined;
}

export default function HydraulicsScreen() {
  const { well } = useWell();
  const [mud, setMud] = useState("10");
  const [pv, setPv] = useState("20");
  const [yp, setYp] = useState("15");
  const [gpm, setGpm] = useState("350");
  const [nozzles, setNozzles] = useState("12, 12, 12");
  const [surfCase, setSurfCase] = useState<"none" | "1" | "2" | "3" | "4">("3");
  const [tvd, setTvd] = useState("");

  const result = useMemo(() => {
    const mudN = num(mud);
    const pvN = num(pv);
    const ypN = num(yp);
    const q = num(gpm);
    if (mudN === undefined || pvN === undefined || ypN === undefined || q === undefined) return undefined;
    if (mudN <= 0 || q <= 0) return undefined;
    try {
      return computeHydraulics({
        mudPpg: mudN,
        pvCp: pvN,
        ypLbf100ft2: ypN,
        gpm: q,
        string: well.string,
        holes: well.holes,
        nozzles32nds: parseList(nozzles),
        surfaceCase: surfCase === "none" ? undefined : (Number(surfCase) as 1 | 2 | 3 | 4),
        tvdFt: num(tvd),
      });
    } catch {
      return undefined;
    }
  }, [mud, pv, yp, gpm, nozzles, surfCase, tvd, well]);

  return (
    <Screen>
      <Note text="Bingham-plastic system losses using the string and hole sections from Well Configuration. Pump pressure = surface + pipe + bit + annulus losses; ECD adds annular losses to mud weight." />

      <Section title="Mud & rate">
        <Row>
          <NumField label="Mud weight" suffix="ppg" value={mud} onChangeText={setMud} />
          <NumField label="Flow rate" suffix="gpm" value={gpm} onChangeText={setGpm} />
        </Row>
        <Row>
          <NumField label="PV" suffix="cP" value={pv} onChangeText={setPv} />
          <NumField label="YP" suffix="lb/100ft²" value={yp} onChangeText={setYp} />
        </Row>
        <TextField label="Bit nozzles (32nds)" value={nozzles} onChangeText={setNozzles} placeholder="12, 12, 12" />
        <Text style={st.segLabel}>Surface equipment case</Text>
        <SegButtons
          options={[
            { label: "None", value: "none" },
            { label: "1", value: "1" },
            { label: "2", value: "2" },
            { label: "3", value: "3" },
            { label: "4", value: "4" },
          ]}
          value={surfCase}
          onChange={setSurfCase}
        />
        <NumField label="TVD for ECD (opt., defaults to bit MD)" suffix="ft" value={tvd} onChangeText={setTvd} />
      </Section>

      {result ? (
        <>
          <Warnings items={result.warnings} />
          <Results title="Expected pump pressure">
            <ResultRow label="Surface equipment" value={fmt(result.surfacePsi, 0)} unit="psi" />
            <ResultRow label="Drill string (inside)" value={fmt(result.pipePsi, 0)} unit="psi" />
            <ResultRow label="Bit (TFA jets)" value={fmt(result.bitPsi, 0)} unit="psi" />
            <ResultRow label="Annulus" value={fmt(result.annulusPsi, 0)} unit="psi" />
            <ResultRow label="TOTAL pump pressure" value={fmt(result.totalPsi, 0)} unit="psi" strong />
            {result.ecdPpg !== undefined && (
              <ResultRow label="ECD at TD" value={fmt(result.ecdPpg, 2)} unit="ppg" strong />
            )}
            {result.bottomsUpMin !== undefined && (
              <ResultRow label="Bottoms-up time" value={fmt(result.bottomsUpMin, 0)} unit="min" />
            )}
            {result.tfaIn2 !== undefined && <ResultRow label="TFA" value={fmt(result.tfaIn2, 4)} unit="in²" />}
          </Results>

          <Results title="Section detail">
            <View style={st.head}>
              <Text style={[st.col, { flex: 2.2 }]}>Section</Text>
              <Text style={st.col}>v (ft/s)</Text>
              <Text style={st.col}>Regime</Text>
              <Text style={[st.col, { textAlign: "right" }]}>ΔP (psi)</Text>
            </View>
            {result.sections.map((s, i) => (
              <View key={i} style={st.row}>
                <Text style={[st.cell, { flex: 2.2 }]} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={st.cell}>{s.velocityFtS !== undefined ? fmt(s.velocityFtS, 1) : "—"}</Text>
                <Text style={st.cell}>{s.regime ?? "—"}</Text>
                <Text style={[st.cell, { textAlign: "right", color: C.accent, fontWeight: "700" }]}>
                  {fmt(s.dPsi, 0)}
                </Text>
              </View>
            ))}
          </Results>
          <Note text="Annular flow should normally stay laminar (below critical velocity) to limit hole erosion; pipe flow is typically turbulent. Adjust string/hole in Well Configuration." />
        </>
      ) : (
        <ErrorBox message="Enter mud weight, PV, YP and flow rate. The string and hole come from Well Configuration." />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  segLabel: { color: C.sub, fontSize: 12, marginBottom: 5 },
  head: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#1E3A4F" },
  col: { flex: 1, color: C.blue, fontSize: 11, fontWeight: "700" },
  row: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#1E3A4F" },
  cell: { flex: 1, color: C.text, fontSize: 12 },
});
