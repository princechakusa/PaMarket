// PaMarket design system — single source of truth for visual language.
// Every screen/component should consume these tokens rather than hardcoding
// values, so the app reads as one deliberately-designed product.
//
// Dark mode: `color` is mutated IN PLACE by lib/theme-provider.tsx when the
// active palette changes, rather than re-exported as a new object. This is
// deliberate — dozens of screens do `import { color } from "../../lib/theme"`
// and reference `color.text` etc. inside `StyleSheet.create()` at module
// scope. Re-exporting a new object on theme change would not reach those
// call sites without a hook-based rewrite of every screen. Mutating the
// same object's properties means every existing `color.foo` reference
// (including ones inside StyleSheet.create()) sees the new value as soon as
// ThemeProvider forces a full tree remount — no per-screen changes required.

import { Platform } from "react-native";

// ── Color ──────────────────────────────────────────────────────────────────
export type ColorPalette = {
  brand: string;
  brandDark: string;
  brandTint: string;
  brandTintStrong: string;
  gold: string;
  goldDark: string;
  goldTint: string;
  bg: string;
  surface: string;
  surfaceAlt: string;
  overlay: string;
  text: string;
  textSub: string;
  textMuted: string;
  textOnBrand: string;
  textOnBrandSub: string;
  border: string;
  borderStrong: string;
  divider: string;
  success: string;
  successTint: string;
  warning: string;
  warningTint: string;
  danger: string;
  dangerTint: string;
  info: string;
  infoTint: string;
  star: string;
  online: string;
  skeleton: string;
  skeletonHighlight: string;

  // Glass / translucent materials (GlassBackButton, GlassHeader, GlassTabBar)
  glassOverlay: string;
  glassBorder: string;
  glassScrim: string;
};

export const LIGHT_COLORS: ColorPalette = {
  // Brand
  brand: "#1A3A8F",
  brandDark: "#122A6B",
  brandTint: "#EEF2FB",
  brandTintStrong: "#DDE5F7",
  gold: "#F5A623",
  goldDark: "#E2920F",
  goldTint: "#FFF4E0",

  // Surfaces
  bg: "#F4F6FA",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  overlay: "rgba(16, 24, 40, 0.55)",

  // Text
  text: "#111827",
  textSub: "#5A6478",
  textMuted: "#8A93A6",
  textOnBrand: "#FFFFFF",
  textOnBrandSub: "rgba(255,255,255,0.78)",

  // Lines
  border: "#E6E9F0",
  borderStrong: "#D8DCE5",
  divider: "#F0F2F6",

  // Status
  success: "#16A34A",
  successTint: "#DCFCE7",
  warning: "#D97706",
  warningTint: "#FEF3C7",
  danger: "#DC2626",
  dangerTint: "#FEE2E2",
  info: "#1D4ED8",
  infoTint: "#DBEAFE",

  // Utility
  star: "#F5A623",
  online: "#22C55E",
  skeleton: "#E7EAF1",
  skeletonHighlight: "#F1F3F8",

  glassOverlay: "rgba(255,255,255,0.55)",
  glassBorder: "rgba(255,255,255,0.65)",
  glassScrim: "rgba(16,24,40,0.42)",
};

export const DARK_COLORS: ColorPalette = {
  // Brand — lifted slightly for contrast against dark surfaces
  brand: "#4C6FD6",
  brandDark: "#2C4494",
  brandTint: "#1B2340",
  brandTintStrong: "#242E52",
  gold: "#F5A623",
  goldDark: "#E2920F",
  goldTint: "#3A2C10",

  // Surfaces
  bg: "#0B0D12",
  surface: "#15171F",
  surfaceAlt: "#1B1E28",
  overlay: "rgba(0, 0, 0, 0.65)",

  // Text
  text: "#F1F3F8",
  textSub: "#B7BECC",
  textMuted: "#7C8496",
  textOnBrand: "#FFFFFF",
  textOnBrandSub: "rgba(255,255,255,0.78)",

  // Lines
  border: "#262A36",
  borderStrong: "#333846",
  divider: "#1E212B",

  // Status
  success: "#22C55E",
  successTint: "#123120",
  warning: "#F59E0B",
  warningTint: "#3A2A0A",
  danger: "#EF4444",
  dangerTint: "#3A1414",
  info: "#3B82F6",
  infoTint: "#132540",

  // Utility
  star: "#F5A623",
  online: "#22C55E",
  skeleton: "#1F222C",
  skeletonHighlight: "#282C38",

  glassOverlay: "rgba(21,23,31,0.55)",
  glassBorder: "rgba(255,255,255,0.12)",
  glassScrim: "rgba(0,0,0,0.6)",
};

// Mutable, shared by reference everywhere `color` is imported. See header
// comment — do not replace this object, only mutate its keys (see
// lib/theme-provider.tsx `applyPalette`).
export const color: ColorPalette = { ...LIGHT_COLORS };

// ── Spacing ────────────────────────────────────────────────────────────────
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

// ── Radius ─────────────────────────────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

// ── Typography ─────────────────────────────────────────────────────────────
export const font = {
  h1: { fontSize: 26, fontWeight: "800" as const, lineHeight: 32, letterSpacing: -0.4 },
  h2: { fontSize: 21, fontWeight: "800" as const, lineHeight: 27, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: "700" as const, lineHeight: 24, letterSpacing: -0.2 },
  title: { fontSize: 16, fontWeight: "700" as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: "500" as const, lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: "700" as const, lineHeight: 21 },
  sub: { fontSize: 13, fontWeight: "500" as const, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: "600" as const, lineHeight: 16 },
  micro: { fontSize: 11, fontWeight: "700" as const, lineHeight: 14, letterSpacing: 0.3 },
  price: { fontSize: 17, fontWeight: "800" as const, lineHeight: 22, letterSpacing: -0.2 },
} as const;

// ── Elevation / shadow ─────────────────────────────────────────────────────
export const shadow = {
  none: {},
  sm: Platform.select({
    ios: {
      shadowColor: "#101828",
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: "#101828",
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 4 },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: "#101828",
      shadowOpacity: 0.12,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 12 },
    },
    android: { elevation: 8 },
    default: {},
  }),
} as const;

// ── Hit slop / touch ───────────────────────────────────────────────────────
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;

// ── Glass / translucent materials ───────────────────────────────────────────
// Tuning shared by GlassBackButton, GlassHeader and the tab bar so every
// frosted surface in the app reads as one consistent material rather than
// per-screen guesses at blur amount. `experimentalBlurMethod:
// "dimezisBlurView"` is what makes expo-blur render a REAL blur on Android
// (the default otherwise silently degrades to a flat tint with no blur) —
// see https://docs.expo.dev/versions/v57.0.0/sdk/blur-view/.
export const glass = {
  intensity: { subtle: 32, standard: 55, strong: 80 },
  androidBlurMethod: "dimezisBlurView" as const,
} as const;

export const theme = { color, space, radius, font, shadow, hitSlop, glass } as const;
export default theme;
