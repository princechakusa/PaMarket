import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { passwordStrength } from "../lib/validation";

export function PasswordField({
  value,
  onChangeText,
  placeholder = "Password",
  showStrength = false,
  autoComplete = "password",
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  showStrength?: boolean;
  autoComplete?: "password" | "password-new";
}) {
  const [visible, setVisible] = useState(false);
  const strength = showStrength ? passwordStrength(value) : null;

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#8A93A6"
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

const styles = StyleSheet.create({
  row: {
    position: "relative",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D8DCE5",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 60,
    fontSize: 16,
    color: "#111827",
  },
  eyeButton: {
    position: "absolute",
    right: 12,
  },
  eyeLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A3A8F",
  },
  strengthTrack: {
    height: 4,
    backgroundColor: "#E4E7EF",
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
  },
  strengthFill: {
    height: "100%",
    borderRadius: 2,
  },
});
