import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { color, DARK_COLORS, LIGHT_COLORS, type ColorPalette } from "./theme";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedScheme = "light" | "dark";

const STORAGE_KEY = "pamarket.theme-preference";

function applyPalette(palette: ColorPalette) {
  // Mutate the shared `color` object in place so any inline `style={{ color:
  // color.text }}` read at render time (not captured by StyleSheet.create())
  // picks up the new palette immediately, and so code outside React (e.g.
  // native module calls) that reads `color.foo` directly stays in sync.
  // This does NOT retint StyleSheet.create() blocks — those are handled per
  // screen by the useThemedStyles() hook below, keyed on resolvedScheme.
  (Object.keys(palette) as (keyof ColorPalette)[]).forEach((key) => {
    color[key] = palette[key];
  });
}

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedScheme: ResolvedScheme;
  setPreference: (pref: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  preference: "light",
  resolvedScheme: "light",
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPreferenceState(stored);
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  const resolvedScheme: ResolvedScheme = useMemo(() => {
    if (preference === "system") return systemScheme === "dark" ? "dark" : "light";
    return preference;
  }, [preference, systemScheme]);

  useEffect(() => {
    applyPalette(resolvedScheme === "dark" ? DARK_COLORS : LIGHT_COLORS);
  }, [resolvedScheme]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    SecureStore.setItemAsync(STORAGE_KEY, pref).catch(() => {});
  }, []);

  if (!hydrated) return null;

  return (
    <ThemeContext.Provider value={{ preference, resolvedScheme, setPreference }}>{children}</ThemeContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemeContext);
}

// Rebuilds a StyleSheet from `builder(palette)` whenever the resolved scheme
// changes. `builder` receives the ACTIVE palette object directly (not the
// mutable `color` export) so values are correct even before/without the
// `applyPalette` mutation effect having run. This is the mechanism that
// makes StyleSheet.create()-based screens actually go dark — see
// lib/theme.ts header comment for why plain mutation alone can't do it.
export function useThemedStyles<T>(builder: (palette: ColorPalette) => T): T {
  const { resolvedScheme } = useThemePreference();
  return useMemo(() => builder(resolvedScheme === "dark" ? DARK_COLORS : LIGHT_COLORS), [resolvedScheme, builder]);
}
