import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path, Circle } from "react-native-svg";
import { BRAND_BLUE } from "../../lib/constants";

function UploadIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={BRAND_BLUE} strokeWidth={2}>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M17 8l-5-5-5 5" />
      <Line x1={12} y1={3} x2={12} y2={15} />
    </Svg>
  );
}

function CameraIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={BRAND_BLUE} strokeWidth={2}>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx={12} cy={13} r={4} />
    </Svg>
  );
}

export function PhotoGrid({
  photos,
  onPickGallery,
  onPickCamera,
  onRemove,
  onSetCover,
  isProcessing,
}: {
  photos: string[];
  onPickGallery: () => void;
  onPickCamera: () => void;
  onRemove: (index: number) => void;
  onSetCover: (index: number) => void;
  isProcessing: boolean;
}) {
  return (
    <View>
      <View style={styles.actionsRow}>
        <Pressable style={[styles.actionButton, isProcessing && styles.disabled]} onPress={onPickGallery} disabled={isProcessing}>
          <UploadIcon />
          <Text style={styles.actionLabel}>Upload</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, isProcessing && styles.disabled]} onPress={onPickCamera} disabled={isProcessing}>
          <CameraIcon />
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
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "#F5F6F9",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#D8DCE5",
    borderStyle: "dashed",
  },
  disabled: {
    opacity: 0.5,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: BRAND_BLUE,
  },
  hint: {
    fontSize: 12,
    color: "#8A93A6",
    textAlign: "center",
    marginBottom: 10,
  },
  processing: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: BRAND_BLUE,
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
    backgroundColor: BRAND_BLUE,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coverBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#ffffff",
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
});
