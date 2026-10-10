// Inline stroke icons (24px grid, currentColor). Keeps the app dependency-free.
const PATHS = {
  check: ["M20 6 9 17l-5-5"],
  x: ["M18 6 6 18", "M6 6l12 12"],
  plus: ["M12 5v14", "M5 12h14"],
  arrowRight: ["M5 12h14", "m12 5 7 7-7 7"],
  arrowLeft: ["M19 12H5", "m12 19-7-7 7-7"],
  chevronDown: ["m6 9 6 6 6-6"],
  upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m17 8-5-5-5 5", "M12 3v12"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5", "M12 15V3"],
  file: ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4", "M16 13H8", "M16 17H8", "M10 9H8"],
  chart: ["M3 3v18h18", "M18 17V9", "M13 17V5", "M8 17v-3"],
  receipt: ["M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z", "M8 8h8", "M8 12h8", "M8 16h5"],
  truck: [
    "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2",
    "M15 18H9",
    "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62L18.3 9.38a1 1 0 0 0-.78-.38H14",
    "M17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    "M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  ],
  sparkles: ["M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z", "M19 3v4", "M21 5h-4", "M5 17v4", "M7 19H3"],
  clipboard: ["M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2", "M9 2h6v4H9Z", "m9 14 2 2 4-4"],
  calculator: ["M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z", "M8 6h8", "M8 11h.01", "M12 11h.01", "M16 11h.01", "M8 15h.01", "M12 15h.01", "M16 15h.01", "M8 19h.01", "M12 19h4"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m21 21-4.3-4.3"],
  landmark: ["M3 22h18", "M6 18v-7", "M10 18v-7", "M14 18v-7", "M18 18v-7", "M12 2 20 7H4Z"],
  tag: ["M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z", "M7.5 7.5h.01"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "m9 12 2 2 4-4"],
  send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
  store: ["M3 9l1.5-5h15L21 9", "M4 9v11h16V9", "M3 9h18", "M9 20v-6h6v6"],
  copy: ["M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z", "M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"],
  printer: ["M6 9V2h12v7", "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2", "M6 14h12v8H6Z"],
  external: ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
  alert: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 8v4", "M12 16h.01"],
  info: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 16v-4", "M12 8h.01"],
  question: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z", "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3", "M12 17h.01"],
  clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M12 6v6l4 2"],
  zap: ["M13 2 3 14h9l-1 8 10-12h-9Z"],
  spinner: ["M21 12a9 9 0 1 1-6.22-8.56"],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className, strokeWidth = 2 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
