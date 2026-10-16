# MindEase — Calming Audio Library Attribution & Licensing

This document details all 8 locally hosted calming audio tracks used across **Guided Meditation** and **Calming Music** in MindEase.

All assets are stored locally in `frontend/public/audio/meditation/` to ensure 100% reliable, zero-latency, offline-capable playback without external streaming dependencies.

---

## Track Inventory & Metadata

| # | Track Name | File Name | Format | File Size | Source & Origin | License | Attribution Requirements |
|---|---|---|---|---|---|---|---|
| 1 | **Ocean Waves** | `ocean-waves.mp3` | MP3 (audio/mpeg) | 4,226,403 bytes (~4.1 MB) | Ambient Sound Mixer (Brad Traversy) | MIT License | "Ambient Sound Mixer by Brad Traversy" |
| 2 | **Soft Rain** | `soft-rain.mp3` | MP3 (audio/mpeg) | 3,477,420 bytes (~3.4 MB) | Ambient Sound Mixer (Brad Traversy) | MIT License | "Ambient Sound Mixer by Brad Traversy" |
| 3 | **Forest & Flowing Water** | `forest-water.ogg` | OGG (audio/ogg) | 552,177 bytes (~539 KB) | Wikimedia Commons (`File:Welling rivulet in the woods.ogg`) | Public Domain | Dedicated to the public domain by author *stephan* |
| 4 | **Gentle Piano** | `gentle-instrumental.mp3` | MP3 (audio/mpeg) | 2,939,825 bytes (~2.9 MB) | Musopen / Internet Archive | Public Domain | Erik Satie (*Gymnopédie No. 1*), performed by Robin Alciatore |
| 5 | **Evening Ambience** | `evening-ambience.mp3` | MP3 (audio/mpeg) | 1,637,760 bytes (~1.6 MB) | Ambient Sound Mixer (Brad Traversy) | MIT License | "Ambient Sound Mixer by Brad Traversy" |
| 6 | **Birds & Nature** | `birds-nature.mp3` | MP3 (audio/mpeg) | 12,726,240 bytes (~12.4 MB) | Ambient Sound Mixer (Brad Traversy) | MIT License | "Ambient Sound Mixer by Brad Traversy" |
| 7 | **Flowing Stream** | `flowing-stream.mp3` | MP3 (audio/mpeg) | 187,958 bytes (~184 KB) | Wikimedia Commons (`File:River flowing (Gravity Sound).mp3`) | CC BY 4.0 | Gravity Sound ([gravitysound.studio](https://gravitysound.studio/)) |
| 8 | **Deep Calm** | `deep-calm.mp3` | MP3 (audio/mpeg) | 7,042,622 bytes (~6.9 MB) | Incompetech.com (`Meditation Impromptu 01`) | CC BY 3.0 | Kevin MacLeod ([incompetech.com](https://incompetech.com/)) |

---

## Synthesizer Fallbacks (Non-file Options)

- **Ambient Tone (432Hz Sine Wave):** Synthesized dynamically using the Web Audio API (`AudioContext`, `OscillatorNode`, and `GainNode`). No audio file required.
- **Sound Off:** Silent playback without audio element initialization.

---

## Audio Architecture & Safety Guarantees

1. **Single Audio Instance per View:** Each feature (`CalmingMusic` and `Meditation`) maintains a dedicated single `audioRef` / `audioElementRef`. Previous audio is paused, disconnected, and detached (`audio.src = ""`) before switching tracks or unmounting.
2. **Zero Overlap:** Switching tracks or navigating routes stops the prior sound source immediately before loading the new track.
3. **No Autoplay Surprise:** All audio playback requires an explicit user gesture (clicking Play or choosing an explicit track to start).
4. **Volume Safety:** Default volume is kept low (30% in Meditation to keep instructions clear; 40% in Calming Music for gentle listening).
5. **Accurate Mindful Tracking:** Activity sessions recorded to the database count only actual seconds played — paused periods are never credited as listening time.
