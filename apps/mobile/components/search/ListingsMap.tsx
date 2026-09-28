// Map view for search results: one pin per listing that has a location
// (sellers' coordinates are already rounded to ~100m at post time). Tapping a
// pin shows the title and price; tapping that opens the listing.
// Same Leaflet/OSM WebView approach as components/listing/LocationMap.tsx.
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { formatPrice, type Listing } from "../../lib/listings";
import { LEAFLET_CSS_TAG, LEAFLET_JS_TAG, OSM_ATTRIBUTION, OSM_TILE_URL_TEMPLATE } from "../../lib/map-config";
import { font, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

// Harare — used when no result has coordinates.
const DEFAULT_CENTER: [number, number] = [-17.8292, 31.0522];

export function ListingsMap({ listings, onOpen }: { listings: Listing[]; onOpen: (id: string) => void }) {
  const styles = useThemedStyles(buildStyles);
  const pins = useMemo(
    () =>
      listings
        .filter((l) => typeof l.latitude === "number" && typeof l.longitude === "number")
        .slice(0, 300)
        .map((l) => ({ id: l.id, lat: l.latitude as number, lng: l.longitude as number, t: l.title, p: formatPrice(l) })),
    [listings]
  );

  const html = useMemo(() => {
    const data = JSON.stringify(pins).replace(/</g, "\\u003c");
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">${LEAFLET_CSS_TAG}${LEAFLET_JS_TAG}
<style>html,body,#m{height:100%;margin:0}.pin{background:#1A3A8F;color:#fff;border-radius:12px;padding:2px 7px;font:700 11px sans-serif;white-space:nowrap;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)}
.pop{font:13px sans-serif}.pop b{display:block;margin-bottom:4px}.pop a{color:#1A3A8F;font-weight:700}</style></head>
<body><div id="m"></div><script>
var pins=${data};
var map=L.map('m',{zoomControl:true}).setView([${DEFAULT_CENTER[0]},${DEFAULT_CENTER[1]}],12);
L.tileLayer('${OSM_TILE_URL_TEMPLATE}',{maxZoom:18,attribution:'${OSM_ATTRIBUTION}'}).addTo(map);
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
var group=[];
pins.forEach(function(p){
  var icon=L.divIcon({className:'',html:'<div class="pin">'+esc(p.p)+'</div>',iconSize:null});
  var mk=L.marker([p.lat,p.lng],{icon:icon}).addTo(map);
  mk.bindPopup('<div class="pop"><b>'+esc(p.t)+'</b><a href="#" data-id="'+esc(p.id)+'">View ad</a></div>');
  group.push([p.lat,p.lng]);
});
if(group.length)map.fitBounds(group,{padding:[40,40],maxZoom:14});
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-id]');if(!a)return;e.preventDefault();window.ReactNativeWebView.postMessage(a.getAttribute('data-id'));});
</script></body></html>`;
  }, [pins]);

  function onMessage(e: WebViewMessageEvent) {
    const id = e.nativeEvent.data;
    if (id) onOpen(id);
  }

  return (
    <View style={styles.wrap}>
      <WebView originWhitelist={["*"]} source={{ html }} onMessage={onMessage} style={styles.map} javaScriptEnabled />
      <View style={styles.note} pointerEvents="none">
        <Text style={styles.noteText}>
          {pins.length ? `${pins.length} of ${listings.length} ads have a map location` : "None of these ads have a map location yet"}
        </Text>
      </View>
    </View>
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
    wrap: { flex: 1 },
    map: { flex: 1 },
    note: {
      position: "absolute",
      top: space.sm,
      alignSelf: "center",
      backgroundColor: color.surface,
      borderRadius: 999,
      paddingHorizontal: space.md,
      paddingVertical: 4,
    },
    noteText: { ...font.caption, color: color.textSub },
  });
}
