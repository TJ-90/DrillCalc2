import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Btn,
  C,
  ErrorBox,
  NumField,
  Note,
  ResultRow,
  Results,
  Row,
  Screen,
  SegButtons,
  Section,
  TextField,
  fmt,
  num,
} from "@/components/ui";
import {
  HoleSection,
  StringComponent,
  annulusSegments,
  annulusVolumeSplit,
  stringAirWeightLbs,
  stringBottomMd,
  stringCapacityBbl,
  stringDisplacementBbl,
} from "@/lib/well";
import { HOLE_CATALOG, STRING_CATALOG, useWell } from "@/store/well";

interface StringRow {
  name: string;
  od: string;
  id: string;
  ppf: string;
  len: string;
}
interface HoleRow {
  name: string;
  id: string;
  bottom: string;
  cased: boolean;
}

export default function WellConfigScreen() {
  const { well, setWell, reset } = useWell();
  const [stringRows, setStringRows] = useState<StringRow[]>(
    well.string.map((c) => ({
      name: c.name,
      od: String(c.odIn),
      id: String(c.idIn),
      ppf: String(c.weightPpf),
      len: String(c.lengthFt),
    })),
  );
  const [holeRows, setHoleRows] = useState<HoleRow[]>(
    well.holes.map((h) => ({
      name: h.name,
      id: String(h.idIn),
      bottom: String(h.bottomMd),
      cased: h.cased,
    })),
  );
  const [saved, setSaved] = useState(false);

  const parsed = useMemo(() => {
    const string: StringComponent[] = [];
    for (const r of stringRows) {
      const od = num(r.od);
      const id = num(r.id);
      const ppf = num(r.ppf);
      const len = num(r.len);
      if (od === undefined || id === undefined || ppf === undefined || len === undefined) {
        return { error: `Fill all numbers for "${r.name || "unnamed component"}"` };
      }
      if (id >= od) return { error: `"${r.name}": ID must be smaller than OD` };
      string.push({ name: r.name || "component", odIn: od, idIn: id, weightPpf: ppf, lengthFt: len });
    }
    const holes: HoleSection[] = [];
    for (const r of holeRows) {
      const id = num(r.id);
      const bottom = num(r.bottom);
      if (id === undefined || bottom === undefined) {
        return { error: `Fill all numbers for "${r.name || "unnamed section"}"` };
      }
      holes.push({ name: r.name || "section", idIn: id, bottomMd: bottom, cased: r.cased });
    }
    return { string, holes };
  }, [stringRows, holeRows]);

  const summary = useMemo(() => {
    if ("error" in parsed) return undefined;
    const segs = annulusSegments(parsed.string, parsed.holes);
    return {
      bitMd: stringBottomMd(parsed.string),
      capacity: stringCapacityBbl(parsed.string),
      displacement: stringDisplacementBbl(parsed.string),
      airWeight: stringAirWeightLbs(parsed.string),
      split: annulusVolumeSplit(segs),
    };
  }, [parsed]);

  const updateString = (i: number, patch: Partial<StringRow>) => {
    setSaved(false);
    setStringRows((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  const updateHole = (i: number, patch: Partial<HoleRow>) => {
    setSaved(false);
    setHoleRows((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  return (
    <Screen>
      <Note text="Components are ordered from surface down. Volumes computed here feed the kill sheet and hydraulics calculators." />

      <Section title="Drill string (surface → bit)">
        {stringRows.map((r, i) => (
          <View key={i} style={s.itemCard}>
            <View style={s.itemHead}>
              <View style={{ flex: 1 }}>
                <TextField label="Name" value={r.name} onChangeText={(t) => updateString(i, { name: t })} />
              </View>
              <Pressable onPress={() => { setSaved(false); setStringRows((rows) => rows.filter((_, j) => j !== i)); }}>
                <Text style={s.remove}>✕</Text>
              </Pressable>
            </View>
            <Row>
              <NumField label="OD" suffix="in" value={r.od} onChangeText={(t) => updateString(i, { od: t })} />
              <NumField label="ID" suffix="in" value={r.id} onChangeText={(t) => updateString(i, { id: t })} />
            </Row>
            <Row>
              <NumField label="Weight" suffix="ppf" value={r.ppf} onChangeText={(t) => updateString(i, { ppf: t })} />
              <NumField label="Length" suffix="ft" value={r.len} onChangeText={(t) => updateString(i, { len: t })} />
            </Row>
          </View>
        ))}
        <Text style={s.catalogLabel}>Quick add:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {STRING_CATALOG.map((c) => (
            <Pressable
              key={c.name}
              style={s.chip}
              onPress={() => {
                setSaved(false);
                setStringRows((rows) => [
                  ...rows,
                  { name: c.name, od: String(c.odIn), id: String(c.idIn), ppf: String(c.weightPpf), len: "0" },
                ]);
              }}
            >
              <Text style={s.chipText}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Btn
          kind="ghost"
          title="+ Add custom component"
          onPress={() => {
            setSaved(false);
            setStringRows((rows) => [...rows, { name: "", od: "", id: "", ppf: "", len: "" }]);
          }}
        />
      </Section>

      <Section title="Hole / casing sections (surface → TD)">
        {holeRows.map((r, i) => (
          <View key={i} style={s.itemCard}>
            <View style={s.itemHead}>
              <View style={{ flex: 1 }}>
                <TextField label="Name" value={r.name} onChangeText={(t) => updateHole(i, { name: t })} />
              </View>
              <Pressable onPress={() => { setSaved(false); setHoleRows((rows) => rows.filter((_, j) => j !== i)); }}>
                <Text style={s.remove}>✕</Text>
              </Pressable>
            </View>
            <Row>
              <NumField label="ID / hole size" suffix="in" value={r.id} onChangeText={(t) => updateHole(i, { id: t })} />
              <NumField label="Bottom MD" suffix="ft" value={r.bottom} onChangeText={(t) => updateHole(i, { bottom: t })} />
            </Row>
            <SegButtons
              options={[
                { label: "Cased", value: "cased" },
                { label: "Open hole", value: "open" },
              ]}
              value={r.cased ? "cased" : "open"}
              onChange={(v) => updateHole(i, { cased: v === "cased" })}
            />
          </View>
        ))}
        <Text style={s.catalogLabel}>Quick add:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {HOLE_CATALOG.map((c) => (
            <Pressable
              key={c.name}
              style={s.chip}
              onPress={() => {
                setSaved(false);
                setHoleRows((rows) => [
                  ...rows,
                  { name: c.name, id: String(c.idIn), bottom: "0", cased: c.cased },
                ]);
              }}
            >
              <Text style={s.chipText}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Btn
          kind="ghost"
          title="+ Add custom section"
          onPress={() => {
            setSaved(false);
            setHoleRows((rows) => [...rows, { name: "", id: "", bottom: "", cased: false }]);
          }}
        />
      </Section>

      {"error" in parsed ? <ErrorBox message={parsed.error!} /> : null}

      {summary && (
        <Results title="Computed volumes">
          <ResultRow label="Bit depth (MD)" value={fmt(summary.bitMd, 0)} unit="ft" />
          <ResultRow label="String internal volume" value={fmt(summary.capacity, 1)} unit="bbl" strong />
          <ResultRow label="String displacement (steel)" value={fmt(summary.displacement, 1)} unit="bbl" />
          <ResultRow label="String weight in air" value={fmt(summary.airWeight / 1000, 1)} unit="klbs" />
          <ResultRow label="Annulus — open hole" value={fmt(summary.split.openHoleBbl, 1)} unit="bbl" strong />
          <ResultRow label="Annulus — cased hole" value={fmt(summary.split.casedBbl, 1)} unit="bbl" strong />
          {summary.split.noPipeBbl > 0.01 ? (
            <ResultRow label="Rathole / no-pipe volume" value={fmt(summary.split.noPipeBbl, 1)} unit="bbl" />
          ) : null}
        </Results>
      )}

      <Btn
        title={saved ? "✓ Saved" : "Save well configuration"}
        onPress={() => {
          if (!("error" in parsed)) {
            setWell({ string: parsed.string!, holes: parsed.holes! });
            setSaved(true);
          }
        }}
      />
      <View style={{ height: 8 }} />
      <Btn
        kind="danger"
        title="Reset to example well"
        onPress={() => {
          reset();
          setStringRows(
            well.string.map((c) => ({
              name: c.name, od: String(c.odIn), id: String(c.idIn), ppf: String(c.weightPpf), len: String(c.lengthFt),
            })),
          );
        }}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  itemCard: {
    backgroundColor: C.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    marginBottom: 10,
  },
  itemHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  remove: { color: C.danger, fontSize: 18, padding: 8 },
  catalogLabel: { color: C.sub, fontSize: 12, marginBottom: 6 },
  chip: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipText: { color: C.accent, fontSize: 12, fontWeight: "600" },
});
