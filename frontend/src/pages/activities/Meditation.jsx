import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Compass,
  Play,
  Pause,
  X,
  RotateCcw,
  CheckCircle2,
  Volume2,
  VolumeX,
  Sparkles,
  Clock,
  ChevronRight,
  ChevronLeft,
  HeartHandshake
} from "lucide-react";
import Navbar from "../../components/Navbar/Navbar";
import { saveActivitySession } from "../../services/activityService";
import { getTodayMood } from "../../services/moodService";
import { MEDITATION_SESSIONS, getRecommendedSession } from "./meditationData";
import { MEDITATION_AUDIO_TRACKS } from "./audioTracks";
import "./Meditation.css";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function Meditation() {
  const storedUser = getStoredUser();
  const navigate = useNavigate();

  // Screen: 'selector' | 'active' | 'complete'
  const [screen, setScreen] = useState("selector");

  // Selected session from MEDITATION_SESSIONS
  const [selectedSession, setSelectedSession] = useState(MEDITATION_SESSIONS[0]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Mood-based recommendation state
  const [recommendedSession, setRecommendedSession] = useState(null);
  const [todayMoodData, setTodayMoodData] = useState(null);

  // Timer states
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stepElapsedSeconds, setStepElapsedSeconds] = useState(0);

  // Audio state (gentle tracks, ambient tone fallback, volume, and mute)
  const [selectedTrack, setSelectedTrack] = useState("waves");
  const [volume, setVolume] = useState(0.3); // default 30% volume - gentle and clear
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  const audioElementRef = useRef(null);
  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);

  // Submission tracking
  const hasSubmittedRef = useRef(false);
  const [wasCompleted, setWasCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalDuration, setFinalDuration] = useState(0);

  // Fetch user's mood for today to personalize recommendation safely
  useEffect(() => {
    let isMounted = true;
    async function loadMood() {
      try {
        const mood = await getTodayMood();
        if (isMounted && mood) {
          setTodayMoodData(mood);
          const rec = getRecommendedSession(mood);
          if (rec) setRecommendedSession(rec);
        }
      } catch (err) {
        // Non-critical; fallback to neutral session selector
        console.warn("Unable to load mood for meditation recommendation:", err.message);
      }
    }
    loadMood();
    return () => {
      isMounted = false;
    };
  }, []);

  // Ambient synth tone generator (Web Audio API fallback)
  const startAmbientTone = useCallback(() => {
    if (isAudioMuted || typeof window === "undefined") return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      if (!oscillatorRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // 432Hz warm calming sine wave scaled softly by volume
        osc.type = "sine";
        osc.frequency.setValueAtTime(432, ctx.currentTime);

        const targetGain = Math.max(0.0001, volume * 0.08);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(targetGain, ctx.currentTime + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        oscillatorRef.current = osc;
        gainNodeRef.current = gain;
      }
    } catch (_) {
      // Graceful fallback if audio is blocked
    }
  }, [isAudioMuted, volume]);

  const stopAmbientTone = useCallback(() => {
    try {
      if (oscillatorRef.current && gainNodeRef.current && audioContextRef.current) {
        const ctx = audioContextRef.current;
        gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, ctx.currentTime);
        gainNodeRef.current.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        const osc = oscillatorRef.current;
        const gain = gainNodeRef.current;
        oscillatorRef.current = null;
        gainNodeRef.current = null;
        setTimeout(() => {
          try {
            osc.stop();
            osc.disconnect();
            gain.disconnect();
          } catch (_) {}
        }, 350);
      }
    } catch (_) {}
  }, []);

  // Manage playback across tracks, play/pause, volume, and mute states
  useEffect(() => {
    const shouldPlay = isActive && !isPaused && !isAudioMuted && selectedTrack !== "off";

    if (!shouldPlay) {
      if (audioElementRef.current && !audioElementRef.current.paused) {
        audioElementRef.current.pause();
      }
      stopAmbientTone();
      return;
    }

    if (selectedTrack === "ambient") {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
      }
      startAmbientTone();
    } else {
      stopAmbientTone();

      const trackInfo = MEDITATION_AUDIO_TRACKS.find((t) => t.id === selectedTrack);
      if (trackInfo?.src) {
        const currentSrc = audioElementRef.current?.getAttribute("src") || audioElementRef.current?.src;
        if (!audioElementRef.current || !currentSrc?.includes(trackInfo.src)) {
          if (audioElementRef.current) {
            audioElementRef.current.pause();
          }
          const audio = new Audio(trackInfo.src);
          audio.loop = true;
          audio.volume = isAudioMuted ? 0 : volume;
          audioElementRef.current = audio;
          audio.play().catch((err) => {
            console.warn("Audio autoplay blocked or file unavailable:", err.message);
          });
        } else {
          audioElementRef.current.volume = isAudioMuted ? 0 : volume;
          if (audioElementRef.current.paused) {
            audioElementRef.current.play().catch(() => {});
          }
        }
      }
    }
  }, [isActive, isPaused, isAudioMuted, selectedTrack, volume, startAmbientTone, stopAmbientTone]);

  // Clean up all audio on unmount
  useEffect(() => {
    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = "";
        audioElementRef.current = null;
      }
      stopAmbientTone();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stopAmbientTone]);

  // Main session timer interval
  useEffect(() => {
    let interval = null;
    if (isActive && !isPaused) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          if (next >= selectedSession.durationSeconds) {
            clearInterval(interval);
            return selectedSession.durationSeconds;
          }
          return next;
        });

        setStepElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, isPaused, selectedSession.durationSeconds]);

  // Natural completion when total duration is reached
  useEffect(() => {
    if (isActive && elapsedSeconds >= selectedSession.durationSeconds) {
      finishMeditation(true);
    }
  }, [elapsedSeconds, isActive, selectedSession.durationSeconds]);

  // Start selected session
  const handleStartSession = (session) => {
    setSelectedSession(session);
    setCurrentStepIndex(0);
    setElapsedSeconds(0);
    setStepElapsedSeconds(0);
    setIsActive(true);
    setIsPaused(false);
    hasSubmittedRef.current = false;
    setScreen("active");
  };

  const togglePause = () => {
    setIsPaused((prev) => !prev);
  };

  const handleTrackChange = (newTrackId) => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      audioElementRef.current = null;
    }
    stopAmbientTone();
    setSelectedTrack(newTrackId);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (isAudioMuted && val > 0) {
      setIsAudioMuted(false);
    }
    if (audioElementRef.current) {
      audioElementRef.current.volume = val;
    }
    if (gainNodeRef.current && audioContextRef.current) {
      try {
        gainNodeRef.current.gain.setValueAtTime(val * 0.08, audioContextRef.current.currentTime);
      } catch (_) {}
    }
  };

  const toggleMute = () => {
    setIsAudioMuted((prev) => {
      const next = !prev;
      if (audioElementRef.current) {
        audioElementRef.current.volume = next ? 0 : volume;
      }
      if (gainNodeRef.current && audioContextRef.current) {
        try {
          gainNodeRef.current.gain.setValueAtTime(next ? 0.0001 : volume * 0.08, audioContextRef.current.currentTime);
        } catch (_) {}
      }
      return next;
    });
  };

  // Step Navigation
  const handleNextStep = () => {
    if (currentStepIndex < selectedSession.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      setStepElapsedSeconds(0);
    } else {
      // Last step -> complete session
      finishMeditation(true);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      setStepElapsedSeconds(0);
    }
  };

  const handleSkipStep = () => {
    handleNextStep();
  };

  // Complete / End Early and save session
  const finishMeditation = async (natural = false) => {
    setIsActive(false);
    setIsPaused(false);
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    stopAmbientTone();

    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    const actualDuration = natural ? selectedSession.durationSeconds : Math.max(1, elapsedSeconds);
    const pct = Math.min(100, Math.round((actualDuration / selectedSession.durationSeconds) * 100));
    const completed = natural || pct >= 95;

    setWasCompleted(completed);
    setFinalScore(pct);
    setFinalDuration(actualDuration);
    setScreen("complete");

    try {
      const result = await saveActivitySession({
        activity_type: "guided_meditation",
        score: pct,
        duration_seconds: actualDuration,
        completed,
        metadata: {
          session_id: selectedSession.id,
          session_title: selectedSession.title,
          steps_completed: currentStepIndex + 1,
          total_steps: selectedSession.steps.length,
          natural_finish: natural,
          audio_track: selectedTrack
        }
      });
    } catch (err) {
      console.error("Failed to save meditation session:", err);
    }
  };

  const handleEndEarly = () => {
    finishMeditation(false);
  };

  const handleResetToSelector = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    stopAmbientTone();
    setScreen("selector");
    setElapsedSeconds(0);
    setStepElapsedSeconds(0);
    setCurrentStepIndex(0);
    setIsActive(false);
    setIsPaused(false);
  };

  // Current step details
  const currentStep = selectedSession.steps[currentStepIndex] || selectedSession.steps[0];
  const timeLeft = Math.max(0, selectedSession.durationSeconds - elapsedSeconds);
  const overallProgressPct = Math.min(100, (elapsedSeconds / selectedSession.durationSeconds) * 100);

  return (
    <div className="app-layout meditation-page-container">
      <Navbar profile={storedUser} />

      <div className="container app-content-wrapper">
        <header className="page-header meditation-header">
          <div className="page-header__title-row">
            <Link to="/activities" className="btn btn-ghost back-btn-layout">
              <ArrowLeft size={16} /> Back to Activities
            </Link>
          </div>
        </header>

        <main className="meditation-content-wrap">
          
          {/* ================================================================ */}
          {/* SCREEN 1: SESSION SELECTOR                                        */}
          {/* ================================================================ */}
          {screen === "selector" && (
            <div className="meditation-card meditation-selector-view">
              
              <div className="selector-header">
                <div className="selector-icon-wrap">
                  <Compass size={32} />
                </div>
                <h2>Guided Meditation</h2>
                <p>
                  Take a quiet moment to pause, soften physical tension, untangle racing thoughts, or ground yourself.
                </p>
              </div>

              {/* Gentle Mood-Based Recommendation Banner */}
              {recommendedSession && todayMoodData && (
                <div className="recommendation-banner" role="status">
                  <Sparkles size={16} className="recommendation-banner-icon" />
                  <div>
                    Based on your check-in today:{" "}
                    <strong>{recommendedSession.title}</strong> is recommended for you.
                  </div>
                </div>
              )}

              <div className="meditation-sessions-list" role="list">
                {MEDITATION_SESSIONS.map((session) => {
                  const isRec = recommendedSession?.id === session.id;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      className={`session-choice-card ${isRec ? "is-recommended" : ""}`}
                      onClick={() => handleStartSession(session)}
                      aria-label={`Start ${session.title}, ${session.durationLabel}`}
                    >
                      <div className="session-choice-info">
                        <div className="session-title-row">
                          <h3>{session.title}</h3>
                          {isRec && (
                            <span className="badge-recommended">
                              Recommended for you
                            </span>
                          )}
                        </div>
                        <p className="session-desc">{session.subtitle}</p>
                        <div className="session-meta-row">
                          <span className="session-meta-item">
                            <Clock size={12} /> {session.durationLabel}
                          </span>
                          <span>•</span>
                          <span>{session.category}</span>
                        </div>
                      </div>

                      <div className="session-play-cta">
                        <Play size={16} fill="currentColor" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Safety & Grounding Note */}
              <div className="safety-tip-card">
                <span>
                  🌿 <strong>Gentle Note:</strong> Meditation is an invitation to pause. You are always in control. If any exercise feels uncomfortable, you are welcome to stop and return your attention to your physical surroundings.
                </span>
              </div>

            </div>
          )}

          {/* ================================================================ */}
          {/* SCREEN 2: ACTIVE GUIDED SESSION                                   */}
          {/* ================================================================ */}
          {screen === "active" && (
            <div className="meditation-card meditation-active-view" role="region" aria-label="Guided Meditation Session">
              
              {/* Top Bar with Title and Ambient Audio Controls */}
              <div className="active-top-bar">
                <span className="session-phase-eyebrow">
                  {selectedSession.title} · Step {currentStepIndex + 1} of {selectedSession.steps.length}
                </span>

                <div className="audio-controls-wrap">
                  <div className="audio-select-container">
                    <select
                      className="audio-track-select"
                      value={selectedTrack}
                      onChange={(e) => handleTrackChange(e.target.value)}
                      aria-label="Select ambient sound"
                      title="Select ambient sound"
                    >
                      {MEDITATION_AUDIO_TRACKS.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.emoji} {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedTrack !== "off" && (
                    <div className="volume-control-group">
                      <button
                        type="button"
                        className="volume-icon-btn"
                        onClick={toggleMute}
                        aria-label={isAudioMuted ? "Unmute audio" : "Mute audio"}
                        title={isAudioMuted ? "Unmute sound" : "Mute sound"}
                      >
                        {isAudioMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isAudioMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="volume-slider-range"
                        aria-label="Sound volume"
                        title={`Volume: ${Math.round((isAudioMuted ? 0 : volume) * 100)}%`}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Serene Visual Halo Animation */}
              <div className="meditation-visual-halo" aria-hidden="true">
                <div className="halo-ring" />
                <div className="halo-glow" />
                <div className={`halo-center-orb ${isPaused ? "is-paused" : ""}`}>
                  <Compass size={32} />
                </div>
              </div>

              {/* Instruction Container */}
              <div className="step-instruction-box" aria-live="polite">
                <span className="step-subtitle">{currentStep.title}</span>
                <p className="step-instruction-text">{currentStep.instruction}</p>
              </div>

              {/* Progress and Countdown Track */}
              <div className="session-progress-container">
                <div className="step-dots-row" aria-hidden="true">
                  {selectedSession.steps.map((_, i) => (
                    <span
                      key={i}
                      className={`step-dot ${
                        i < currentStepIndex ? "is-done" : i === currentStepIndex ? "is-active" : ""
                      }`}
                    />
                  ))}
                </div>

                <div className="progress-track" aria-hidden="true">
                  <div className="progress-bar-fill" style={{ width: `${overallProgressPct}%` }} />
                </div>

                <div className="progress-labels-row">
                  <span>{formatTime(elapsedSeconds)} elapsed</span>
                  <span>{formatTime(timeLeft)} remaining</span>
                </div>
              </div>

              {/* Main Controls Row */}
              <div className="meditation-controls-row">
                {currentStepIndex > 0 ? (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="btn btn-ghost btn-meditation-ctrl btn-ctrl-ghost"
                    aria-label="Previous step"
                  >
                    <ChevronLeft size={16} /> Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleEndEarly}
                    className="btn btn-ghost btn-meditation-ctrl btn-ctrl-end"
                    aria-label="End meditation session early"
                  >
                    <X size={15} /> End Early
                  </button>
                )}

                <button
                  type="button"
                  onClick={togglePause}
                  className="btn btn-ghost btn-meditation-ctrl btn-ctrl-ghost"
                  aria-label={isPaused ? "Resume session" : "Pause session"}
                >
                  {isPaused ? (
                    <>
                      <Play size={14} fill="currentColor" /> Resume
                    </>
                  ) : (
                    <>
                      <Pause size={14} fill="currentColor" /> Pause
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="btn btn-primary btn-meditation-ctrl btn-ctrl-primary"
                  aria-label={
                    currentStepIndex === selectedSession.steps.length - 1
                      ? "Complete session"
                      : "Continue to next instruction"
                  }
                >
                  <span>
                    {currentStepIndex === selectedSession.steps.length - 1 ? "Complete" : "Continue"}
                  </span>
                  <ChevronRight size={16} />
                </button>

                {currentStepIndex > 0 && (
                  <button
                    type="button"
                    onClick={handleEndEarly}
                    className="btn btn-ghost btn-meditation-ctrl btn-ctrl-end"
                    aria-label="End session early"
                    title="End early"
                  >
                    <X size={15} /> End
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* SCREEN 3: MINIMAL CALM COMPLETION SCREEN                          */}
          {/* ================================================================ */}
          {screen === "complete" && (
            <div className="meditation-card meditation-complete-view">
              <div className={`complete-icon-wrap ${!wasCompleted ? "is-early" : ""}`}>
                {wasCompleted ? <CheckCircle2 size={36} /> : <HeartHandshake size={34} />}
              </div>

              <h2>{wasCompleted ? "Session Complete 🌿" : "Session Paused 🌿"}</h2>

              <p className="complete-message">
                {wasCompleted
                  ? "Beautifully done. You took a little time for yourself."
                  : "You made time to pause today, and that is what matters most. Whenever you feel ready, you can return here."}
              </p>

              {/* Summary Stats Box */}
              <div className="meditation-summary-box">
                <div className="summary-row">
                  <span>Exercise:</span>
                  <strong>{selectedSession.title}</strong>
                </div>
                <div className="summary-row">
                  <span>Mindful Time:</span>
                  <strong>
                    {finalDuration >= 60
                      ? `${Math.floor(finalDuration / 60)} min ${finalDuration % 60}s`
                      : `${finalDuration} seconds`}
                  </strong>
                </div>
                <div className="summary-row">
                  <span>Completion:</span>
                  <strong>{finalScore}%</strong>
                </div>
              </div>

              {/* Calm Completion Affirmation */}
              <div className="complete-affirmation-note">
                <p>
                  🌱 Your mindful time has been recorded to your journey. Breathe gently as you step back into your day.
                </p>
              </div>

              {/* Actions Row */}
              <div className="complete-actions-row">
                <button
                  type="button"
                  onClick={handleResetToSelector}
                  className="btn btn-ghost"
                >
                  <RotateCcw size={14} /> Choose Another Session
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/activities")}
                  className="btn btn-primary"
                >
                  Done
                </button>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default Meditation;
