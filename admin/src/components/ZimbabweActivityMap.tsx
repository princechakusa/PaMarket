import type { CSSProperties } from 'react';
import provinceGeoJson from '../data/zimbabwe-provinces.json';

type Position = [number, number];
type Geometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: Position[][] | Position[][][] };
type ProvinceFeature = { properties: { shapeName: string }; geometry: Geometry };
export type ProvinceActivity = { province: string; n: number };

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
const listColors = ['green', 'orange', 'mint'] as const;

export function ZimbabweActivityMap({ data }: { data: ProvinceActivity[] }) {
  const total = data.reduce((sum, row) => sum + row.n, 0);
  const share = new Map(data.map((row) => [row.province, total > 0 ? (row.n / total) * 100 : 0]));
  const sorted = [...data].sort((a, b) => b.n - a.n);
  const top = sorted.slice(0, 3);
  const otherPct = Math.max(0, 100 - top.reduce((sum, row) => sum + (share.get(row.province) ?? 0), 0));

  return <div className="zim-map-wrap">
    <div className="geo-source"><span><i />ZIMBABWE ADM1 · 10 PROVINCES</span><b>SOURCE: LISTINGS TABLE · LIVE</b></div>
    <svg className="zim-map" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="zim-map-title zim-map-desc">
      <title id="zim-map-title">Zimbabwe provincial activity map</title>
      <desc id="zim-map-desc">Real Zimbabwe province boundaries with live listing distribution.</desc>
      {features.map((feature) => {
        const pct = share.get(feature.properties.shapeName) ?? 0;
        return <path key={feature.properties.shapeName} d={geometryToPath(feature.geometry)} style={{ '--province-intensity': Math.max(.08, Math.min(.9, pct / 60)) } as CSSProperties}><title>{feature.properties.shapeName}: {pct.toFixed(1)}% of listings</title></path>;
      })}
    </svg>
    {total > 0
      ? <div className="geo-list">
          {top.map((row, index) => <div key={row.province}><i className={listColors[index]} />{row.province} <strong>{(share.get(row.province) ?? 0).toFixed(1)}%</strong></div>)}
          <div><i />All other provinces <strong>{otherPct.toFixed(1)}%</strong></div>
        </div>
      : <div className="geo-list"><div>No listing province data yet.</div></div>}
    <p className="map-attribution">Boundaries: geoBoundaries / ZIMSTAT–OCHA · CC BY 3.0 IGO</p>
  </div>;
}
