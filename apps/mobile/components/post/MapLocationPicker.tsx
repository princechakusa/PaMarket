import { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, GlassBackButton } from "../ui";
import { color, font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { LEAFLET_CSS_TAG, LEAFLET_JS_TAG, OSM_ATTRIBUTION, OSM_TILE_URL_TEMPLATE } from "../../lib/map-config";

const HARARE = { lat: -17.8292, lng: 31.0522 };

// Real, interactive OpenStreetMap picker (same Leaflet + tile provider as
// LocationMap.tsx and the website's post-ad.html) -- tap or drag the marker
// to set the exact spot, then "Use this location" rounds it to ~100m
// (roundApproxCoord, applied by the caller) before it's ever stored.
function buildHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
${LEAFLET_CSS_TAG}
<style>html,body,#map{height:100%;width:100%;margin:0;padding:0;}</style>
</head><body>
<div id="map"></div>
${LEAFLET_JS_TAG}
<script>
  var map = L.map('map').setView([${lat}, ${lng}], 14);
  L.tileLayer('${OSM_TILE_URL_TEMPLATE}', { maxZoom: 19, attribution: '${OSM_ATTRIBUTION}' }).addTo(map);
  var marker = L.marker([${lat}, ${lng}], { draggable: true }).addTo(map);
  function post(latlng) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ lat: latlng.lat, lng: latlng.lng }));
  }
  marker.on('dragend', function () { post(marker.getLatLng()); });
  map.on('click', function (e) { marker.setLatLng(e.latlng); post(e.latlng); });
  post(marker.getLatLng());
</script>
</body></html>`;
}

export function MapLocationPicker({
  visible,
  initialLatitude,
  initialLongitude,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  initialLatitude: number | null;
  initialLongitude: number | null;
  onCancel: () => void;
  onConfirm: (latitude: number, longitude: number) => void;
}) {
  const styles = useThemedStyles(buildStyles);
  const insets = useSafeAreaInsets();
  const startLat = initialLatitude ?? HARARE.lat;
  const startLng = initialLongitude ?? HARARE.lng;
  const [picked, setPicked] = useState({ lat: startLat, lng: startLng });

  // The component itself stays mounted across opens (only the inner WebView
  // remounts via its own `key`) -- without this, a stale `picked` from a
  // previous session could be confirmed if the user taps "Use this
  // location" before the freshly-reloaded map's own on-load post() message
  // arrives. Re-sync on every open so it always starts from the current
  // coordinates being shown.
  useEffect(() => {
    if (visible) setPicked({ lat: startLat, lng: startLng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function handleMessage(e: WebViewMessageEvent) {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (typeof data.lat === "number" && typeof data.lng === "number") {
        setPicked({ lat: data.lat, lng: data.lng });
      }
    } catch {
      // Malformed bridge message -- ignore, keep the last known pick.
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
          <GlassBackButton onPress={onCancel} flat label="Cancel" />
          <Text style={styles.headerTitle}>Drop a pin</Text>
          <View style={{ width: 72 }} />
        </View>

        <WebView
          key={visible ? "open" : "closed"}
          source={{ html: buildHtml(startLat, startLng) }}
          style={styles.webview}
          originWhitelist={["*"]}
          onMessage={handleMessage}
        />

        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          <Text style={styles.hint}>Tap or drag the pin to your meetup spot.</Text>
          <Button label="Use this location" onPress={() => onConfirm(picked.lat, picked.lng)} fullWidth />
        </View>
      </View>
    </Modal>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: color.bg },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: space.lg, paddingBottom: space.sm,
    },
    headerTitle: { ...font.title, color: color.text },
    webview: { flex: 1 },
    footer: {
      paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: color.surface,
      borderTopWidth: 1, borderTopColor: color.border, gap: space.sm,
    },
    hint: { ...font.caption, color: color.textMuted, textAlign: "center" },
  });
}
