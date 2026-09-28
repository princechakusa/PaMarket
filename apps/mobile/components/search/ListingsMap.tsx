// Map view for search results: one price pin per listing. Ads with a
// seller-dropped pin use it (already rounded to ~100m at post time); the
// rest are placed approximately in their town (lib/city-coords.ts) so the
// map is useful even though most sellers never drop a pin. Tapping a pin
// shows the title and price; tapping "View ad" opens the listing.
//
// Native: Leaflet in a WebView (same approach as LocationMap). Web: the same
// HTML in an iframe, since react-native-webview doesn't support web.
import { useEffect, useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { formatPrice, type Listing } from "../../lib/listings";
import { approximateCoords } from "../../lib/city-coords";
import { LEAFLET_CSS_TAG, LEAFLET_JS_TAG, OSM_ATTRIBUTION, OSM_TILE_URL_TEMPLATE } from "../../lib/map-config";
import { font, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";

// Harare — used when no result can be placed.
const DEFAULT_CENTER: [number, number] = [-17.8292, 31.0522];
const MESSAGE_PREFIX = "pm-open-listing:";

export function ListingsMap({ listings, onOpen }: { listings: Listing[]; onOpen: (id: string) => void }) {
  const styles = useThemedStyles(buildStyles);
  const pins = useMemo(() => {
    const out: { id: string; lat: number; lng: number; t: string; p: string; a: boolean }[] = [];
    for (const l of listings.slice(0, 300)) {
      if (typeof l.latitude === "number" && typeof l.longitude === "number") {
        out.push({ id: l.id, lat: l.latitude, lng: l.longitude, t: l.title, p: formatPrice(l), a: false });
        continue;
      }
      const approx = approximateCoords(l.id, l.city, l.province);
      if (approx) out.push({ id: l.id, lat: approx[0], lng: approx[1], t: l.title, p: formatPrice(l), a: true });
    }
    return out;
  }, [listings]);
  const approxCount = pins.filter((p) => p.a).length;

  const html = useMemo(() => {
    const data = JSON.stringify(pins).replace(/</g, "\\u003c");
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">${LEAFLET_CSS_TAG}${LEAFLET_JS_TAG}
<style>html,body,#m{height:100%;margin:0}.pin{background:#1A3A8F;color:#fff;border-radius:12px;padding:2px 7px;font:700 11px sans-serif;white-space:nowrap;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)}.pin.a{background:#4B5E9E}
.pop{font:13px sans-serif}.pop b{display:block;margin-bottom:2px}.pop i{display:block;color:#6B7280;font-size:11px;margin-bottom:4px}.pop a{color:#1A3A8F;font-weight:700}</style></head>
<body><div id="m"></div><script>
var pins=${data};
var map=L.map('m',{zoomControl:true}).setView([${DEFAULT_CENTER[0]},${DEFAULT_CENTER[1]}],12);
L.tileLayer('${OSM_TILE_URL_TEMPLATE}',{maxZoom:18,attribution:'${OSM_ATTRIBUTION}'}).addTo(map);
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function send(id){var msg='${MESSAGE_PREFIX}'+id;if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(msg)}else if(window.parent){window.parent.postMessage(msg,'*')}}
var group=[];
pins.forEach(function(p){
  var icon=L.divIcon({className:'',html:'<div class="pin'+(p.a?' a':'')+'">'+esc(p.p)+'</div>',iconSize:null});
  var mk=L.marker([p.lat,p.lng],{icon:icon}).addTo(map);
  mk.bindPopup('<div class="pop"><b>'+esc(p.t)+'</b>'+(p.a?'<i>Approximate area</i>':'')+'<a href="#" data-id="'+esc(p.id)+'">View ad</a></div>');
  group.push([p.lat,p.lng]);
});
if(group.length)map.fitBounds(group,{padding:[40,40],maxZoom:13});
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-id]');if(!a)return;e.preventDefault();send(a.getAttribute('data-id'));});
</script></body></html>`;
  }, [pins]);

  // Web: the iframe posts to this window.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const handler = (e: MessageEvent) => {
      if (typeof e.data === "string" && e.data.startsWith(MESSAGE_PREFIX)) onOpen(e.data.slice(MESSAGE_PREFIX.length));
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onOpen]);

  function onMessage(e: WebViewMessageEvent) {
    const data = e.nativeEvent.data;
    if (data?.startsWith(MESSAGE_PREFIX)) onOpen(data.slice(MESSAGE_PREFIX.length));
  }

  const note = !pins.length
    ? "None of these ads can be placed on the map yet"
    : approxCount
      ? `${pins.length} of ${listings.length} ads shown · lighter pins are approximate (town only)`
      : `${pins.length} of ${listings.length} ads shown`;

  return (
    <View style={styles.wrap}>
      {Platform.OS === "web" ? (
        // eslint-disable-next-line react/no-unknown-property
        <iframe title="Listings map" srcDoc={html} style={{ border: 0, width: "100%", height: "100%" }} />
      ) : (
        <WebView originWhitelist={["*"]} source={{ html }} onMessage={onMessage} style={styles.map} javaScriptEnabled />
      )}
      <View style={styles.note} pointerEvents="none">
        <Text style={styles.noteText}>{note}</Text>
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
      bottom: space.xxl,
      left: space.lg,
      right: space.lg,
      alignItems: "center",
    },
    noteText: {
      ...font.caption,
      color: color.textSub,
      backgroundColor: color.surface,
      borderRadius: 999,
      paddingHorizontal: space.md,
      paddingVertical: 4,
      overflow: "hidden",
      textAlign: "center",
    },
  });
}
