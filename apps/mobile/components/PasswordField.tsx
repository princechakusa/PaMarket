import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from "react-native";
import { passwordStrength } from "../lib/validation";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

export function PasswordField({
  value,
  onChangeText,
  placeholder = "Password",
  showStrength = false,
  autoComplete = "password",
  inputStyle,
  icon,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  showStrength?: boolean;
  autoComplete?: "password" | "password-new";
  inputStyle?: StyleProp<TextStyle>;
  // Optional leading glyph (e.g. a lock icon) — only the sign-in screen's
  // icon-led field style opts in; every other caller renders unchanged.
  icon?: ReactNode;
}) {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  const [visible, setVisible] = useState(false);
  const strength = showStrength ? passwordStrength(value) : null;

  return (
    <View>
      <View style={styles.row}>
        {icon ? <View style={styles.leadingIcon}>{icon}</View> : null}
        <TextInput
          style={[styles.input, icon ? styles.inputWithIcon : null, inputStyle]}
          placeholder={placeholder}
          placeholderTextColor={tones.placeholder}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoComplete={autoComplete}
          value={value}
          onChangeText={onChangeText}
        />
        <Pressable style={styles.eyeButton} onPress={() => setVisible((v) => !v)} hitSlop={8}>
          <Text style={styles.eyeLabel}>{visible ? "Hide" : "Show"}</Text>
        </Pressable>
      </View>
      {showStrength && value.length > 0 ? (
        <View style={styles.strengthTrack}>
          <View
            style={[
              styles.strengthFill,
              { width: `${(strength!.score / 5) * 100}%`, backgroundColor: strength!.color },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

function buildTones(color: ColorPalette) {
  return {
    placeholder: color.textMuted,
  };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    row: {
      position: "relative",
      justifyContent: "center",
    },
    input: {
      borderWidth: 1,
      borderColor: color.border,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      paddingRight: 60,
      fontSize: 16,
      color: color.text,
    },
    inputWithIcon: {
      paddingLeft: 44,
    },
    leadingIcon: {
      position: "absolute",
      left: 14,
      zIndex: 1,
    },
    eyeButton: {
      position: "absolute",
      right: 12,
    },
    eyeLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: color.brand,
    },
    strengthTrack: {
      height: 4,
      backgroundColor: color.border,
      borderRadius: 2,
      marginTop: 6,
      overflow: "hidden",
    },
    strengthFill: {
      height: "100%",
      borderRadius: 2,
    },
  });
}
