import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { color, font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import {
  APPROX_LOCATION_CIRCLE_COLOR,
  APPROX_LOCATION_RADIUS_METERS,
  LEAFLET_CSS_TAG,
  LEAFLET_JS_TAG,
  OSM_ATTRIBUTION,
  OSM_TILE_URL_TEMPLATE,
} from "../../lib/map-config";

type LocationMapProps = {
  latitude: number;
  longitude: number;
  // Seeds the same deterministic jitter as the website's map (detail.html)
  // so a given listing shows the same approximate pin on both platforms.
  listingId: string;
  locationLabel?: string | null;
};

// Real, interactive Leaflet map -- same OpenStreetMap tile provider, same
// deterministic ~150-400m jitter (seeded from the listing id, so it never
// jumps around on reload), and the same 400m brand-navy radius circle the
// website's own listing detail page (detail.html) already uses, embedded
// via WebView rather than a static image. Exact seller pin is never sent
// to the page -- only the already-rounded (~100m, see roundApproxCoord)
// coordinates are interpolated in, matching the website's own privacy
// convention for this feature.
function buildHtml(latitude: number, longitude: number, listingId: string): string {
  const safeId = JSON.stringify(String(listingId ?? ""));
  const lat = Number(latitude);
  const lng = Number(longitude);
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
${LEAFLET_CSS_TAG}
<style>html,body,#map{height:100%;width:100%;margin:0;padding:0;background:#eaedff;}.leaflet-control-attribution{font-size:9px;}</style>
</head><body>
<div id="map"></div>
${LEAFLET_JS_TAG}
<script>
  var seed = ${safeId};
  var h = 0; for (var i = 0; i < seed.length; i++) { h = (h * 31 + seed.charCodeAt(i)) >>> 0; }
  var h2 = (h * 2654435761) >>> 0;
  var dLat = ((h % 1000) / 1000 - 0.5) * 0.006;
  var dLng = ((h2 % 1000) / 1000 - 0.5) * 0.006;
  var approxLat = ${lat} + dLat, approxLng = ${lng} + dLng;
  var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([approxLat, approxLng], 14);
  L.tileLayer('${OSM_TILE_URL_TEMPLATE}', { maxZoom: 19, attribution: '${OSM_ATTRIBUTION}' }).addTo(map);
  L.circle([approxLat, approxLng], { radius: ${APPROX_LOCATION_RADIUS_METERS}, color: '${APPROX_LOCATION_CIRCLE_COLOR}', fillColor: '${APPROX_LOCATION_CIRCLE_COLOR}', fillOpacity: .12, weight: 1.5 }).addTo(map);
</script>
</body></html>`;
}

export function LocationMap({ latitude, longitude, listingId, locationLabel }: LocationMapProps) {
  const styles = useThemedStyles(buildStyles);
  const html = buildHtml(latitude, longitude, listingId);

  return (
    <View style={styles.wrap}>
      <WebView
        source={{ html }}
        style={styles.webview}
        originWhitelist={["*"]}
        scrollEnabled={false}
        androidLayerType="hardware"
      />
      {locationLabel ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{locationLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    wrap: {
      width: "100%",
      height: 176,
      borderRadius: radius.md,
      overflow: "hidden",
      backgroundColor: color.surfaceAlt,
    },
    webview: { flex: 1, backgroundColor: "transparent" },
    badge: {
      position: "absolute",
      bottom: space.sm,
      left: space.sm,
      backgroundColor: color.surface,
      borderRadius: radius.pill,
      paddingHorizontal: space.sm,
      paddingVertical: 4,
      ...font.caption,
    },
    badgeText: { ...font.caption, color: color.text },
  });
}
