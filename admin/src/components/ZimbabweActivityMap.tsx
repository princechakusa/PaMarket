import type { CSSProperties } from 'react';
import provinceGeoJson from '../data/zimbabwe-provinces.json';

type Position = [number, number];
type Geometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: Position[][] | Position[][][] };
type ProvinceFeature = { properties: { shapeName: string }; geometry: Geometry };

const activity: Record<string, number> = {
  Harare: 54, Bulawayo: 24, Manicaland: 8, Midlands: 5,
  'Mashonaland East': 3, 'Mashonaland West': 2, 'Mashonaland Central': 1,
  Masvingo: 1, 'Matabeleland North': 1, 'Matabeleland South': 1,
};
const features = provinceGeoJson.features as unknown as ProvinceFeature[];
const positions = features.flatMap(({ geometry }) => geometry.type === 'Polygon'
  ? (geometry.coordinates as Position[][]).flat()
  : (geometry.coordinates as Position[][][]).flat(2));
const minX = Math.min(...positions.map(([x]) => x));
const maxX = Math.max(...positions.map(([x]) => x));
const minY = Math.min(...positions.map(([, y]) => y));
const maxY = Math.max(...positions.map(([, y]) => y));
const width = 520;
const height = 285;
const pad = 10;

function point([longitude, latitude]: Position) {
  const x = pad + ((longitude - minX) / (maxX - minX)) * (width - pad * 2);
  const y = pad + ((maxY - latitude) / (maxY - minY)) * (height - pad * 2);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}
function ringsToPath(rings: Position[][]) { return rings.map((ring) => `M${ring.map(point).join('L')}Z`).join(''); }
function geometryToPath(geometry: Geometry) {
  return geometry.type === 'Polygon' ? ringsToPath(geometry.coordinates as Position[][]) : (geometry.coordinates as Position[][][]).map(ringsToPath).join('');
}

export function ZimbabweActivityMap() {
  return <div className="zim-map-wrap">
    <div className="geo-source"><span><i />ZIMBABWE ADM1 · 10 PROVINCES</span><b>DOWNLOAD TELEMETRY: NOT CONNECTED</b></div>
    <svg className="zim-map" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="zim-map-title zim-map-desc">
      <title id="zim-map-title">Zimbabwe provincial activity map</title>
      <desc id="zim-map-desc">Real Zimbabwe province boundaries with reference activity distribution. Download telemetry is not connected.</desc>
      {features.map((feature) => {
        const value = activity[feature.properties.shapeName] ?? 0;
        return <path key={feature.properties.shapeName} d={geometryToPath(feature.geometry)} style={{ '--province-intensity': Math.max(.12, Math.min(.9, value / 58)) } as CSSProperties}><title>{feature.properties.shapeName}: {value}% reference activity</title></path>;
      })}
    </svg>
    <div className="geo-list"><div><i className="green"/>Harare Metro <strong>54.0% reference</strong></div><div><i className="orange"/>Bulawayo Metro <strong>24.0% reference</strong></div><div><i className="mint"/>Manicaland <strong>8.0% reference</strong></div><div><i/>All other provinces <strong>14.0% reference</strong></div></div>
    <p className="map-attribution">Boundaries: geoBoundaries / ZIMSTAT–OCHA · CC BY 3.0 IGO</p>
  </div>;
}
