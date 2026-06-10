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
  Warnings,
  fmt,
  num,
} from "@/components/ui";
import { computeKillSheet } from "@/lib/killsheet";
import { annulusSegments, annulusVolumeSplit, stringBottomMd, stringCapacityBbl } from "@/lib/well";
import { useWell } from "@/store/well";

export default function KillSheetScreen() {
  const { well } = useWell();
  const [mode, setMode] = useState<"vertical" | "directional">("vertical");
  const [volSource, setVolSource] = useState<"config" | "manual">("config");

  const [tvd, setTvd] = useState("10000");
  const [md, setMd] = useState("");
  const [shoeTvd, setShoeTvd] = useState("5000");
  const [shoeMd, setShoeMd] = useState("");
  const [mud, setMud] = useState("9.6");
  const [sidpp, setSidpp] = useState("");
  const [sicp, setSicp] = useState("");
  const [pitGain, setPitGain] = useState("");
  const [scr, setScr] = useState("");
  const [spm, setSpm] = useState("30");
  const [pumpOut, setPumpOut] = useState("0.119");
  const [lot, setLot] = useState("");
  const [mStr, setMStr] = useState("");
  const [mOh, setMOh] = useState("");
  const [mCased, setMCased] = useState("");

  const cfg = useMemo(() => {
    const segs = annulusSegments(well.string, well.holes);
    const split = annulusVolumeSplit(segs);
    const pipeSegs = segs.filter((x) => x.pipeOdIn > 0);
    return {
      stringVol: stringCapacityBbl(well.string),
      ohVol: split.openHoleBbl,
      casedVol: split.casedBbl,
      bitMd: stringBottomMd(well.string),
      bhaAnnCap: pipeSegs.length > 0 ? pipeSegs[pipeSegs.length - 1].capacityBblFt : undefined,
    };
  }, [well]);

  const directional = mode === "directional";

  const result = useMemo(() => {
    const tvdN = num(tvd);
    const mudN = num(mud);
    const sidppN = num(sidpp);
    const sicpN = num(sicp);
    const scrN = num(scr);
    const outN = num(pumpOut);
    const shoeTvdN = num(shoeTvd);
    const sv = volSource === "config" ? cfg.stringVol : num(mStr);
    const ov = volSource === "config" ? cfg.ohVol : num(mOh);
    const cv = volSource === "config" ? cfg.casedVol : num(mCased);
    if (
      tvdN === undefined || mudN === undefined || sidppN === undefined || sicpN === undefined ||
      scrN === undefined || outN === undefined || shoeTvdN === undefined ||
      sv === undefined || ov === undefined || cv === undefined
    ) {
      return undefined;
    }
    if (tvdN <= 0 || outN <= 0 || mudN <= 0) return undefined;
    try {
      return computeKillSheet({
        directional,
        tvdFt: tvdN,
        mdFt: directional ? num(md) : undefined,
        shoeTvdFt: shoeTvdN,
        shoeMdFt: directional ? num(shoeMd) : undefined,
        currentMudPpg: mudN,
        sidppPsi: sidppN,
        sicpPsi: sicpN,
        pitGainBbl: num(pitGain),
        scrPsi: scrN,
        scrSpm: num(spm),
        pumpOutputBblStk: outN,
        lotEmwPpg: num(lot),
        drillStringVolumeBbl: sv,
        annulusOpenHoleBbl: ov,
        annulusCasedBbl: cv,
        bhaAnnularCapacityBblFt: cfg.bhaAnnCap,
      });
    } catch {
      return undefined;
    }
  }, [directional, tvd, md, shoeTvd, shoeMd, mud, sidpp, sicp, pitGain, scr, spm, pumpOut, lot, volSource, mStr, mOh, mCased, cfg]);

  return (
    <Screen>
      <SegButtons
        options={[
          { label: "Vertical well", value: "vertical" },
          { label: "Directional well", value: "directional" },
        ]}
        value={mode}
        onChange={setMode}
      />
      {!directional && <Note text="Vertical well: MD = TVD, so measured depths are hidden." />}
      {directional && (
        <Note text="Directional well: pressures use TVD, volumes/strokes use MD lengths. Enter both." />
      )}

      <Section title="Well & shut-in data">
        <Row>
          <NumField label="Hole TVD" suffix="ft" value={tvd} onChangeText={setTvd} />
          {directional ? <NumField label="Hole MD" suffix="ft" value={md} onChangeText={setMd} /> : <View style={{ flex: 1 }} />}
        </Row>
        <Row>
          <NumField label="Shoe TVD" suffix="ft" value={shoeTvd} onChangeText={setShoeTvd} />
          {directional ? <NumField label="Shoe MD" suffix="ft" value={shoeMd} onChangeText={setShoeMd} /> : <View style={{ flex: 1 }} />}
        </Row>
        <Row>
          <NumField label="Current mud" suffix="ppg" value={mud} onChangeText={setMud} />
          <NumField label="LOT / FIT EMW" suffix="ppg" value={lot} onChangeText={setLot} />
        </Row>
        <Row>
          <NumField label="SIDPP" suffix="psi" value={sidpp} onChangeText={setSidpp} />
          <NumField label="SICP" suffix="psi" value={sicp} onChangeText={setSicp} />
        </Row>
        <NumField label="Pit gain" suffix="bbl" value={pitGain} onChangeText={setPitGain} />
      </Section>

      <Section title="Pump & kill rate">
        <Row>
          <NumField label="SCR pressure" suffix="psi" value={scr} onChangeText={setScr} />
          <NumField label="Kill rate" suffix="spm" value={spm} onChangeText={setSpm} />
        </Row>
        <NumField label="Pump output" suffix="bbl/stk" value={pumpOut} onChangeText={setPumpOut} />
      </Section>

      <Section title="Volumes">
        <SegButtons
          options={[
            { label: "From well config", value: "config" },
            { label: "Manual", value: "manual" },
          ]}
          value={volSource}
          onChange={setVolSource}
        />
        {volSource === "config" ? (
          <View>
            <ResultRow label="Drill string volume" value={fmt(cfg.stringVol, 1)} unit="bbl" />
            <ResultRow label="Annulus — open hole" value={fmt(cfg.ohVol, 1)} unit="bbl" />
            <ResultRow label="Annulus — cased" value={fmt(cfg.casedVol, 1)} unit="bbl" />
            <ResultRow label="Bit MD (well config)" value={fmt(cfg.bitMd, 0)} unit="ft" />
          </View>
        ) : (
          <View>
            <NumField label="Drill string volume" suffix="bbl" value={mStr} onChangeText={setMStr} />
            <Row>
              <NumField label="Annulus open hole" suffix="bbl" value={mOh} onChangeText={setMOh} />
              <NumField label="Annulus cased" suffix="bbl" value={mCased} onChangeText={setMCased} />
            </Row>
          </View>
        )}
      </Section>

      {result ? (
        <>
          <Warnings items={result.warnings} />
          <Results title="Kill data">
            <ResultRow label="Kill mud weight (rounded up)" value={fmt(result.killMudPpg, 1)} unit="ppg" strong />
            <ResultRow label="Kill mud weight (exact)" value={fmt(result.killMudExactPpg, 2)} unit="ppg" />
            <ResultRow label="ICP — initial circulating" value={fmt(result.initialCirculatingPressurePsi, 0)} unit="psi" strong />
            <ResultRow label="FCP — final circulating" value={fmt(result.finalCirculatingPressurePsi, 0)} unit="psi" strong />
            {result.maaspInitialPsi !== undefined && (
              <ResultRow label="MAASP (current mud)" value={fmt(result.maaspInitialPsi, 0)} unit="psi" />
            )}
            {result.maaspKillMudPsi !== undefined && (
              <ResultRow label="MAASP (kill mud)" value={fmt(result.maaspKillMudPsi, 0)} unit="psi" />
            )}
            <ResultRow
              label="Kill mud hydrostatic gain at TD"
              value={fmt(result.killMudHydrostaticGainPsi, 0)}
              unit="psi"
            />
          </Results>

          <Results title="Strokes & times">
            <ResultRow label="Surface → bit" value={fmt(result.surfaceToBitStrokes, 0)} unit="stk" strong />
            <ResultRow label="Bit → shoe" value={fmt(result.bitToShoeStrokes, 0)} unit="stk" />
            <ResultRow label="Shoe → surface" value={fmt(result.shoeToSurfaceStrokes, 0)} unit="stk" />
            <ResultRow label="Bit → surface" value={fmt(result.bitToSurfaceStrokes, 0)} unit="stk" />
            <ResultRow label="Total circulation" value={fmt(result.totalStrokes, 0)} unit="stk" strong />
            {result.surfaceToBitMin !== undefined && (
              <ResultRow label="Surface → bit time" value={fmt(result.surfaceToBitMin, 0)} unit="min" />
            )}
            {result.totalMin !== undefined && (
              <ResultRow label="Total time" value={fmt(result.totalMin, 0)} unit="min" />
            )}
          </Results>

          {result.influxHeightFt !== undefined && (
            <Results title="Influx estimate">
              <ResultRow label="Influx height" value={fmt(result.influxHeightFt, 0)} unit="ft" />
              <ResultRow label="Influx gradient" value={fmt(result.influxGradientPsiFt, 3)} unit="psi/ft" />
              <ResultRow label="Likely influx" value={result.influxType ?? "—"} strong />
            </Results>
          )}

          <Results title="Drill pipe pressure schedule (ICP → FCP)">
            <View style={st.schedHead}>
              <Text style={st.schedCol}>Strokes</Text>
              <Text style={st.schedCol}>bbl</Text>
              {result.schedule[0]?.timeMin !== undefined && <Text style={st.schedCol}>min</Text>}
              <Text style={[st.schedCol, { textAlign: "right" }]}>DP press (psi)</Text>
            </View>
            {result.schedule.map((r, i) => (
              <View key={i} style={st.schedRow}>
                <Text style={st.schedCell}>{r.strokes}</Text>
                <Text style={st.schedCell}>{fmt(r.volumeBbl, 0)}</Text>
                {r.timeMin !== undefined && <Text style={st.schedCell}>{fmt(r.timeMin, 1)}</Text>}
                <Text style={[st.schedCell, { textAlign: "right", color: C.accent, fontWeight: "700" }]}>
                  {fmt(r.pressurePsi, 0)}
                </Text>
              </View>
            ))}
          </Results>
        </>
      ) : (
        <ErrorBox message="Enter TVD, mud weight, SIDPP, SICP, SCR pressure, pump output and volumes to compute the kill sheet." />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  schedHead: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#1E3A4F",
  },
  schedCol: { flex: 1, color: C.blue, fontSize: 12, fontWeight: "700" },
  schedRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1E3A4F",
  },
  schedCell: { flex: 1, color: C.text, fontSize: 13 },
});
