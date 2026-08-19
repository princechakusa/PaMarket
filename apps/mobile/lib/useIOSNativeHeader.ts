import { useLayoutEffect, useRef } from "react";
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
  // Call sites whose header component keeps the same presence but changes
  // behavior can increment this key to make React Navigation rebuild it.
  // A wizard step is the typical case: the button remains visible while its
  // Back action must read the newly rendered step.
  headerLeftKey?: string | number;
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

  // Every call site passes headerTitle/headerRight/headerLeft as a fresh
  // inline arrow function — a new reference on every single render of the
  // screen. If the effect below depended on those references directly,
  // navigation.setOptions() would fire on every re-render, including every
  // frame of an interactive swipe-back gesture, forcing the native header
  // to reconcile mid-drag — this is what made back-navigation feel
  // sluggish/draggy after these screens moved to native headers. Storing
  // the latest option values in a ref and depending only on their
  // *presence* (not identity) means the effect — and setOptions — only
  // re-runs when something actually meaningful changes (theme colors,
  // title text, or a callback appearing/disappearing), while the stable
  // wrapper functions handed to React Navigation always read through to
  // the current value at call time.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useLayoutEffect(() => {
    if (Platform.OS !== "ios") return;
    navigation.setOptions({
      headerTransparent: !!optionsRef.current.transparent,
      ...(optionsRef.current.transparent
        ? {}
        : { headerStyle: { backgroundColor: optionsRef.current.backgroundColor } }),
      headerTintColor: optionsRef.current.tintColor,
      headerTitle: optionsRef.current.headerTitle
        ? () => optionsRef.current.headerTitle!()
        : optionsRef.current.title ?? "",
      // Always include these two keys (as `undefined` when absent) rather
      // than omitting them — React Navigation's setOptions() MERGES with
      // whatever was set previously rather than replacing it wholesale. A
      // screen whose headerLeft/headerRight can become present then absent
      // again (e.g. a wizard's back button only showing past step 1, or a
      // headerRight that only appears once async data has loaded) would
      // otherwise leave React Navigation still holding the OLD wrapper
      // function, which reads through optionsRef at call time — so it would
      // later get called against a now-undefined value and crash with
      // "undefined is not a function". Explicitly passing `undefined` here
      // actually clears the previously-set option.
      headerRight: optionsRef.current.headerRight ? () => optionsRef.current.headerRight!() : undefined,
      headerLeft: optionsRef.current.headerLeft ? () => optionsRef.current.headerLeft!() : undefined,
    } as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    navigation,
    options.backgroundColor,
    options.tintColor,
    options.title,
    options.transparent,
    !!options.headerTitle,
    !!options.headerRight,
    !!options.headerLeft,
    options.headerLeftKey,
  ]);
}
