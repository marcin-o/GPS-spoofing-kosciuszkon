export const tokens = {
  colors: {
    honeywell: "#EE3124",
    honeywellDark: "#B81C12",
    bgBase: "rgb(2, 6, 23)",
    bgPanel: "rgb(15, 23, 42)",
    bgPanelHover: "rgb(30, 41, 59)",
    border: "rgba(148, 163, 184, 0.12)",
    borderStrong: "rgba(148, 163, 184, 0.25)",
    textPrimary: "rgb(241, 245, 249)",
    textSecondary: "rgb(148, 163, 184)",
    textMuted: "rgb(100, 116, 139)",
    verdictOk: "rgb(16, 185, 129)",
    verdictWarn: "rgb(245, 158, 11)",
    verdictCrit: "rgb(239, 68, 68)",
    accentCyan: "rgb(34, 211, 238)",
    accentViolet: "rgb(139, 92, 246)",
  },
  motion: {
    fast: 0.15,
    base: 0.25,
    slow: 0.4,
    spring: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
} as const;

export type Tokens = typeof tokens;
