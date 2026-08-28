export const ELEMENTS = [
  "ember",
  "tide",
  "gale",
  "terra",
  "umbra",
  "lumen",
] as const;

export type ElementName = (typeof ELEMENTS)[number];

export const elementTone: Record<ElementName, string> = {
  ember: "#ff6a45",
  tide: "#38a8ff",
  gale: "#35e0c0",
  terra: "#8ccb57",
  umbra: "#9b6bff",
  lumen: "#ffcb52",
};

export const elementSoftTone: Record<ElementName, string> = {
  ember: "#ffb099",
  tide: "#9bd5ff",
  gale: "#9ff2e3",
  terra: "#c6e7a7",
  umbra: "#c8aaff",
  lumen: "#ffe9a8",
};

export function asElement(value: string): ElementName {
  return ELEMENTS.includes(value as ElementName)
    ? (value as ElementName)
    : "lumen";
}
