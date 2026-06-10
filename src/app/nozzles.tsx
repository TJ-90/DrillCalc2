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
  Section,
  TextField,
  fmt,
  num,
} from "@/components/ui";
import { bitHydraulicsTable, totalFlowAreaIn2 } from "@/lib/nozzles";

function parseList(s: string): number[] | undefined {
  const parts = s
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter((x) => x !== "");
  if (parts.length === 0) return undefined;
  const nums = parts.map((p) => Number(p));
  return nums.every((n) => isFinite(n) && n > 0) ? nums : undefined;
}

export default function NozzlesScreen() {
  const [nozzles, setNozzles] = useState("12, 12, 12");
  const [mud, setMud] = useState("10");
  const [bitDia, setBitDia] = useState("8.5");
  const [cd, setCd] = useState("0.95");
  const [pumpP, setPumpP] = useState("");
  const [gpms, setGpms] = useState("150, 200, 250, 300, 350, 400, 450, 500");

  const data = useMemo(() => {
    const nz = parseList(nozzles);
    const qs = parseList(gpms);
    const mudN = num(mud);
    const cdN = num(cd);
    if (!nz || !qs || mudN === undefined || mudN <= 0) return undefined;
    const tfa = totalFlowAreaIn2(nz);
    const rows = bitHydraulicsTable(
      {
        nozzles32nds: nz,
        mudPpg: mudN,
        bitDiameterIn: num(bitDia),
        cd: cdN && cdN > 0 ? cdN : undefined,
        pumpPressurePsi: num(pumpP),
      },
      qs,
    );
    return { tfa, rows };
  }, [nozzles, mud, bitDia, cd, pumpP, gpms]);

  return (
    <Screen>
      <Note text="Nozzle sizes in 32nds of an inch (e.g. 12, 12, 13). ΔP = MW·Q² / (12031·Cd²·TFA²) with Cd = 0.95 by default." />
      <Section title="Bit & mud">
        <TextField label="Nozzles (32nds, comma separated)" value={nozzles} onChangeText={setNozzles} placeholder="12, 12, 12" />
        <Row>
          <NumField label="Mud weight" suffix="ppg" value={mud} onChangeText={setMud} />
          <NumField label="Bit diameter" suffix="in" value={bitDia} onChangeText={setBitDia} />
        </Row>
        <Row>
          <NumField label="Discharge coeff. Cd" value={cd} onChangeText={setCd} />
          <NumField label="Pump pressure (opt.)" suffix="psi" value={pumpP} onChangeText={setPumpP} />
        </Row>
        <TextField label="Flow rates (gpm, comma separated)" value={gpms} onChangeText={setGpms} />
      </Section>

      {data ? (
        <>
          <Results title="Total flow area">
            <ResultRow label="TFA" value={fmt(data.tfa, 4)} unit="in²" strong />
          </Results>
          <Results title="Hydraulics vs flow rate">
            <View style={st.head}>
              <Text style={[st.col, { flex: 0.8 }]}>gpm</Text>
              <Text style={st.col}>ΔP bit (psi)</Text>
              <Text style={st.col}>Vn (ft/s)</Text>
              <Text style={st.col}>HHP</Text>
              <Text style={[st.col, { flex: 0.8 }]}>HSI</Text>
              <Text style={st.col}>IF (lbf)</Text>
            </View>
            {data.rows.map((r) => (
              <View key={r.gpm} style={st.row}>
                <Text style={[st.cell, { flex: 0.8, color: C.blue, fontWeight: "700" }]}>{r.gpm}</Text>
                <Text style={[st.cell, { color: C.accent, fontWeight: "700" }]}>{fmt(r.pressureDropPsi, 0)}</Text>
                <Text style={st.cell}>{fmt(r.nozzleVelocityFtS, 0)}</Text>
                <Text style={st.cell}>{fmt(r.hydraulicHp, 0)}</Text>
                <Text style={[st.cell, { flex: 0.8 }]}>{r.hsi !== undefined ? fmt(r.hsi, 2) : "—"}</Text>
                <Text style={st.cell}>{fmt(r.impactForceLbs, 0)}</Text>
              </View>
            ))}
          </Results>
          <Note text="Rules of thumb: HSI 2.5–5 for good bottom-hole cleaning; bit ΔP ≈ 50–65% of pump pressure for max impact force / hydraulic horsepower." />
        </>
      ) : (
        <ErrorBox message="Enter nozzle sizes, mud weight and at least one flow rate." />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#1E3A4F" },
  col: { flex: 1, color: C.blue, fontSize: 11, fontWeight: "700" },
  row: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#1E3A4F" },
  cell: { flex: 1, color: C.text, fontSize: 12 },
});
