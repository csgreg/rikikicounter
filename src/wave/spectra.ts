// Opposing-concept pairs for the spectrum (left ↔ right), in Hungarian.
export const SPECTRA: Array<[string, string]> = [
  ["Hideg", "Meleg"],
  ["Túlértékelt", "Alulértékelt"],
  ["Haszontalan", "Hasznos"],
  ["Olcsó", "Drága"],
  ["Gyerekeknek való", "Felnőtteknek való"],
  ["Egészséges", "Egészségtelen"],
  ["Ijesztő", "Cuki"],
  ["Hétköznapi", "Különleges"],
  ["Régi divat", "Mai divat",],
  ["Kínos", "Menő"],
  ["Csendes", "Hangos"],
  ["Veszélyes", "Biztonságos"],
  ["Bonyolult", "Egyszerű"],
  ["Felejthető", "Emlékezetes"],
  ["Komoly", "Vicces"],
  ["Lassú", "Gyors"],
  ["Romantikus", "Nem romantikus"],
  ["Tiszta", "Koszos"],
  ["Trendi", "Ciki"],
  ["Csúnya", "Gyönyörű"],
  ["Könnyű", "Nehéz"],
  ["Mindennapi étel", "Ünnepi étel"],
  ["Introvertált", "Extrovertált"],
  ["Felesleges luxus", "Alapszükséglet"],
  ["Túl sok", "Túl kevés"],
];

// pick a pair that isn't the given one (by left label)
export function pickSpectrum(prevLeft?: string): [string, string] {
  let pair = SPECTRA[Math.floor(Math.random() * SPECTRA.length)];
  if (prevLeft && SPECTRA.length > 1) {
    while (pair[0] === prevLeft) {
      pair = SPECTRA[Math.floor(Math.random() * SPECTRA.length)];
    }
  }
  return pair;
}

// secret target, kept away from the very edges
export function randomTarget(): number {
  return Math.round(8 + Math.random() * 84);
}
