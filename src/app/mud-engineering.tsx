import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Btn,
  C,
  ErrorBox,
  NumField,
  Note,
  Results,
  ResultRow,
  Row,
  Screen,
  SegButtons,
  Section,
  fmt,
} from "@/components/ui";
import {
  DENSITY_UNIT_LABELS,
  DensityUnit,
  FUNCTIONS,
  INVALID_NUMBER,
  MudFunction,
  VOLUME_UNIT_LABELS,
  VolumeUnit,
  addBarite,
  addOilToOilMud,
  addWaterToOilMud,
  adjustOwr,
  cutWeightConstantVolume,
  cutWeightVolumeIncrease,
  densityFromSg,
  densityToSg,
  m3PerVolume,
  mixMuds,
  mixOilMud,
  mixWaterMud,
  slugFlowback,
  waterContamination,
  weightUpConstantVolume,
  weightUpVolumeIncrease,
} from "@/lib/mudcalc";

type FieldUnit = "density" | "volume" | "percent" | "sg" | "mt";

interface FieldDef {
  key: string;
  label: string;
  unit: FieldUnit;
}

/** Inputs per function — labels reproduced verbatim from the EXE form. */
const FIELDS: Record<number, FieldDef[]> = {
  0: [
    { key: "d1", label: "Initial mud density", unit: "density" },
    { key: "d2", label: "Desired mud density", unit: "density" },
    { key: "v1", label: "Starting volume of mud", unit: "volume" },
    { key: "agent", label: "SG of Weighting Agent", unit: "sg" },
  ],
  1: [
    { key: "d1", label: "Initial mud density", unit: "density" },
    { key: "d2", label: "Desired mud density", unit: "density" },
    { key: "v1", label: "Starting volume of mud", unit: "volume" },
    { key: "agent", label: "SG of Weighting Agent", unit: "sg" },
  ],
  2: [
    { key: "d1", label: "Initial mud density", unit: "density" },
    { key: "d2", label: "Desired mud density", unit: "density" },
    { key: "v1", label: "Starting volume of mud", unit: "volume" },
    { key: "dil", label: "Density of diluting fluid", unit: "density" },
  ],
  3: [
    { key: "d1", label: "Initial mud density", unit: "density" },
    { key: "d2", label: "Desired mud density", unit: "density" },
    { key: "v1", label: "Starting volume of mud", unit: "volume" },
    { key: "dil", label: "Density of diluting fluid", unit: "density" },
  ],
  4: [
    { key: "d1", label: "Density first fluid", unit: "density" },
    { key: "v1", label: "Volume first fluid", unit: "volume" },
    { key: "d2", label: "Density second fluid", unit: "density" },
    { key: "v2", label: "Volume second fluid", unit: "volume" },
    { key: "d3", label: "Density third fluid", unit: "density" },
    { key: "v3", label: "Volume third fluid", unit: "volume" },
  ],
  5: [
    { key: "owr1", label: "Starting OWR (oil %)", unit: "percent" },
    { key: "owr2", label: "Desired OWR (oil %)", unit: "percent" },
    { key: "v1", label: "Initial mud volume", unit: "volume" },
    { key: "oilpct", label: "Current Oil Percent", unit: "percent" },
    { key: "d1", label: "Density of mud", unit: "density" },
    { key: "oilsg", label: "SG of oil", unit: "sg" },
  ],
  6: [
    { key: "barite", label: "Weight Barite to add", unit: "mt" },
    { key: "d1", label: "Initial mud density", unit: "density" },
    { key: "v1", label: "Initial volume of mud", unit: "volume" },
  ],
  7: [
    { key: "water", label: "Water volume", unit: "volume" },
    { key: "d1", label: "Initial mud density", unit: "density" },
    { key: "v1", label: "Initial volume of mud", unit: "volume" },
    { key: "owr1", label: "Initial OWR (oil)", unit: "percent" },
    { key: "oilpct", label: "Initial Oil Percent", unit: "percent" },
  ],
  8: [
    { key: "oil", label: "Oil volume", unit: "volume" },
    { key: "oild", label: "Density of oil", unit: "density" },
    { key: "d1", label: "Initial mud density", unit: "density" },
    { key: "v1", label: "Initial volume of mud", unit: "volume" },
    { key: "owr1", label: "Initial OWR (oil)", unit: "percent" },
    { key: "oilpct", label: "Initial Oil Percent", unit: "percent" },
  ],
  9: [
    { key: "d1", label: "Initial mud density", unit: "density" },
    { key: "d2", label: "Contam'd mud density", unit: "density" },
    { key: "owr1", label: "Initial OWR (oil)", unit: "percent" },
    { key: "oilpct", label: "Initial Oil Percent", unit: "percent" },
    { key: "v1", label: "Initial volume of mud", unit: "volume" },
  ],
  10: [
    { key: "v1", label: "Volume of mud", unit: "volume" },
    { key: "d1", label: "Mud density", unit: "density" },
    { key: "agent", label: "SG of weight material", unit: "sg" },
  ],
  11: [
    { key: "d1", label: "Mud density", unit: "density" },
    { key: "v1", label: "Volume of mud", unit: "volume" },
    { key: "oilpct", label: "Oil Percent", unit: "percent" },
    { key: "agent", label: "SG of weight material", unit: "sg" },
    { key: "oilsg", label: "SG of oil", unit: "sg" },
  ],
  12: [
    { key: "d1", label: "Mud density", unit: "density" },
    { key: "d2", label: "Slug density", unit: "density" },
    { key: "v1", label: "Volume of slug", unit: "volume" },
  ],
};

