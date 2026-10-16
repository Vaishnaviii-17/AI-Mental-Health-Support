/**
 * MindEase — Shared Audio Track Library
 *
 * Single source of truth for all calming audio tracks used by:
 *   - Guided Meditation (background music during sessions)
 *   - Calming Music (dedicated player)
 *
 * All audio files are locally hosted in /public/audio/meditation/ for 100% reliable offline/local playback.
 *
 * Licensing and Attribution:
 *   1. Ocean Waves: MIT License — Brad Traversy (Ambient Sound Mixer)
 *   2. Soft Rain: MIT License — Brad Traversy (Ambient Sound Mixer)
 *   3. Forest & Flowing Water: Public Domain — stephan (Wikimedia Commons)
 *   4. Gentle Piano: Public Domain — Erik Satie (Gymnopédie No.1, performed by Robin Alciatore, Musopen)
 *   5. Evening Ambience: MIT License — Brad Traversy (Ambient Sound Mixer)
 *   6. Birds & Nature: MIT License — Brad Traversy (Ambient Sound Mixer)
 *   7. Flowing Stream: CC BY 4.0 — Gravity Sound (https://gravitysound.studio/)
 *   8. Deep Calm: CC BY 3.0 — Kevin MacLeod (Meditation Impromptu 01, Incompetech.com)
 */

export const SHARED_AUDIO_TRACKS = [
  {
    id: "waves",
    label: "Ocean Waves",
    emoji: "🌊",
    src: "/audio/meditation/ocean-waves.mp3",
    description: "Gentle coastal waves, soothing and rhythmic",
    license: "MIT License",
    attribution: "Brad Traversy (Ambient Sound Mixer)",
  },
  {
    id: "rain",
    label: "Soft Rain",
    emoji: "🌧️",
    src: "/audio/meditation/soft-rain.mp3",
    description: "Soft, steady rainfall — ideal for quiet focus",
    license: "MIT License",
    attribution: "Brad Traversy (Ambient Sound Mixer)",
  },
  {
    id: "forest",
    label: "Forest & Flowing Water",
    emoji: "🌿",
    src: "/audio/meditation/forest-water.ogg",
    description: "A tranquil woodland stream trickling past green moss",
    license: "Public Domain",
    attribution: "stephan (Wikimedia Commons)",
  },
  {
    id: "instrumental",
    label: "Gentle Piano",
    emoji: "🎵",
    src: "/audio/meditation/gentle-instrumental.mp3",
    description: "Satie's Gymnopédie No. 1 — peaceful, melodic and timeless",
    license: "Public Domain",
    attribution: "Erik Satie, performed by Robin Alciatore (Musopen)",
  },
  {
    id: "evening",
    label: "Evening Ambience",
    emoji: "🌙",
    src: "/audio/meditation/evening-ambience.mp3",
    description: "Crickets, gentle breeze, and dusk atmosphere",
    license: "MIT License",
    attribution: "Brad Traversy (Ambient Sound Mixer)",
  },
  {
    id: "birds",
    label: "Birds & Nature",
    emoji: "🐦",
    src: "/audio/meditation/birds-nature.mp3",
    description: "Gentle birdsong in a tranquil morning canopy",
    license: "MIT License",
    attribution: "Brad Traversy (Ambient Sound Mixer)",
  },
  {
    id: "stream",
    label: "Flowing Stream",
    emoji: "💧",
    src: "/audio/meditation/flowing-stream.mp3",
    description: "Clear mountain river water rippling over smooth stones",
    license: "CC BY 4.0",
    attribution: "Gravity Sound (gravitysound.studio)",
  },
  {
    id: "deep",
    label: "Deep Calm",
    emoji: "🧘",
    src: "/audio/meditation/deep-calm.mp3",
    description: "Meditation Impromptu 01 — harmonic ambient stillness",
    license: "CC BY 3.0",
    attribution: "Kevin MacLeod (incompetech.com)",
  },
];

/**
 * Special non-file options available only in Meditation (synthetic 432Hz tone or silence).
 */
export const MEDITATION_EXTRA_OPTIONS = [
  {
    id: "ambient",
    label: "Ambient Tone",
    emoji: "✨",
    src: null, // Synthesized via Web Audio API (432Hz sine)
    description: "Soft 432Hz sine wave tone — subtle grounding drone",
    license: "Generated Web Audio",
    attribution: "MindEase Web Audio Synthesizer",
  },
  {
    id: "off",
    label: "Sound Off",
    emoji: "🔇",
    src: null,
    description: "Silent meditation without background audio",
    license: null,
    attribution: null,
  },
];

/**
 * Full list for Meditation selector (8 music tracks + ambient synth + off).
 */
export const MEDITATION_AUDIO_TRACKS = [
  ...SHARED_AUDIO_TRACKS,
  ...MEDITATION_EXTRA_OPTIONS,
];

/**
 * Get a track by ID.
 */
export function getTrackById(id, includeExtras = false) {
  const list = includeExtras ? MEDITATION_AUDIO_TRACKS : SHARED_AUDIO_TRACKS;
  return list.find((t) => t.id === id) || null;
}
