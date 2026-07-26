import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path, Circle, Polyline } from "react-native-svg";
import type { ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

function UploadIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M17 8l-5-5-5 5" />
      <Line x1={12} y1={3} x2={12} y2={15} />
    </Svg>
  );
}

function CameraIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx={12} cy={13} r={4} />
    </Svg>
  );
}

// No drag-gesture library is in this project (adding react-native-reanimated +
// gesture-handler for one control is a heavy, native-rebuild-affecting change
// on a project with an already fragile prebuild/signing process — see
// AGENTS.md/CLAUDE.md). Move-left/move-right arrows give the same reordering
// outcome without a new native dependency.
function MoveIcon({ color, direction }: { color: string; direction: "left" | "right" }) {
  const points = direction === "left" ? "14 6 8 12 14 18" : "10 6 16 12 10 18";
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5}>
      <Polyline points={points} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PhotoGrid({
  photos,
  onPickGallery,
  onPickCamera,
  onRemove,
  onSetCover,
  onMove,
  isProcessing,
}: {
  photos: string[];
  onPickGallery: () => void;
  onPickCamera: () => void;
  onRemove: (index: number) => void;
  onSetCover: (index: number) => void;
  onMove: (index: number, direction: "left" | "right") => void;
  isProcessing: boolean;
}) {
  const styles = useThemedStyles(buildStyles);
  const tones = useThemedStyles(buildTones);
  return (
    <View>
      <View style={styles.actionsRow}>
        <Pressable style={[styles.actionButton, isProcessing && styles.disabled]} onPress={onPickGallery} disabled={isProcessing}>
          <UploadIcon color={tones.icon} />
          <Text style={styles.actionLabel}>Upload</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, isProcessing && styles.disabled]} onPress={onPickCamera} disabled={isProcessing}>
          <CameraIcon color={tones.icon} />
          <Text style={styles.actionLabel}>Camera</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>JPG or PNG · up to 8 photos · auto-compressed</Text>

      {isProcessing ? <Text style={styles.processing}>Processing photo…</Text> : null}

      <View style={styles.grid}>
        {photos.map((uri, i) => (
          <View key={uri + i} style={styles.thumbWrap}>
            <Image source={{ uri }} style={styles.thumb} />
            <Pressable style={styles.removeButton} onPress={() => onRemove(i)}>
              <Text style={styles.removeButtonText}>×</Text>
            </Pressable>
            {i === 0 ? (
              <View style={styles.coverBadge}>
                <Text style={styles.coverBadgeText}>Cover</Text>
              </View>
            ) : (
              <Pressable style={styles.setCoverButton} onPress={() => onSetCover(i)}>
                <Text style={styles.setCoverText}>Set cover</Text>
              </Pressable>
            )}
            {photos.length > 1 ? (
              <View style={styles.moveRow}>
                <Pressable
                  style={[styles.moveButton, i === 0 && styles.moveButtonDisabled]}
                  onPress={() => onMove(i, "left")}
                  disabled={i === 0}
                  hitSlop={4}
                >
                  <MoveIcon color="#ffffff" direction="left" />
                </Pressable>
                <Pressable
                  style={[styles.moveButton, i === photos.length - 1 && styles.moveButtonDisabled]}
                  onPress={() => onMove(i, "right")}
                  disabled={i === photos.length - 1}
                  hitSlop={4}
                >
                  <MoveIcon color="#ffffff" direction="right" />
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function buildTones(color: ColorPalette) {
  return {
    icon: color.brand,
  };
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    actionsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 8,
    },
    actionButton: {
      flex: 1,
      alignItems: "center",
      gap: 6,
      paddingVertical: 18,
      backgroundColor: color.surfaceAlt,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: color.border,
      borderStyle: "dashed",
    },
    disabled: {
      opacity: 0.5,
    },
    actionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: color.brand,
    },
    hint: {
      fontSize: 12,
      color: color.textMuted,
      textAlign: "center",
      marginBottom: 10,
    },
    processing: {
      textAlign: "center",
      fontSize: 13,
      fontWeight: "600",
      color: color.brand,
      paddingVertical: 8,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    thumbWrap: {
      width: "31%",
      aspectRatio: 1,
      borderRadius: 10,
      overflow: "hidden",
      position: "relative",
    },
    thumb: {
      width: "100%",
      height: "100%",
    },
    removeButton: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    removeButtonText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 16,
    },
    coverBadge: {
      position: "absolute",
      bottom: 4,
      left: 4,
      backgroundColor: color.brand,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    coverBadgeText: {
      fontSize: 9,
      fontWeight: "800",
      color: color.textOnBrand,
    },
    setCoverButton: {
      position: "absolute",
      bottom: 4,
      left: 4,
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    setCoverText: {
      fontSize: 9,
      fontWeight: "800",
      color: "#ffffff",
    },
    moveRow: {
      position: "absolute",
      top: 4,
      left: 4,
      flexDirection: "row",
      gap: 4,
    },
    moveButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    moveButtonDisabled: {
      opacity: 0.3,
    },
  });
}