interface OutLine {
  label: string;
  value: number;
  kind: "density" | "volume" | "mt";
  value2?: number; // OWR water side
}

export default function MudEngineeringScreen() {
  const [densityUnit, setDensityUnit] = useState<DensityUnit>("ppg");
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>("bbls");
  const [fnIndex, setFnIndex] = useState(0);
  const [vals, setVals] = useState<Record<string, string>>({});

  const fields = FIELDS[fnIndex];
  const dLabel = DENSITY_UNIT_LABELS[densityUnit];
  const vLabel = VOLUME_UNIT_LABELS[volumeUnit];

  const set = (key: string, t: string) => setVals((s) => ({ ...s, [key]: t }));

  const unitFor = (u: FieldUnit) =>
    u === "density" ? dLabel : u === "volume" ? vLabel : u === "percent" ? "%" : u === "mt" ? "MT" : "SG";

  const result = useMemo<{ lines: OutLine[] } | { error: string } | null>(() => {
    // parse every field for the current function
    const p: Record<string, number> = {};
    for (const f of fields) {
      const raw = vals[f.key];
      if (raw === undefined || raw.trim() === "") return null;
      const n = Number(raw.replace(",", "."));
      if (!isFinite(n)) return { error: INVALID_NUMBER };
      p[f.key] = n;
    }
    const m3f = m3PerVolume(volumeUnit);
    const toSg = (v: number) => densityToSg(v, densityUnit);

    try {
      switch (fnIndex) {
        case 0: {
          const r = weightUpVolumeIncrease(p.v1, toSg(p.d1), toSg(p.d2), p.agent, m3f);
          return {
            lines: [
              { label: "Wt of Barite = ", value: r.bariteMt, kind: "mt" },
              { label: "Volume increase = ", value: r.volumeIncrease, kind: "volume" },
            ],
          };
        }
        case 1: {
          const r = weightUpConstantVolume(p.v1, toSg(p.d1), toSg(p.d2), p.agent, m3f);
          return {
            lines: [
              { label: "For Constant Volume jet = ", value: r.jet, kind: "volume" },
              { label: "Wt of Barite = ", value: r.bariteMt, kind: "mt" },
            ],
          };
        }
        case 2: {
          const v = cutWeightVolumeIncrease(p.v1, toSg(p.d1), toSg(p.d2), toSg(p.dil));
          return { lines: [{ label: "Volume required = ", value: v, kind: "volume" }] };
        }
        case 3: {
          const v = cutWeightConstantVolume(p.v1, toSg(p.d1), toSg(p.d2), toSg(p.dil));
          return { lines: [{ label: "For Constant Volume jet/add = ", value: v, kind: "volume" }] };
        }
        case 4: {
          const r = mixMuds([
            { density: toSg(p.d1), volume: p.v1 },
            { density: toSg(p.d2), volume: p.v2 },
            { density: toSg(p.d3), volume: p.v3 },
          ]);
          return {
            lines: [
              { label: "Density of mixture ", value: r.density, kind: "density" },
              { label: "Volume of mixture ", value: r.volume, kind: "volume" },
            ],
          };
        }
        case 5: {
          const r = adjustOwr(p.v1, toSg(p.d1), p.owr1, p.owr2, p.oilpct, p.oilsg, m3f);
          return {
            lines: [
              { label: "Volume of Oil required ", value: r.oilRequired, kind: "volume" },
              { label: "Weight of Barite required to maintain mud wt ", value: r.bariteMt, kind: "mt" },
              { label: "Volume increase due to barite = ", value: r.volumeIncrease, kind: "volume" },
            ],
          };
        }
        case 6: {
          const r = addBarite(p.barite, toSg(p.d1), p.v1, m3f);
          return {
            lines: [
              { label: "Volume increase due to barite = ", value: r.volumeIncrease, kind: "volume" },
              { label: "Weight of mud after addition of Barite ", value: r.newDensity, kind: "density" },
            ],
          };
        }
        case 7: {
          const r = addWaterToOilMud(p.water, toSg(p.d1), p.v1, p.owr1, p.oilpct);
          return {
            lines: [
              { label: "Weight of mud after addition of Water ", value: r.newDensity, kind: "density" },
              { label: "Resultant OWR after water addition = ", value: r.oilPct, kind: "density", value2: r.waterPct },
            ],
          };
        }
        case 8: {
          const r = addOilToOilMud(p.oil, toSg(p.oild), toSg(p.d1), p.v1, p.owr1, p.oilpct);
          return {
            lines: [
              { label: "Weight of mud after addition of Oil ", value: r.newDensity, kind: "density" },
              { label: "Resultant OWR after oil addition = ", value: r.oilPct, kind: "density", value2: r.waterPct },
            ],
          };
        }
        case 9: {
          const r = waterContamination(toSg(p.d1), toSg(p.d2), p.v1, p.owr1, p.oilpct);
          return {
            lines: [
              { label: "Volume of water contamination ", value: r.waterVolume, kind: "volume" },
              { label: "Resultant OWR after water contamination = ", value: r.oilPct, kind: "density", value2: r.waterPct },
            ],
          };
        }
        case 10: {
          const r = mixWaterMud(p.v1, toSg(p.d1), p.agent);
          return {
            lines: [
              { label: "Volume of water = ", value: r.waterVolume, kind: "volume" },
              { label: "  Volume Barite = ", value: r.bariteVolume, kind: "volume" },
            ],
          };
        }
        case 11: {
          const r = mixOilMud(toSg(p.d1), p.v1, p.oilpct, p.agent, p.oilsg);
          return {
            lines: [
              { label: "Volume of water = ", value: r.waterVolume, kind: "volume" },
              { label: "Volume of oil = ", value: r.oilVolume, kind: "volume" },
              { label: "  Volume Barite = ", value: r.bariteVolume, kind: "volume" },
            ],
          };
        }
        case 12: {
          const v = slugFlowback(toSg(p.d1), toSg(p.d2), p.v1);
          return { lines: [{ label: "Flowback volume of mud = ", value: v, kind: "volume" }] };
        }
        default:
          return null;
      }
    } catch {
      return { error: INVALID_NUMBER };
    }
  }, [fnIndex, fields, vals, densityUnit, volumeUnit]);

  const renderLine = (l: OutLine, i: number) => {
    if (l.value2 !== undefined) {
      return <ResultRow key={i} label={l.label} value={`${fmt(l.value, 0)} / ${fmt(l.value2, 0)}`} strong />;
    }
    if (l.kind === "density") {
      return <ResultRow key={i} label={l.label} value={fmt(densityFromSg(l.value, densityUnit), 3)} unit={dLabel} strong />;
    }
    if (l.kind === "mt") {
      return <ResultRow key={i} label={l.label} value={fmt(l.value, 3)} unit="MT" strong />;
    }
    return <ResultRow key={i} label={l.label} value={fmt(l.value, 2)} unit={vLabel} strong />;
  };

  return (
    <Screen>
      <Note text="Mud Engineering Calculator — Bruce Guthrie. Select units, pick a function, enter the values and calculate." />

      <Section title="Select Units">
        <Text style={st.subLabel}>Density</Text>
        <SegButtons
          options={[
            { label: "PPG", value: "ppg" },
            { label: "SG", value: "sg" },
            { label: "PSI/1000 ft", value: "psi1000" },
          ]}
          value={densityUnit}
          onChange={setDensityUnit}
        />
        <Text style={st.subLabel}>Volume</Text>
        <SegButtons
          options={[
            { label: "bbls", value: "bbls" },
            { label: "m³", value: "m3" },
          ]}
          value={volumeUnit}
          onChange={setVolumeUnit}
        />
      </Section>

      <Section title="Function">
        {FUNCTIONS.map((f: MudFunction, i) => {
          const active = i === fnIndex;
          return (
            <Pressable
              key={f}
              onPress={() => {
                setFnIndex(i);
                setVals({});
              }}
              style={[st.fnRow, active && st.fnRowActive]}
            >
              <View style={[st.radio, active && st.radioActive]}>
                {active ? <View style={st.radioDot} /> : null}
              </View>
              <Text style={[st.fnText, active && st.fnTextActive]}>{f}</Text>
            </Pressable>
          );
        })}
      </Section>

      <Section title={FUNCTIONS[fnIndex]}>
        {chunk(fields, 2).map((pair, ri) => (
          <Row key={ri}>
            {pair.map((f) => (
              <NumField
                key={f.key}
                label={f.label}
                suffix={unitFor(f.unit)}
                value={vals[f.key] ?? ""}
                onChangeText={(t) => set(f.key, t)}
              />
            ))}
            {pair.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </Row>
        ))}
      </Section>

      {result && "error" in result ? <ErrorBox message={result.error} /> : null}
      {result && "lines" in result ? (
        <Results title="Results">{result.lines.map(renderLine)}</Results>
      ) : null}
      {!result ? (
        <Btn title="Enter all values to calculate" kind="ghost" onPress={() => {}} />
      ) : null}
    </Screen>
  );
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const st = StyleSheet.create({
  subLabel: { color: C.sub, fontSize: 12, marginBottom: 5 },
  fnRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  fnRowActive: {},
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: C.sub,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: C.accent },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent },
  fnText: { color: C.sub, fontSize: 14, flex: 1 },
  fnTextActive: { color: C.text, fontWeight: "700" },
});
