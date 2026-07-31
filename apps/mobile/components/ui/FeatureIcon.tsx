import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

// One distinct icon per amenity/feature value collected across
// lib/category-attrs.json's chips fields (property/vehicles/rooms/pets).
// Anything not in this map (a value added to the JSON later, or free text)
// falls back to a plain dot rather than inventing a bespoke icon per string.
const ICONS: Record<string, (c: string) => React.ReactNode> = {
  borehole: (c) => (
    <Path
      stroke={c}
      strokeWidth={2}
      d="M12 2v6M12 22v-6M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M2 12h6M16 12h6M4.9 19.1l4.2-4.2M14.9 9.1l4.2-4.2"
    />
  ),
  "solar power": (c) => (
    <>
      <Circle cx={12} cy={12} r={4} stroke={c} strokeWidth={2} />
      <Path stroke={c} strokeWidth={2} d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </>
  ),
  durawall: (c) => (
    <>
      <Rect x={3} y={8} width={18} height={12} rx={1} stroke={c} strokeWidth={2} />
      <Path stroke={c} strokeWidth={2} d="M3 12h18M9 8v4M15 8v4M9 16v4M15 16v4" />
    </>
  ),
  "electric fence": (c) => <Path stroke={c} strokeWidth={2} d="M2 6h20M2 12l3-3 3 3 3-3 3 3 3-3 3 3 3-3M2 18h20" />,
  garage: (c) => (
    <>
      <Path stroke={c} strokeWidth={2} d="M5 11l1.5-5A2 2 0 0 1 8.4 4h7.2a2 2 0 0 1 1.9 1.4L19 11" />
      <Rect x={3} y={11} width={18} height={7} rx={1.5} stroke={c} strokeWidth={2} />
      <Circle cx={7.5} cy={18} r={1} fill={c} />
      <Circle cx={16.5} cy={18} r={1} fill={c} />
    </>
  ),
  garden: (c) => <Path stroke={c} strokeWidth={2} d="M12 22V12M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 12c0-5 3-8 8-8 0 5-3 8-8 8z" />,
  "swimming pool": (c) => <Path stroke={c} strokeWidth={2} d="M2 17c1.5 1.5 3 1.5 4.5 0s3-1.5 4.5 0 3 1.5 4.5 0 3-1.5 4.5 0M4 12V6a2 2 0 0 1 2-2h6l6 6" />,
  "air conditioning": (c) => <Path stroke={c} strokeWidth={2} d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11" />,
  "built-in wardrobes": (c) => (
    <>
      <Rect x={4} y={3} width={16} height={18} rx={1} stroke={c} strokeWidth={2} />
      <Line x1={12} y1={3} x2={12} y2={21} stroke={c} strokeWidth={2} />
    </>
  ),
  "prepaid water": (c) => <Path stroke={c} strokeWidth={2} d="M12 2.7s6 6 6 10.8a6 6 0 0 1-12 0c0-4.8 6-10.8 6-10.8z" />,
  "tiled floors": (c) => (
    <>
      <Rect x={3} y={3} width={8} height={8} stroke={c} strokeWidth={2} />
      <Rect x={13} y={3} width={8} height={8} stroke={c} strokeWidth={2} />
      <Rect x={3} y={13} width={8} height={8} stroke={c} strokeWidth={2} />
      <Rect x={13} y={13} width={8} height={8} stroke={c} strokeWidth={2} />
    </>
  ),
  ceiling: (c) => (
    <>
      <Path stroke={c} strokeWidth={2} d="M12 2v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1" />
      <Circle cx={12} cy={12} r={2.5} stroke={c} strokeWidth={2} />
    </>
  ),
  "staff quarters": (c) => <Path stroke={c} strokeWidth={2} d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z M9 21v-6h6v6" />,
  "tarred road": (c) => <Path stroke={c} strokeWidth={2} d="M4 21L10 3h4l6 18M9 15h6M10.5 9h3" />,
  "water tank": (c) => (
    <>
      <Rect x={6} y={9} width={12} height={12} rx={1} stroke={c} strokeWidth={2} />
      <Path stroke={c} strokeWidth={2} d="M9 9V6a3 3 0 0 1 6 0v3" />
    </>
  ),
  cctv: (c) => (
    <>
      <Rect x={3} y={7} width={14} height={10} rx={2} stroke={c} strokeWidth={2} />
      <Path stroke={c} strokeWidth={2} d="M17 10l4-2v8l-4-2" />
    </>
  ),
  "power steering": (c) => (
    <>
      <Circle cx={12} cy={12} r={8} stroke={c} strokeWidth={2} />
      <Circle cx={12} cy={12} r={2.5} stroke={c} strokeWidth={2} />
      <Path stroke={c} strokeWidth={2} d="M12 4v5.5M12 14.5V20M5.6 8l4.7 3M13.7 13l4.7 3M5.6 16l4.7-3M13.7 11l4.7-3" />
    </>
  ),
  "electric windows": (c) => (
    <>
      <Rect x={4} y={4} width={16} height={16} rx={1} stroke={c} strokeWidth={2} />
      <Line x1={4} y1={14} x2={20} y2={14} stroke={c} strokeWidth={2} />
    </>
  ),
  "leather seats": (c) => <Path stroke={c} strokeWidth={2} d="M6 3h8l2 6v6l2 6H6l1-6V9z" />,
  "alloy wheels": (c) => (
    <>
      <Circle cx={12} cy={12} r={8} stroke={c} strokeWidth={2} />
      <Circle cx={12} cy={12} r={2} stroke={c} strokeWidth={2} />
      <Path stroke={c} strokeWidth={2} d="M12 4v4M12 16v4M4 12h4M16 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8" />
    </>
  ),
  "mag wheels": (c) => (
    <>
      <Circle cx={12} cy={12} r={8} stroke={c} strokeWidth={2} />
      <Circle cx={12} cy={12} r={2} stroke={c} strokeWidth={2} />
    </>
  ),
  "reverse camera": (c) => (
    <>
      <Rect x={3} y={7} width={14} height={10} rx={2} stroke={c} strokeWidth={2} />
      <Path stroke={c} strokeWidth={2} d="M17 10l4-2v8l-4-2" />
    </>
  ),
  sunroof: (c) => (
    <>
      <Path stroke={c} strokeWidth={2} d="M3 16l3-8a2 2 0 0 1 2-1h8a2 2 0 0 1 2 1l3 8" />
      <Rect x={2} y={16} width={20} height={4} rx={1} stroke={c} strokeWidth={2} />
      <Circle cx={12} cy={9} r={1.5} stroke={c} strokeWidth={1.6} />
    </>
  ),
  bluetooth: (c) => <Path stroke={c} strokeWidth={2} d="M7 7l10 10-5 5V2l5 5L7 17" />,
  abs: (c) => (
    <>
      <Path stroke={c} strokeWidth={2} d="M12 14l3-5" />
      <Circle cx={12} cy={14} r={1.5} fill={c} />
      <Path stroke={c} strokeWidth={2} d="M4 19a9 9 0 1 1 16 0" />
    </>
  ),
  airbags: (c) => (
    <>
      <Circle cx={12} cy={12} r={9} stroke={c} strokeWidth={2} />
      <Path stroke={c} strokeWidth={2} d="M12 8v5M12 16h.01" />
    </>
  ),
  "tow bar": (c) => <Path stroke={c} strokeWidth={2} d="M3 17h6M14 17h7M9 17a3 3 0 0 0 6 0" />,
  water: (c) => <Path stroke={c} strokeWidth={2} d="M12 2.7s6 6 6 10.8a6 6 0 0 1-12 0c0-4.8 6-10.8 6-10.8z" />,
  electricity: (c) => <Path stroke={c} strokeWidth={2} d="M13 2L3 14h7l-1 8 10-12h-7z" />,
  wifi: (c) => (
    <Path
      stroke={c}
      strokeWidth={2}
      d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01"
    />
  ),
  "own bathroom": (c) => (
    <>
      <Path stroke={c} strokeWidth={2} d="M4 12h16v4a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" />
      <Path stroke={c} strokeWidth={2} d="M6 12V6a2 2 0 0 1 3.4-1.4" />
      <Line x1={2} y1={19} x2={22} y2={19} stroke={c} strokeWidth={2} />
    </>
  ),
  "kitchen access": (c) => <Path stroke={c} strokeWidth={2} d="M8 2v6M11 2v6M8 5h3M18 2v20M18 2a4 4 0 0 0-4 4v4h4" />,
  parking: (c) => (
    <>
      <Rect x={3} y={3} width={18} height={18} rx={2} stroke={c} strokeWidth={2} />
      <Path stroke={c} strokeWidth={2} d="M9 16V8h3a2.5 2.5 0 0 1 0 5H9" />
    </>
  ),
  "prepaid meter": (c) => (
    <>
      <Path stroke={c} strokeWidth={2} d="M12 14l3-5" />
      <Circle cx={12} cy={14} r={1.5} fill={c} />
      <Path stroke={c} strokeWidth={2} d="M4 19a9 9 0 1 1 16 0" />
    </>
  ),
  furnished: (c) => <Path stroke={c} strokeWidth={2} d="M4 13V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6 M2 13h20v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z M4 18v2M20 18v2" />,
  vaccinated: (c) => <Path stroke={c} strokeWidth={2} d="M18 3l3 3-2 2 1 1-8 8-4-4 8-8 1 1z M5 15l-2 6 6-2" />,
  dewormed: (c) => (
    <>
      <Rect x={7} y={2} width={10} height={20} rx={5} stroke={c} strokeWidth={2} />
      <Line x1={7} y1={12} x2={17} y2={12} stroke={c} strokeWidth={2} />
    </>
  ),
  trained: (c) => (
    <>
      <Path stroke={c} strokeWidth={2} d="M12 1l2.6 1.4 2.9-.4 1.3 2.6 2.6 1.3-.4 2.9L22 12l-1.4 2.6.4 2.9-2.6 1.3-1.3 2.6-2.9-.4L12 23l-2.6-1.4-2.9.4-1.3-2.6-2.6-1.3.4-2.9L2 12l1.4-2.6-.4-2.9 2.6-1.3 1.3-2.6 2.9.4z" />
      <Path stroke={c} strokeWidth={1.8} d="M8.5 12.3l2.3 2.3 4.5-4.9" />
    </>
  ),
  "papers/pedigree": (c) => (
    <>
      <Path stroke={c} strokeWidth={2} d="M6 2h9l4 4v16H6z" />
      <Line x1={9} y1={12} x2={15} y2={12} stroke={c} strokeWidth={2} />
      <Line x1={9} y1={16} x2={15} y2={16} stroke={c} strokeWidth={2} />
    </>
  ),
};

export function FeatureIcon({ name, color, size = 14 }: { name: string; color: string; size?: number }) {
  const render = ICONS[name.toLowerCase()];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {render ? render(color) : <Circle cx={12} cy={12} r={3} fill={color} />}
    </Svg>
  );
}
