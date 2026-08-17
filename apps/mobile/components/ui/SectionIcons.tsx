import Svg, { Path, Circle } from "react-native-svg";

// Section glyphs for the Post a Job cards. Stroke-only so they inherit the
// brand colour and stay legible on the tinted badge in both themes.
type P = { c: string; size?: number };

export function BriefcaseIcon({ c, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 8h18v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke={c} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2" stroke={c} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 13h18" stroke={c} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function DocumentIcon({ c, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h8l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" stroke={c} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M8 12h8M8 16h6" stroke={c} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function ToolsIcon({ c, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14.7 6.3a4 4 0 105.6 5.6L21 21l-9.1-0.7a4 4 0 10-5.6-5.6L3 3l9.1 0.7z" stroke={c} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

export function MoneyIcon({ c, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={c} strokeWidth={2} />
      <Path d="M12 7v10M14.5 9.5c0-1-1.1-1.6-2.5-1.6s-2.5.6-2.5 1.7c0 2.4 5 1.3 5 3.7 0 1.1-1.1 1.8-2.5 1.8s-2.5-.7-2.5-1.7" stroke={c} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function CheckCircleIcon({ c, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} fill={c} />
      <Path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SendIcon({ c, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 3L3 10.5l7 2.5 2.5 7L21 3z" stroke={c} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
