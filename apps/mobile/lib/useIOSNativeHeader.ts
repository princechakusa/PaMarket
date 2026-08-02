import { useLayoutEffect } from "react";
import { Platform } from "react-native";
import { useNavigation } from "expo-router";

type NativeHeaderOptions = {
  // Ignored when `transparent` is set — a transparent header has no
  // background of its own by definition (it floats over whatever's
  // underneath, e.g. a photo carousel).
  backgroundColor: string;
  tintColor: string;
  // Either a plain string title, or a custom header-title component (for
  // screens whose "title" is really an avatar + name, a shop logo, etc.).
  title?: string;
  headerTitle?: () => React.ReactNode;
  headerRight?: () => React.ReactNode;
  // Only for screens whose "back" isn't really "go to the previous screen"
  // (e.g. a multi-step wizard that steps back one stage at a time) — the
  // real native back button can't encode that, so the chrome stays native
  // but the tap action has to be custom. Leave unset everywhere else so the
  // OS's own back button (with its real previous-title/gesture behavior)
  // is what actually renders.
  headerLeft?: () => React.ReactNode;
  // For photo/hero screens where the back button (and any right-side
  // actions) float directly over the content with no banner behind them —
  // still the real native header/back button, just with no background of
  // its own (`headerTransparent`), matching what these screens looked like
  // before (a floating glass button over a full-bleed photo).
  transparent?: boolean;
};

// iOS gets the app's real native Stack header — the actual system back
// button, with the real previous-screen title, Dynamic Type, VoiceOver, RTL,
// and iOS's own Liquid Glass press animation, none of which a hand-drawn
// button can truly reproduce. Android is deliberately untouched: its screens
// keep rendering their existing custom banner exactly as before, since
// Android's back affordance was never meant to look like this.
//
// Pairs with two things at each call site:
//   1. The route's entry in app/_layout.tsx must set
//      `headerShown: Platform.OS === "ios"`.
//   2. The screen's own custom header View must be skipped on iOS
//      (`Platform.OS !== "ios" ? <CustomHeader/> : null`) — otherwise you'd
//      get the native header AND the hand-drawn one stacked on top of it.
export function useIOSNativeHeader(options: NativeHeaderOptions) {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    if (Platform.OS !== "ios") return;
    navigation.setOptions({
      headerTransparent: !!options.transparent,
      ...(options.transparent ? {} : { headerStyle: { backgroundColor: options.backgroundColor } }),
      headerTintColor: options.tintColor,
      headerTitle: options.headerTitle ?? options.title ?? "",
      ...(options.headerRight ? { headerRight: options.headerRight } : {}),
      ...(options.headerLeft ? { headerLeft: options.headerLeft } : {}),
    } as never);
    // Deliberately depending on the whole `options` object's relevant
    // fields individually (not the object itself, which is a fresh
    // reference every render) — callers pass inline object literals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, options.backgroundColor, options.tintColor, options.title, options.headerTitle, options.headerRight, options.headerLeft, options.transparent]);
}
