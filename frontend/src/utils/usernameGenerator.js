const ADJECTIVES = [
  "Calm", "Silent", "Blue", "Gentle", "Quiet", "Soft", "Bright", "Still",
  "Warm", "Clear", "Peaceful", "Golden", "Misty", "Deep", "Kind", "Serene",
];

const NOUNS = [
  "River", "Leaf", "Ocean", "Meadow", "Willow", "Harbor", "Cloud", "Forest",
  "Petal", "Horizon", "Ember", "Stone", "Breeze", "Garden", "Feather", "Tide",
];

function pick(source) {
  return source[Math.floor(Math.random() * source.length)];
}

/**
 * Generates a username in the pattern Adjective + Noun + Number.
 * e.g. "CalmRiver483", "SilentLeaf81", "BlueOcean293"
 */
export function generateUsername() {
  const adjective = pick(ADJECTIVES);
  const noun = pick(NOUNS);
  const number = Math.floor(Math.random() * 900) + 100; // 3-digit
  return `${adjective}${noun}${number}`;
}

export default generateUsername;
