const SYMBOLS = "!@#$%&*?";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const NUMBERS = "23456789";

function pick(source) {
  return source[Math.floor(Math.random() * source.length)];
}

/**
 * Generates a 14-character password containing uppercase, lowercase,
 * numbers and symbols.
 */
export function generatePassword(length = 14) {
  const pools = [UPPER, LOWER, NUMBERS, SYMBOLS];
  const required = pools.map((pool) => pick(pool));

  const all = UPPER + LOWER + NUMBERS + SYMBOLS;
  const rest = Array.from({ length: length - required.length }, () =>
    pick(all)
  );

  const chars = [...required, ...rest];

  // Shuffle (Fisher-Yates) so required chars aren't always at the start.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

export default generatePassword;
