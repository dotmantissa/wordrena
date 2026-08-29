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
  ember: "#c95736",
  tide: "#357d91",
  gale: "#4c8b72",
  terra: "#7b8145",
  umbra: "#765a75",
  lumen: "#b8883e",
};

export const elementSoftTone: Record<ElementName, string> = {
  ember: "#e5a083",
  tide: "#9bc3ca",
  gale: "#a5c9ad",
  terra: "#c6c995",
  umbra: "#c7afc4",
  lumen: "#e5c58c",
};

export function asElement(value: string): ElementName {
  return ELEMENTS.includes(value as ElementName)
    ? (value as ElementName)
    : "lumen";
}
