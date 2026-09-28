// Keyboard handling for every screen with a text box.
//
// Store/dev builds use react-native-keyboard-controller: the view moves with
// the keyboard frame by frame (like WhatsApp) on Android and iOS, and finds
// its own offset below native headers (`automaticOffset`).
//
// If its native part is missing — an Expo Go version without it, or the web
// build — this falls back to React Native's own KeyboardAvoidingView so the
// app still runs and inputs still move up, just without frame-synced motion.
import { useContext, type ReactNode } from "react";
import { KeyboardAvoidingView as RNKeyboardAvoidingView, Platform, ScrollView, TurboModuleRegistry, type ScrollViewProps } from "react-native";
import {
  KeyboardAvoidingView as ControllerKeyboardAvoidingView,
  KeyboardAwareScrollView as ControllerKeyboardAwareScrollView,
  KeyboardProvider as ControllerKeyboardProvider,
  type KeyboardAvoidingViewProps,
} from "react-native-keyboard-controller";
// expo-router bundles React Navigation; the header height is only exposed here.
import { HeaderHeightContext } from "expo-router/build/react-navigation/elements";

export const HAS_KEYBOARD_CONTROLLER = Platform.OS !== "web" && TurboModuleRegistry.get("KeyboardController") != null;

export function KeyboardProvider({ children }: { children: ReactNode }) {
  if (!HAS_KEYBOARD_CONTROLLER) return <>{children}</>;
  return <ControllerKeyboardProvider>{children}</ControllerKeyboardProvider>;
}

export function KeyboardAvoidingView(props: KeyboardAvoidingViewProps) {
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  if (HAS_KEYBOARD_CONTROLLER) return <ControllerKeyboardAvoidingView {...props} />;
  // Fallback: RN's KAV doesn't know automaticOffset / translate-with-padding,
  // so the native header height is added to the offset by hand.
  const { automaticOffset, behavior, contentContainerStyle, keyboardVerticalOffset = 0, ...rest } = props;
  const rnBehavior = behavior === "translate-with-padding" ? "padding" : behavior;
  return (
    <RNKeyboardAvoidingView
      {...rest}
      contentContainerStyle={contentContainerStyle}
      keyboardVerticalOffset={keyboardVerticalOffset + (automaticOffset ? headerHeight : 0)}
      behavior={Platform.OS === "ios" ? rnBehavior : "height"}
    />
  );
}

// Drop-in for a form's main vertical ScrollView: scrolls the focused input
// into view above the keyboard (and keeps it there while typing).
export function KeyboardAwareScrollView(props: ScrollViewProps & { bottomOffset?: number }) {
  const { bottomOffset = 24, ...rest } = props;
  if (HAS_KEYBOARD_CONTROLLER) return <ControllerKeyboardAwareScrollView bottomOffset={bottomOffset} keyboardShouldPersistTaps="handled" {...rest} />;
  return <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets {...rest} />;
}
