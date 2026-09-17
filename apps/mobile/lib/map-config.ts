// Shared Leaflet/OpenStreetMap configuration for the app's two WebView-based
// map components -- components/listing/LocationMap.tsx (read-only listing
// display) and components/post/MapLocationPicker.tsx (interactive pin
// picker at post time). They remain two separate components with two
// different responsibilities; this file only removes the CDN URLs, SRI
// integrity hashes, tile template, and approximate-location styling that
// both previously hardcoded independently, so a future Leaflet/tile-
// provider change only needs editing here.
const LEAFLET_VERSION = "1.9.4";

export const LEAFLET_CSS_TAG = `<link rel="stylesheet" href="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>`;

export const LEAFLET_JS_TAG = `<script src="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>`;

export const OSM_TILE_URL_TEMPLATE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = "&copy; OpenStreetMap contributors";

// Approximate-location privacy convention -- matches the website's own
// detail.html (400m jittered radius, PaMarket brand navy circle).
export const APPROX_LOCATION_RADIUS_METERS = 400;
export const APPROX_LOCATION_CIRCLE_COLOR = "#1A3A8F";
