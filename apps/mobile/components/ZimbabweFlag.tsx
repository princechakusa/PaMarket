// Inline SVG Zimbabwe flag (the app avoids emoji — see the brand icon rule).
import Svg, { Path, Polygon, Rect } from "react-native-svg";

export function ZimbabweFlag({ width = 18 }: { width?: number }) {
  const h = width / 2;
  const stripes = ["#319208", "#FFD200", "#DE2010", "#000000", "#DE2010", "#FFD200", "#319208"];
  return (
    <Svg width={width} height={h} viewBox="0 0 28 14" accessibilityLabel="Zimbabwe flag">
      {stripes.map((c, i) => (
        <Rect key={i} x={0} y={i * 2} width={28} height={2} fill={c} />
      ))}
      <Polygon points="0,0 12,7 0,14" fill="#FFFFFF" stroke="#000000" strokeWidth={0.5} />
      <Path d="M4.2 5.4l.55 1.55h1.6l-1.3.95.5 1.55-1.35-.95-1.35.95.5-1.55-1.3-.95h1.6z" fill="#DE2010" />
    </Svg>
  );
}
