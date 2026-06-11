import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { C } from "@/components/ui";
import { WellProvider } from "@/store/well";

export default function RootLayout() {
  return (
    <WellProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.text,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "DrillCalc" }} />
        <Stack.Screen name="well-config" options={{ title: "Well Configuration" }} />
        <Stack.Screen name="killsheet" options={{ title: "Kill Sheet" }} />
        <Stack.Screen name="nozzles" options={{ title: "Bit Nozzles / TFA" }} />
        <Stack.Screen name="mud-engineering" options={{ title: "Mud Engineering Calculator" }} />
        <Stack.Screen name="jarring" options={{ title: "Jarring Weights" }} />
        <Stack.Screen name="balanced-plug" options={{ title: "Balanced Cement Plug" }} />
        <Stack.Screen name="cement-conventional" options={{ title: "Casing Cementation" }} />
        <Stack.Screen name="cement-stabin" options={{ title: "Stab-in Cementation" }} />
        <Stack.Screen name="hydraulics" options={{ title: "Mud Hydraulics" }} />
      </Stack>
    </WellProvider>
  );
}
