import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";

// ─── Pomodoro configuration ───────────────────────────────────────────────────
const FOCUS_SECONDS  = 25 * 60; // 25 min
const BREAK_SECONDS  =  5 * 60; //  5 min
const SESSIONS_TOTAL = 4;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Audio helper (Web Audio API, two-tone chime) ─────────────────────────────
function playChime(ctx, isFocusEnd) {
  if (!ctx) return;
  try {
    ctx.resume?.();
    const tones = isFocusEnd
      ? [{ freq: 528, start: 0, dur: 0.5 }, { freq: 660, start: 0.35, dur: 0.6 }]
      : [{ freq: 440, start: 0, dur: 0.4 }, { freq: 370, start: 0.3, dur: 0.5 }];

    tones.forEach(({ freq, start, dur }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });
  } catch (_) {
    // Silently ignore — autoplay restrictions or unsupported context
  }
}

// ─── Phase constants ──────────────────────────────────────────────────────────
const IDLE  = "idle";
const FOCUS = "focus";
const BREAK = "break";
const DONE  = "done";

// ─── Main component ───────────────────────────────────────────────────────────
function FocusTimer() {
  const navigate = useNavigate();

  // Core timer state
  const [phase,        setPhase]        = useState(IDLE);
  const [secondsLeft,  setSecondsLeft]  = useState(FOCUS_SECONDS);
  const [isRunning,    setIsRunning]    = useState(false);
  const [session,      setSession]      = useState(1);
  const [isMuted,      setIsMuted]      = useState(false);

  // Navigation-warning modal
  const [showNavModal,  setShowNavModal]  = useState(false);
  const [pendingHref,   setPendingHref]   = useState(null);

  // Refs for drift-free timing
  const deadlineRef       = useRef(null);
  const intervalRef       = useRef(null);
  const audioCtxRef       = useRef(null);
  const isMutedRef        = useRef(isMuted);
  const phaseRef          = useRef(phase);
  const sessionRef        = useRef(session);
  const secondsLeftRef    = useRef(secondsLeft);
  const isRunningRef      = useRef(isRunning);
  const phaseEndFiredRef  = useRef(false);

  // Keep refs in sync with latest state
  useEffect(() => { isMutedRef.current   = isMuted;    }, [isMuted]);
  useEffect(() => { phaseRef.current     = phase;      }, [phase]);
  useEffect(() => { sessionRef.current   = session;    }, [session]);
  useEffect(() => { secondsLeftRef.current = secondsLeft; }, [secondsLeft]);
  useEffect(() => { isRunningRef.current = isRunning;  }, [isRunning]);

  // ── Audio context (lazy, created on first user gesture) ───────────────────
  const ensureAudioCtx = useCallback(() => {
    if (isMutedRef.current) return null;
    if (!audioCtxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtxRef.current = new AC();
    }
    return audioCtxRef.current;
  }, []);

  useEffect(() => () => { audioCtxRef.current?.close(); }, []);

  // ── Interval management ───────────────────────────────────────────────────
  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const advancePhase = useCallback(() => {
    if (phaseEndFiredRef.current) return;
    phaseEndFiredRef.current = true;

    const currentPhase   = phaseRef.current;
    const currentSession = sessionRef.current;

    if (currentPhase === FOCUS) {
      playChime(ensureAudioCtx(), true);

      if (currentSession >= SESSIONS_TOTAL) {
        setPhase(DONE);
        setIsRunning(false);
        setSecondsLeft(0);
      } else {
        setPhase(BREAK);
        setSecondsLeft(BREAK_SECONDS);
        deadlineRef.current = Date.now() + BREAK_SECONDS * 1000;
        phaseEndFiredRef.current = false;
      }
    } else if (currentPhase === BREAK) {
      playChime(ensureAudioCtx(), false);
      const nextSession = currentSession + 1;
      setSession(nextSession);
      setPhase(FOCUS);
      setSecondsLeft(FOCUS_SECONDS);
      deadlineRef.current = Date.now() + FOCUS_SECONDS * 1000;
      phaseEndFiredRef.current = false;
    }
  }, [ensureAudioCtx]);

  const startInterval = useCallback(() => {
    stopInterval();
    intervalRef.current = setInterval(() => {
      if (!deadlineRef.current) return;
      const remaining = Math.round((deadlineRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        setSecondsLeft(0);
        stopInterval();
        advancePhase();
      } else {
        setSecondsLeft(remaining);
      }
    }, 250);
  }, [stopInterval, advancePhase]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    ensureAudioCtx();
    phaseEndFiredRef.current = false;

    if (phase === IDLE) {
      setPhase(FOCUS);
      setSecondsLeft(FOCUS_SECONDS);
      deadlineRef.current = Date.now() + FOCUS_SECONDS * 1000;
    } else {
      deadlineRef.current = Date.now() + secondsLeftRef.current * 1000;
    }
    setIsRunning(true);
    startInterval();
  }, [ensureAudioCtx, phase, startInterval]);

  const handlePause = useCallback(() => {
    setIsRunning(false);
    stopInterval();
    if (deadlineRef.current) {
      const remaining = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      secondsLeftRef.current = remaining;
    }
    deadlineRef.current = null;
  }, [stopInterval]);

  const handleResume = useCallback(() => {
    if (phase === IDLE || phase === DONE) return;
    phaseEndFiredRef.current = false;
    deadlineRef.current = Date.now() + secondsLeftRef.current * 1000;
    setIsRunning(true);
    startInterval();
  }, [phase, startInterval]);

  const handleReset = useCallback(() => {
    stopInterval();
    setIsRunning(false);
    setPhase(IDLE);
    setSession(1);
    setSecondsLeft(FOCUS_SECONDS);
    deadlineRef.current = null;
    phaseEndFiredRef.current = false;
  }, [stopInterval]);

  const handleNewCycle = useCallback(() => {
    stopInterval();
    setIsRunning(false);
    setPhase(IDLE);
    setSession(1);
    setSecondsLeft(FOCUS_SECONDS);
    deadlineRef.current = null;
    phaseEndFiredRef.current = false;
  }, [stopInterval]);

  useEffect(() => () => stopInterval(), [stopInterval]);

  // ── Navigation guard (without useBlocker / data router) ───────────────────
  // Intercept clicks on in-app links at the capture phase so we see the event
  // before React Router's Link handler fires.
  useEffect(() => {
    if (!isRunning) return;

    const handleClick = (e) => {
      // Walk up the DOM from the click target to find an anchor
      const anchor = e.target.closest("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      // Ignore external URLs, same-page hash anchors, and non-string values
      if (!href || href.startsWith("http") || href.startsWith("//") || href.startsWith("#")) return;
      // Only block if the timer is still running at event time
      if (!isRunningRef.current) return;

      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
      setShowNavModal(true);
    };

    // Capture phase so we run before React Router's bubble-phase listener
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isRunning]);

  // Intercept browser back/forward while timer is running
  useEffect(() => {
    if (!isRunning) return;

    // Push a sentinel entry so popstate fires when the user presses Back
    window.history.pushState({ __focusTimer: true }, "");

    const handlePopState = () => {
      if (!isRunningRef.current) return;
      // Push state again to keep the sentinel in place and re-trigger on next Back
      window.history.pushState({ __focusTimer: true }, "");
      setPendingHref(null); // back-button: we don't know the destination
      setShowNavModal(true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isRunning]);

  // Browser refresh / tab-close guard
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (isRunningRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // ── Modal actions ─────────────────────────────────────────────────────────
  const handleStayFocused = useCallback(() => {
    setShowNavModal(false);
    setPendingHref(null);
    // Timer keeps running — no pause, no navigation
  }, []);

  const handlePauseAndLeave = useCallback(() => {
    handlePause();
    setShowNavModal(false);
    const dest = pendingHref;
    setPendingHref(null);
    if (dest) {
      navigate(dest);
    }
    // If dest is null (back-button case) — just close modal; user is already on the same page
  }, [handlePause, navigate, pendingHref]);

  // ── Derived display values ─────────────────────────────────────────────────
  const displaySeconds = phase === IDLE ? FOCUS_SECONDS : secondsLeft;
  const totalForPhase  = phase === BREAK ? BREAK_SECONDS : FOCUS_SECONDS;
  const progressPct    =
    phase === DONE || phase === IDLE
      ? 0
      : Math.max(0, Math.min(100, ((totalForPhase - displaySeconds) / totalForPhase) * 100));

  // Completed dots = number of focus sessions already finished
  // A session is only "done" once its following break also ends
  const completedSessions =
    phase === DONE ? SESSIONS_TOTAL : Math.max(0, session - (phase === FOCUS ? 1 : 0));

  const modeLabel =
    phase === IDLE  ? "Ready to focus?" :
    phase === FOCUS ? "Focus Time"      :
    phase === BREAK ? "Short Break"     :
                     "Cycle Complete";

  const isBreakPhase = phase === BREAK;

  // Circumference of the SVG ring (r=54): 2π×54 ≈ 339.3
  const CIRCUMFERENCE = 2 * Math.PI * 54;

  return (
    <>
      {/* ── Navigation warning modal ──────────────────────────────────────── */}
      {showNavModal && (
        <div
          className="ft-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ft-modal-title"
        >
          <div className="ft-modal">
            <p className="ft-modal__eyebrow">Focus session active</p>
            <h2 id="ft-modal-title" className="ft-modal__title">
              Are you sure you want to leave?
            </h2>
            <p className="ft-modal__body">
              Your focus session is still running. Leaving now will interrupt your progress.
            </p>
            <div className="ft-modal__actions">
              <button
                type="button"
                className="ft-modal__btn ft-modal__btn--primary"
                onClick={handleStayFocused}
              >
                Stay Focused
              </button>
              <button
                type="button"
                className="ft-modal__btn ft-modal__btn--ghost"
                onClick={handlePauseAndLeave}
              >
                Pause &amp; Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Timer card ────────────────────────────────────────────────────── */}
      <section
        id="focus-timer"
        className={[
          "focus-timer",
          isBreakPhase      ? "focus-timer--break" : "",
          phase === DONE    ? "focus-timer--done"  : "",
        ].join(" ")}
        aria-labelledby="focus-timer-title"
      >
        {/* Left: intro copy + session dots */}
        <div className="focus-timer__intro">
          <span className="eyebrow">Activities</span>
          <h2 id="focus-timer-title">Focus timer</h2>
          <p>Settle into one thoughtful task at a time.</p>

          <div
            className="focus-timer__dots"
            aria-label={`Session progress: ${completedSessions} of ${SESSIONS_TOTAL} completed`}
          >
            {Array.from({ length: SESSIONS_TOTAL }, (_, i) => {
              const isComplete = i < completedSessions;
              const isCurrent  =
                i === completedSessions && phase !== DONE && phase !== IDLE;
              return (
                <span
                  key={i}
                  className={[
                    "focus-timer__dot",
                    isComplete ? "focus-timer__dot--done"   : "",
                    isCurrent  ? "focus-timer__dot--active" : "",
                  ].join(" ")}
                  aria-hidden="true"
                />
              );
            })}
          </div>

          <p className="focus-timer__session-label">
            {phase === DONE
              ? "Cycle complete!"
              : `Session ${Math.min(session, SESSIONS_TOTAL)} of ${SESSIONS_TOTAL}`}
          </p>
        </div>

        {/* Right: timer display */}
        <div className="focus-timer__main">
          <p className="focus-timer__mode">{modeLabel}</p>

          {phase === DONE ? (
            /* ── Cycle complete ── */
            <div className="focus-timer__complete">
              <svg
                className="focus-timer__check"
                viewBox="0 0 52 52"
                aria-hidden="true"
              >
                <circle cx="26" cy="26" r="25" fill="none" />
                <path
                  d="M14 27l9 9 15-18"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="focus-timer__complete-msg">
                You completed all 4 focus sessions.
                <br />
                Take a longer break — you earned it.
              </p>
              <button
                type="button"
                className="focus-timer__start"
                onClick={handleNewCycle}
              >
                Start New Cycle
              </button>
            </div>
          ) : (
            /* ── Active / idle / break ── */
            <>
              {/* Circular progress ring + countdown */}
              <div className="focus-timer__ring-wrap" aria-hidden="true">
                <svg className="focus-timer__ring" viewBox="0 0 120 120">
                  <circle
                    className="focus-timer__ring-track"
                    cx="60" cy="60" r="54"
                  />
                  <circle
                    className="focus-timer__ring-fill"
                    cx="60" cy="60" r="54"
                    style={{
                      strokeDashoffset: CIRCUMFERENCE * (1 - progressPct / 100),
                    }}
                  />
                </svg>
                <time
                  className="focus-timer__display"
                  dateTime={`PT${Math.ceil(displaySeconds / 60)}M`}
                  aria-live="polite"
                  aria-label={`${formatTime(displaySeconds)} remaining`}
                >
                  {formatTime(displaySeconds)}
                </time>
              </div>

              {/* Controls */}
              <div className="focus-timer__controls">
                {!isRunning && (
                  <button
                    type="button"
                    className="focus-timer__start"
                    onClick={phase === IDLE ? handleStart : handleResume}
                    aria-label={phase === IDLE ? "Start focus session" : "Resume timer"}
                  >
                    {phase === IDLE ? "Start" : "Resume"}
                  </button>
                )}

                {isRunning && (
                  <button
                    type="button"
                    className="focus-timer__start focus-timer__start--running"
                    onClick={handlePause}
                    aria-label="Pause timer"
                  >
                    Pause
                  </button>
                )}

                {phase !== IDLE && (
                  <button
                    type="button"
                    className="focus-timer__icon-button"
                    onClick={handleReset}
                    aria-label="Reset timer"
                    title="Reset"
                  >
                    <RotateCcw size={19} aria-hidden="true" />
                  </button>
                )}

                <button
                  type="button"
                  className="focus-timer__icon-button"
                  onClick={() => setIsMuted((m) => !m)}
                  aria-label={isMuted ? "Unmute timer sounds" : "Mute timer sounds"}
                  title={isMuted ? "Sound off" : "Sound on"}
                >
                  {isMuted
                    ? <VolumeX size={19} aria-hidden="true" />
                    : <Volume2 size={19} aria-hidden="true" />}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}

export default FocusTimer;
