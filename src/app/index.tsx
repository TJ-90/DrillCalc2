import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { C } from "@/components/ui";
import { useWell } from "@/store/well";
import { stringBottomMd } from "@/lib/well";

const ITEMS: { href: string; icon: string; title: string; sub: string }[] = [
  {
    href: "/well-config",
    icon: "🛢️",
    title: "Well Configuration",
    sub: "Drill string, casing & hole sections — feeds volumes everywhere",
  },
  { href: "/killsheet", icon: "🧯", title: "Kill Sheet", sub: "Vertical & directional — KMW, ICP/FCP, strokes, schedule" },
  { href: "/nozzles", icon: "💨", title: "Bit Nozzles / TFA", sub: "TFA, nozzle ΔP across GPMs, HSI, impact force" },
  { href: "/mud-wbm", icon: "💧", title: "Water Based Mud", sub: "Weight-up, dilution, blending" },
  { href: "/mud-obm", icon: "🛡️", title: "Oil Based Mud", sub: "Build OBM, oil/water ratio adjustments" },
  { href: "/jarring", icon: "🔨", title: "Jarring Weights", sub: "Up/down jarring, cock up/down hookloads" },
  { href: "/balanced-plug", icon: "🧱", title: "Balanced Cement Plug", sub: "Open hole, cased, across shoe, liner overlap" },
  { href: "/cement-conventional", icon: "🏗️", title: "Casing Cementation", sub: "Conventional two-plug job — volumes & displacement" },
  { href: "/cement-stabin", icon: "📍", title: "Stab-in Cementation", sub: "Inner-string job through drill pipe" },
  { href: "/hydraulics", icon: "📈", title: "Mud Hydraulics", sub: "System losses, pump pressure, ECD" },
];

export default function Home() {
  const { well } = useWell();
  const bit = stringBottomMd(well.string);
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
      <Text style={s.tagline}>
        Drilling field calculators — API field units (ft, in, ppg, psi, bbl, gpm)
      </Text>
      <Text style={s.wellSummary}>
        Active string: {well.string.length} components to {bit.toFixed(0)} ft · {well.holes.length}{" "}
        hole sections
      </Text>
      {ITEMS.map((it) => (
        <Link key={it.href} href={it.href as any} asChild>
          <Pressable style={s.card}>
            <Text style={s.icon}>{it.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{it.title}</Text>
              <Text style={s.sub}>{it.sub}</Text>
            </View>
            <Text style={s.chev}>›</Text>
          </Pressable>
        </Link>
      ))}
      <Text style={s.disclaimer}>
        Field estimates only. Always verify against your operator's approved kill sheet and
        cementing program before operational use.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  tagline: { color: C.sub, fontSize: 13, marginBottom: 4 },
  wellSummary: { color: C.accent, fontSize: 12, marginBottom: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  icon: { fontSize: 24 },
  title: { color: C.text, fontSize: 15, fontWeight: "700" },
  sub: { color: C.sub, fontSize: 12, marginTop: 2 },
  chev: { color: C.sub, fontSize: 24, fontWeight: "300" },
  disclaimer: { color: "#5B6678", fontSize: 11, marginTop: 14, lineHeight: 16 },
});
