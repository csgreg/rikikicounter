// Opposing-concept pairs for the spectrum (left ↔ right) live in the i18n
// locale files (wave.spectra) so they translate along with everything else.
// pick a pair that isn't the given one (by left label)
export function pickSpectrum(
  pairs: Array<[string, string]>,
  prevLeft?: string
): [string, string] {
  let pair = pairs[Math.floor(Math.random() * pairs.length)];
  if (prevLeft && pairs.length > 1) {
    while (pair[0] === prevLeft) {
      pair = pairs[Math.floor(Math.random() * pairs.length)];
    }
  }
  return pair;
}

// secret target, kept away from the very edges
export function randomTarget(): number {
  return Math.round(8 + Math.random() * 84);
}
