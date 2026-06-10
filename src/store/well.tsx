/**
 * Persistent well configuration (drill string + hole/casing sections).
 * Feeds the kill sheet, hydraulics and volume calculations.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { HoleSection, StringComponent } from "@/lib/well";

export interface WellConfig {
  string: StringComponent[];
  holes: HoleSection[];
}

export const DEFAULT_WELL: WellConfig = {
  string: [
    { name: '5" DP 19.5#', odIn: 5, idIn: 4.276, weightPpf: 19.5, lengthFt: 8400 },
    { name: '5" HWDP 49.3#', odIn: 5, idIn: 3.0, weightPpf: 49.3, lengthFt: 600 },
    { name: '6-1/2" DC', odIn: 6.5, idIn: 2.8125, weightPpf: 91.6, lengthFt: 600 },
  ],
  holes: [
    { name: '9-5/8" 47# casing', idIn: 8.681, bottomMd: 5000, cased: true },
    { name: '8-1/2" open hole', idIn: 8.5, bottomMd: 9600, cased: false },
  ],
};

/** Quick-add catalogs of common sizes */
export const STRING_CATALOG: Omit<StringComponent, "lengthFt">[] = [
  { name: '5-1/2" DP 24.7#', odIn: 5.5, idIn: 4.67, weightPpf: 24.7 },
  { name: '5" DP 19.5#', odIn: 5, idIn: 4.276, weightPpf: 19.5 },
  { name: '4" DP 14#', odIn: 4, idIn: 3.34, weightPpf: 14 },
  { name: '3-1/2" DP 13.3#', odIn: 3.5, idIn: 2.764, weightPpf: 13.3 },
  { name: '5" HWDP 49.3#', odIn: 5, idIn: 3.0, weightPpf: 49.3 },
  { name: '3-1/2" HWDP 25.3#', odIn: 3.5, idIn: 2.0625, weightPpf: 25.3 },
  { name: '8" DC', odIn: 8, idIn: 2.8125, weightPpf: 147 },
  { name: '6-1/2" DC', odIn: 6.5, idIn: 2.8125, weightPpf: 91.6 },
  { name: '4-3/4" DC', odIn: 4.75, idIn: 2.25, weightPpf: 46.7 },
];

export const HOLE_CATALOG: Omit<HoleSection, "bottomMd">[] = [
  { name: '20" 94# casing', idIn: 19.124, cased: true },
  { name: '13-3/8" 68# casing', idIn: 12.415, cased: true },
  { name: '9-5/8" 47# casing', idIn: 8.681, cased: true },
  { name: '9-5/8" 40# casing', idIn: 8.835, cased: true },
  { name: '7" 29# casing', idIn: 6.184, cased: true },
  { name: '7" 26# liner', idIn: 6.276, cased: true },
  { name: '17-1/2" open hole', idIn: 17.5, cased: false },
  { name: '12-1/4" open hole', idIn: 12.25, cased: false },
  { name: '8-1/2" open hole', idIn: 8.5, cased: false },
  { name: '6" open hole', idIn: 6, cased: false },
];

const KEY = "drillcalc.well.v1";

interface WellCtx {
  well: WellConfig;
  setWell: (w: WellConfig) => void;
  reset: () => void;
  loaded: boolean;
}

const Ctx = createContext<WellCtx>({
  well: DEFAULT_WELL,
  setWell: () => {},
  reset: () => {},
  loaded: false,
});

export function WellProvider({ children }: { children: React.ReactNode }) {
  const [well, setWellState] = useState<WellConfig>(DEFAULT_WELL);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as WellConfig;
          if (Array.isArray(parsed.string) && Array.isArray(parsed.holes)) {
            setWellState(parsed);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setWell = (w: WellConfig) => {
    setWellState(w);
    AsyncStorage.setItem(KEY, JSON.stringify(w)).catch(() => {});
  };

  const value = useMemo(
    () => ({
      well,
      setWell,
      reset: () => setWell(DEFAULT_WELL),
      loaded,
    }),
    [well, loaded],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWell() {
  return useContext(Ctx);
}
