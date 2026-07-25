// Opposing-concept pairs for the spectrum (left ↔ right) live in the i18n
// locale files (wave.spectra) so they translate along with everything else.
// Returns an INDEX (not resolved text) so every client can look the pair up
// in their own current language at render time.
// pick an index that isn't the given one
export function pickSpectrumIndex(poolSize: number, prevIndex?: number): number {
  let index = Math.floor(Math.random() * poolSize);
  if (prevIndex != null && poolSize > 1) {
    while (index === prevIndex) {
      index = Math.floor(Math.random() * poolSize);
    }
  }
  return index;
}

// secret target, kept away from the very edges
export function randomTarget(): number {
  return Math.round(8 + Math.random() * 84);
}
