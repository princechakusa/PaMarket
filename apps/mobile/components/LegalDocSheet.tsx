import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { LegalDoc } from "../lib/legal";
import type { ColorPalette } from "../lib/theme";
import { useThemedStyles } from "../lib/theme-provider";

export function LegalDocSheet({
  doc,
  visible,
  onClose,
}: {
  doc: LegalDoc | null;
  visible: boolean;
  onClose: () => void;
}) {
  const styles = useThemedStyles(buildStyles);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{doc?.title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 32 }}>
            <Text style={styles.updated}>{doc?.updated}</Text>
            {doc?.sections.map((section, i) => (
              <View key={i} style={styles.section}>
                {section.heading ? <Text style={styles.heading}>{section.heading}</Text> : null}
                <Text style={styles.paragraph}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: color.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: color.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "88%",
      paddingTop: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: color.border,
    },
    title: {
      fontSize: 17,
      fontWeight: "700",
      color: color.text,
    },
    close: {
      fontSize: 15,
      fontWeight: "600",
      color: color.brand,
    },
    body: {
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    updated: {
      fontSize: 12,
      color: color.textMuted,
      marginBottom: 12,
    },
    section: {
      marginBottom: 14,
    },
    heading: {
      fontSize: 14,
      fontWeight: "700",
      color: color.text,
      marginBottom: 4,
    },
    paragraph: {
      fontSize: 13,
      lineHeight: 19,
      color: color.textSub,
    },
  });
}
