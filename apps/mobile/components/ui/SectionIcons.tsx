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

export function BuildingIcon({ c, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 21V5a1 1 0 011-1h9a1 1 0 011 1v16" stroke={c} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M15 10h4a1 1 0 011 1v10" stroke={c} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M8 8h3M8 12h3M8 16h3M2 21h20" stroke={c} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function UsersIcon({ c, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3.2} stroke={c} strokeWidth={2} />
      <Path d="M3 20a6 6 0 0112 0" stroke={c} strokeWidth={2} strokeLinecap="round" />
      <Path d="M16.5 5.5a3 3 0 010 5.6M17 20a6 6 0 00-1.6-4" stroke={c} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function ClockIcon({ c, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={c} strokeWidth={2} />
      <Path d="M12 7v5.2l3.2 2" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PinIcon({ c, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" stroke={c} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={12} cy={10} r={2.6} stroke={c} strokeWidth={2} />
    </Svg>
  );
}

export function CalendarIcon({ c, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6a1 1 0 011-1h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6z" stroke={c} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M8 3v4M16 3v4M4 10h16" stroke={c} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function DollarIcon({ c, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v18" stroke={c} strokeWidth={2} strokeLinecap="round" />
      <Path d="M16 7.5C16 6 14.2 5 12 5S8 6 8 7.8c0 4 8 2.2 8 6.2 0 1.8-1.8 3-4 3s-4-1-4-2.5" stroke={c} strokeWidth={2} strokeLinecap="round" />
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
