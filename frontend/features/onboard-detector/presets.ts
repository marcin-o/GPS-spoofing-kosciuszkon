export type FeatureKey =
  | "cn0_ch1"
  | "doppler_ch1"
  | "agc_level"
  | "satellite_count"
  | "carrier_phase_var"
  | "pseudorange_residual_m"
  | "clock_drift_us"
  | "position_residual_m";

export type FeatureSpec = {
  key: FeatureKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  hint: string;
};

export const FEATURES: FeatureSpec[] = [
  {
    key: "cn0_ch1",
    label: "C/N₀ (channel 1)",
    unit: "dB-Hz",
    min: 20,
    max: 55,
    step: 0.5,
    hint: "Carrier-to-noise density. Authentic GPS typically 40–50.",
  },
  {
    key: "doppler_ch1",
    label: "Doppler shift",
    unit: "Hz",
    min: 0,
    max: 5000,
    step: 50,
    hint: "Receiver-frame Doppler. Spoofers often miss orbital geometry.",
  },
  {
    key: "agc_level",
    label: "AGC level",
    unit: "norm.",
    min: 0,
    max: 1,
    step: 0.01,
    hint: "Automatic gain control. Strong nearby transmitter pushes this up.",
  },
  {
    key: "satellite_count",
    label: "Satellite count",
    unit: "sats",
    min: 0,
    max: 20,
    step: 1,
    hint: "Number of locked SVs. Spoofers may transmit narrow constellations.",
  },
  {
    key: "carrier_phase_var",
    label: "Carrier phase variance",
    unit: "rad²",
    min: 0,
    max: 1,
    step: 0.01,
    hint: "Higher variance suggests inconsistent timing.",
  },
  {
    key: "pseudorange_residual_m",
    label: "Pseudorange residual",
    unit: "m",
    min: 0,
    max: 200,
    step: 1,
    hint: "Solution-fit residual. Real GNSS < 5 m.",
  },
  {
    key: "clock_drift_us",
    label: "Clock drift",
    unit: "µs",
    min: 0,
    max: 50,
    step: 0.5,
    hint: "Receiver clock drift rate.",
  },
  {
    key: "position_residual_m",
    label: "Position residual",
    unit: "m",
    min: 0,
    max: 1000,
    step: 5,
    hint: "Distance between predicted and observed position.",
  },
];

export type PresetKey = "clean" | "meaconing" | "sophisticated";

export const PRESETS: Record<PresetKey, Record<FeatureKey, number>> = {
  clean: {
    cn0_ch1: 47.5,
    doppler_ch1: 1500,
    agc_level: 0.42,
    satellite_count: 11,
    carrier_phase_var: 0.04,
    pseudorange_residual_m: 3,
    clock_drift_us: 0.8,
    position_residual_m: 12,
  },
  meaconing: {
    cn0_ch1: 36.0,
    doppler_ch1: 1900,
    agc_level: 0.62,
    satellite_count: 7,
    carrier_phase_var: 0.18,
    pseudorange_residual_m: 24,
    clock_drift_us: 4.5,
    position_residual_m: 110,
  },
  sophisticated: {
    cn0_ch1: 29.5,
    doppler_ch1: 3400,
    agc_level: 0.86,
    satellite_count: 4,
    carrier_phase_var: 0.42,
    pseudorange_residual_m: 88,
    clock_drift_us: 12,
    position_residual_m: 540,
  },
};

export const PRESET_LABELS: Record<PresetKey, string> = {
  clean: "Clean GNSS",
  meaconing: "Meaconing",
  sophisticated: "Sophisticated spoof",
};
