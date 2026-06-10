import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** App palette — dark, high-contrast for rig floor use */
export const C = {
  bg: "#0E1116",
  card: "#171C24",
  border: "#2A3240",
  inputBg: "#0B0E13",
  text: "#E6EAF0",
  sub: "#8C97A8",
  accent: "#F5A623",
  blue: "#3B82F6",
  danger: "#F87171",
  ok: "#34D399",
};

export function fmt(x: number | undefined | null, dp = 2): string {
  if (x === undefined || x === null || !isFinite(x)) return "—";
  const r = x.toFixed(dp);
  // trim trailing zeros but keep at least one decimal when dp > 0
  return r.replace(/\.?0+$/, (m) => (m.startsWith(".") ? "" : m));
}

export function num(s: string): number | undefined {
  if (s.trim() === "") return undefined;
  const v = Number(s.replace(",", "."));
  return isFinite(v) ? v : undefined;
}

export function Screen({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={s.sectionSub}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

/** Side-by-side fields */
export function Row({ children }: { children: React.ReactNode }) {
  return <View style={s.row}>{children}</View>;
}

export function NumField({
  label,
  value,
  onChangeText,
  suffix,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? "0"}
          placeholderTextColor="#4A5568"
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
        {suffix ? <Text style={s.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#4A5568"
        />
      </View>
    </View>
  );
}

export function SegButtons<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.segWrap}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[s.segBtn, active && s.segBtnActive]}
          >
            <Text style={[s.segText, active && s.segTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Btn({
  title,
  onPress,
  kind = "primary",
}: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "ghost" | "danger";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.btn, kind === "ghost" && s.btnGhost, kind === "danger" && s.btnDanger]}
    >
      <Text
        style={[
          s.btnText,
          kind === "ghost" && { color: C.accent },
          kind === "danger" && { color: "#fff" },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function ResultRow({
  label,
  value,
  unit,
  strong,
}: {
  label: string;
  value: string;
  unit?: string;
  strong?: boolean;
}) {
  return (
    <View style={s.resultRow}>
      <Text style={[s.resultLabel, strong && { color: C.text }]}>{label}</Text>
      <Text style={[s.resultValue, strong && { color: C.accent, fontSize: 17 }]}>
        {value}
        {unit ? <Text style={s.resultUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export function Results({
  title = "Results",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.results}>
      <Text style={s.resultsTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function Warnings({ items }: { items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={s.warnBox}>
      {items.map((w, i) => (
        <Text key={i} style={s.warnText}>
          ⚠ {w}
        </Text>
      ))}
    </View>
  );
}

export function Note({ text }: { text: string }) {
  return <Text style={s.note}>{text}</Text>;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <View style={s.errBox}>
      <Text style={s.errText}>{message}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: "700", marginBottom: 10 },
  sectionSub: { color: C.sub, fontSize: 12, marginTop: -6, marginBottom: 10 },
  row: { flexDirection: "row", gap: 10 },
  field: { flex: 1, marginBottom: 10 },
  fieldLabel: { color: C.sub, fontSize: 12, marginBottom: 5 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  input: { flex: 1, color: C.text, fontSize: 16, paddingVertical: 10 },
  suffix: { color: C.sub, fontSize: 13, marginLeft: 6 },
  segWrap: {
    flexDirection: "row",
    backgroundColor: C.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 3,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  segBtn: {
    flexGrow: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  segBtnActive: { backgroundColor: C.accent },
  segText: { color: C.sub, fontSize: 13, fontWeight: "600" },
  segTextActive: { color: "#1A1408" },
  btn: {
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: C.accent,
  },
  btnDanger: { backgroundColor: "#7F1D1D" },
  btnText: { color: "#1A1408", fontWeight: "700", fontSize: 15 },
  results: {
    backgroundColor: "#12202B",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E3A4F",
    padding: 14,
    marginBottom: 14,
  },
  resultsTitle: { color: C.blue, fontSize: 13, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1E3A4F",
  },
  resultLabel: { color: C.sub, fontSize: 14, flex: 1, paddingRight: 8 },
  resultValue: { color: C.text, fontSize: 15, fontWeight: "700" },
  resultUnit: { color: C.sub, fontSize: 12, fontWeight: "400" },
  warnBox: {
    backgroundColor: "#2A1E10",
    borderColor: "#7C5A1E",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  warnText: { color: "#FBBF24", fontSize: 13, marginBottom: 4 },
  note: { color: C.sub, fontSize: 12, marginBottom: 12, lineHeight: 17 },
  errBox: {
    backgroundColor: "#2A1215",
    borderColor: "#7F1D1D",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errText: { color: C.danger, fontSize: 13 },
});
