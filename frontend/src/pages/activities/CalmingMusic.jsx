import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Clock,
  RotateCcw,
  Info,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import Navbar from "../../components/Navbar/Navbar";
import { SHARED_AUDIO_TRACKS } from "./audioTracks";
import { saveActivitySession } from "../../services/activityService";
import "./CalmingMusic.css";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

const TIMER_PRESETS = [
  { label: "No Timer", seconds: 0 },
  { label: "5 min", seconds: 5 * 60 },
  { label: "10 min", seconds: 10 * 60 },
  { label: "15 min", seconds: 15 * 60 }
];

function CalmingMusic() {
  const storedUser = getStoredUser();
  const navigate = useNavigate();

  // Current track index (default first track: Ocean Waves)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const currentTrack = SHARED_AUDIO_TRACKS[currentTrackIndex] || SHARED_AUDIO_TRACKS[0];

  // Playback state (NO autoplay: starts false)
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4); // gentle 40% default volume
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState(null);

  // Timer state
  const [selectedPresetSeconds, setSelectedPresetSeconds] = useState(0); // 0 = continuous
  const [remainingTimerSeconds, setRemainingTimerSeconds] = useState(0);
  const [isTimerComplete, setIsTimerComplete] = useState(false);

  // Activity session tracking: tracks actual listened seconds (excluding paused time)
  const listenedSecondsRef = useRef(0);
  const hasLoggedSessionRef = useRef(false);

  // Single HTML5 Audio instance reference
  const audioRef = useRef(null);

  // Stop and clean up any playing audio
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (_) {}
    }
  }, []);

  // Initialize or load audio source on track change
  const loadTrack = useCallback((track, autoStart = false) => {
    setAudioError(null);
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true;
    }

    const audio = audioRef.current;
    audio.pause();
    audio.src = track.src;
    audio.volume = isMuted ? 0 : volume;

    if (autoStart) {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("Audio playback interrupted or blocked:", err.message);
          setIsPlaying(false);
          setAudioError("Click Play to start listening.");
        });
    } else {
      setIsPlaying(false);
    }
  }, [isMuted, volume]);

  // Load selected track whenever currentTrackIndex changes
  useEffect(() => {
    // Only autostart if user was already playing before switching tracks
    loadTrack(currentTrack, isPlaying);
  }, [currentTrackIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount — stops audio cleanly and prevents sound leaks
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  // Update volume on the audio element smoothly
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle countdown timer & actual listening seconds
  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        // Increment actual listened seconds
        listenedSecondsRef.current += 1;

        // If a timed preset is active, count down
        if (selectedPresetSeconds > 0) {
          setRemainingTimerSeconds((prev) => {
            if (prev <= 1) {
              // Timer finished cleanly
              clearInterval(interval);
              handleTimerComplete();
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, selectedPresetSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Log activity session safely to backend
  const logSessionToBackend = useCallback(async (forcedCompleted = true) => {
    const secondsListened = listenedSecondsRef.current;
    if (secondsListened < 5 || hasLoggedSessionRef.current) return;
    hasLoggedSessionRef.current = true;

    try {
      await saveActivitySession({
        activity_type: "calming_music",
        score: 100,
        duration_seconds: secondsListened,
        completed: forcedCompleted,
        metadata: {
          track_id: currentTrack.id,
          track_label: currentTrack.label,
          preset_minutes: selectedPresetSeconds > 0 ? selectedPresetSeconds / 60 : 0,
          timed_finish: forcedCompleted && selectedPresetSeconds > 0
        }
      });
    } catch (err) {
      console.warn("Unable to save calming music session:", err.message);
    }
  }, [currentTrack.id, currentTrack.label, selectedPresetSeconds]);

  // When timer finishes naturally
  const handleTimerComplete = () => {
    setIsPlaying(false);
    stopAudio();
    setIsTimerComplete(true);
    logSessionToBackend(true);
  };

  // User explicitly toggles Play/Pause
  const togglePlayPause = () => {
    setAudioError(null);
    if (!audioRef.current) {
      loadTrack(currentTrack, true);
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("Playback error:", err.message);
          setAudioError("Unable to play audio. Tap to try again.");
          setIsPlaying(false);
        });
    }
  };

  // Track selection (preserves remaining timer and playing state)
  const handleSelectTrack = (index) => {
    if (index === currentTrackIndex) {
      togglePlayPause();
      return;
    }
    setCurrentTrackIndex(index);
    // If playing, loadTrack will automatically keep playing the new track
  };

  const handleNextTrack = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % SHARED_AUDIO_TRACKS.length);
  };

  const handlePrevTrack = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + SHARED_AUDIO_TRACKS.length) % SHARED_AUDIO_TRACKS.length);
  };

  // Timer Preset Selection
  const handleSelectPreset = (seconds) => {
    setSelectedPresetSeconds(seconds);
    setRemainingTimerSeconds(seconds);
    setIsTimerComplete(false);
  };

  // Volume slider handler
  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (isMuted && val > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  // Done / Reset after timer complete
  const handleResetSession = () => {
    setIsTimerComplete(false);
    listenedSecondsRef.current = 0;
    hasLoggedSessionRef.current = false;
    setRemainingTimerSeconds(selectedPresetSeconds);
  };

  const handleExitToActivities = async () => {
    stopAudio();
    await logSessionToBackend(false);
    navigate("/activities");
  };

  return (
    <div className="app-layout calming-music-page-container">
      <Navbar profile={storedUser} />

      <div className="container app-content-wrapper">
        <header className="page-header music-header">
          <div className="page-header__title-row">
            <button
              type="button"
              onClick={handleExitToActivities}
              className="btn btn-ghost back-btn-layout"
              aria-label="Back to Activities"
            >
              <ArrowLeft size={16} /> Back to Activities
            </button>
          </div>
        </header>

        <main className="music-player-main-layout">
          
          {/* ============================================================== */}
          {/* LEFT COLUMN: ACTIVE HERO PLAYER                                */}
          {/* ============================================================== */}
          <div className="music-player-left-col">
            <section className="music-card music-hero-player-card" aria-label="Calming Music Player">
              
              {/* Header info */}
              <div className="player-top-status">
                <span className="eyebrow eyebrow-wellness">
                  <Music size={14} className="status-music-icon" /> Calming Music
                </span>
                {selectedPresetSeconds > 0 && (
                  <div className="timer-badge-pill" aria-live="polite">
                    <Clock size={12} />
                    <span>{formatTime(remainingTimerSeconds)}</span>
                  </div>
                )}
              </div>

              {/* Visualizer Halo Orb */}
              <div className="music-visualizer-container" aria-hidden="true">
                <div className={`music-halo-glow ${isPlaying ? "is-pulsing" : ""}`} />
                <div className={`music-halo-ring ${isPlaying ? "is-spinning" : ""}`} />
                <div className={`music-center-orb ${isPlaying ? "is-playing" : ""}`}>
                  <span className="current-track-emoji">{currentTrack.emoji}</span>
                </div>
              </div>

              {/* Track Info */}
              <div className="current-track-meta">
                <h2 className="current-track-title">{currentTrack.label}</h2>
                <p className="current-track-desc">{currentTrack.description}</p>
                <span className="current-track-attribution">
                  🌿 {currentTrack.attribution} · <em>{currentTrack.license}</em>
                </span>
              </div>

              {/* Error or Notice Alert */}
              {audioError && (
                <div className="music-error-banner" role="alert">
                  <AlertCircle size={14} />
                  <span>{audioError}</span>
                </div>
              )}

              {/* Main Playback Controls */}
              <div className="music-controls-group">
                <button
                  type="button"
                  onClick={handlePrevTrack}
                  className="btn-round-ctrl btn-secondary-ctrl"
                  aria-label="Previous track"
                  title="Previous track"
                >
                  <SkipBack size={18} />
                </button>

                <button
                  type="button"
                  onClick={togglePlayPause}
                  className={`btn-round-ctrl btn-play-large ${isPlaying ? "is-active-playing" : ""}`}
                  aria-label={isPlaying ? "Pause music" : "Play music"}
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
                </button>

                <button
                  type="button"
                  onClick={handleNextTrack}
                  className="btn-round-ctrl btn-secondary-ctrl"
                  aria-label="Next track"
                  title="Next track"
                >
                  <SkipForward size={18} />
                </button>
              </div>

              {/* Volume Control Bar */}
              <div className="music-volume-bar">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="music-vol-btn"
                  aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="music-vol-slider"
                  aria-label="Audio volume"
                  title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                />
                <span className="vol-percent-label">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
              </div>

              {/* Listening Timer Selector */}
              <div className="listening-timer-section">
                <span className="timer-select-label">
                  <Clock size={13} /> Listening Timer:
                </span>
                <div className="timer-presets-row" role="radiogroup" aria-label="Listening timer presets">
                  {TIMER_PRESETS.map((p) => {
                    const isSelected = selectedPresetSeconds === p.seconds;
                    return (
                      <button
                        key={p.seconds}
                        type="button"
                        className={`timer-preset-btn ${isSelected ? "is-selected" : ""}`}
                        onClick={() => handleSelectPreset(p.seconds)}
                        aria-checked={isSelected}
                        role="radio"
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

            </section>
          </div>

          {/* ============================================================== */}
          {/* RIGHT COLUMN: 8-TRACK LIBRARY & ACCESSIBLE CREDITS             */}
          {/* ============================================================== */}
          <div className="music-player-right-col">
            
            {/* CARD B: 8-TRACK AUDIO LIBRARY LIST */}
            <section className="music-card music-library-card" aria-label="Audio Library">
              <div className="library-card-header">
                <div className="library-title-row">
                  <h3>Calming Sounds Library</h3>
                  <span className="library-count-badge">{SHARED_AUDIO_TRACKS.length} Tracks</span>
                </div>
                <p className="library-card-subtitle">
                  Select any calming sound or ambient melody to listen seamlessly.
                </p>
              </div>

              <div className="track-grid-list" role="list">
                {SHARED_AUDIO_TRACKS.map((track, idx) => {
                  const isSelected = idx === currentTrackIndex;
                  const isThisPlaying = isSelected && isPlaying;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      className={`track-item-card ${isSelected ? "is-selected-track" : ""}`}
                      onClick={() => handleSelectTrack(idx)}
                      aria-label={`Track ${idx + 1}: ${track.label}. ${isSelected && isPlaying ? "Currently playing" : "Click to select"}`}
                    >
                      <div className="track-item-left">
                        <div className="track-item-icon-box">
                          <span className="track-emoji">{track.emoji}</span>
                        </div>
                        <div className="track-item-info">
                          <div className="track-label-row">
                            <h4 className="track-item-name">{track.label}</h4>
                            {isSelected && (
                              <span className="playing-now-pill">
                                {isThisPlaying ? "Playing" : "Selected"}
                              </span>
                            )}
                          </div>
                          <p className="track-item-desc">{track.description}</p>
                        </div>
                      </div>

                      <div className="track-play-indicator" aria-hidden="true">
                        {isThisPlaying ? (
                          <div className="soundwave-animation">
                            <span className="wave-bar bar-1" />
                            <span className="wave-bar bar-2" />
                            <span className="wave-bar bar-3" />
                          </div>
                        ) : (
                          <Play size={14} fill="currentColor" className="track-play-arrow" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* CARD C: ACCESSIBLE CREDITS & LICENSING (Collapsible Accordion) */}
            <details className="music-card music-credits-accordion">
              <summary className="credits-summary-header">
                <div className="credits-summary-title">
                  <Info size={15} className="credits-info-icon" />
                  <h4>Audio Attributions & Licenses</h4>
                </div>
                <span className="credits-summary-badge">View details</span>
              </summary>
              <div className="credits-accordion-body">
                <p className="credits-intro-text">
                  MindEase relies on verified open-source, Creative Commons, and public domain recordings. All assets are locally hosted for calm, uninterrupted offline playback:
                </p>
                <ul className="credits-list">
                  {SHARED_AUDIO_TRACKS.map((t) => (
                    <li key={t.id}>
                      <strong>{t.emoji} {t.label}:</strong> {t.license} — {t.attribution}
                    </li>
                  ))}
                </ul>
              </div>
            </details>

          </div>

        </main>
      </div>

      {/* ================================================================== */}
      {/* COMPLETION MODAL / OVERLAY (When timer completes)                  */}
      {/* ================================================================== */}
      {isTimerComplete && (
        <div className="music-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="timer-modal-title">
          <div className="music-modal-card">
            <div className="modal-icon-wrap">
              <CheckCircle2 size={36} />
            </div>
            <h3 id="timer-modal-title">Listening Session Complete</h3>
            <p className="modal-calm-message">
              Beautifully done. You gave yourself a quiet, restorative pause today.
            </p>
            <div className="modal-summary-box">
              <div className="summary-line">
                <span>Soundtrack:</span>
                <strong>{currentTrack.label}</strong>
              </div>
              <div className="summary-line">
                <span>Mindful Time:</span>
                <strong>{Math.max(1, Math.round(listenedSecondsRef.current / 60))} min</strong>
              </div>
            </div>
            <div className="modal-actions-row">
              <button
                type="button"
                onClick={handleResetSession}
                className="btn btn-ghost"
              >
                <RotateCcw size={14} /> Listen Again
              </button>
              <button
                type="button"
                onClick={handleExitToActivities}
                className="btn btn-primary"
              >
                Return to Activities
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default CalmingMusic;
