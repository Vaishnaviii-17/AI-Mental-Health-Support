import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function FocusTimer() {
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [session, setSession] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef(null);

  const playAlert = useCallback(() => {
    if (isMuted || typeof window === "undefined") return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const context = audioContextRef.current || new AudioContext();
    audioContextRef.current = context;
    void context.resume?.();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.46);
  }, [isMuted]);

  useEffect(() => () => audioContextRef.current?.close(), []);

  useEffect(() => {
    if (!isRunning) return undefined;

    const intervalId = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) return current - 1;

        playAlert();
        setIsBreak((wasBreak) => {
          if (wasBreak) {
            return false;
          }
          setSession((currentSession) => (currentSession === 4 ? 1 : currentSession + 1));
          return true;
        });
        return isBreak ? FOCUS_SECONDS : BREAK_SECONDS;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isBreak, isRunning, playAlert]);

  const handleStartPause = () => {
    setHasStarted(true);
    if (!isMuted && !audioContextRef.current && typeof window !== "undefined") {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioContextRef.current = new AudioContext();
    }
    void audioContextRef.current?.resume?.();
    setIsRunning((running) => !running);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsBreak(false);
    setSecondsLeft(FOCUS_SECONDS);
    setSession(1);
  };

  const modeLabel = isBreak ? "Break time" : "Focus time";

  return (
    <section id="focus-timer" className={`focus-timer ${isBreak ? "focus-timer--break" : ""}`} aria-labelledby="focus-timer-title">
      <div className="focus-timer__intro">
        <span className="eyebrow">Activities</span>
        <h2 id="focus-timer-title">Focus timer</h2>
        <p>Settle into one thoughtful task at a time.</p>
      </div>

      <div className="focus-timer__main">
        <p className="focus-timer__mode">{modeLabel}</p>
        <time className="focus-timer__display" dateTime={`PT${Math.ceil(secondsLeft / 60)}M`} aria-live="polite">
          {formatTime(secondsLeft)}
        </time>
        <p className="focus-timer__session">Session {session} of 4</p>
        <div className="focus-timer__controls">
          <button type="button" className={`focus-timer__start ${isRunning ? "focus-timer__start--running" : ""}`} onClick={handleStartPause}>
            {isRunning ? "Pause" : "Start"}
          </button>
          {hasStarted && (
            <button type="button" className="focus-timer__icon-button" onClick={handleReset} aria-label="Reset focus timer" title="Reset timer">
              <RotateCcw size={19} aria-hidden="true" />
            </button>
          )}
          <button type="button" className="focus-timer__icon-button" onClick={() => setIsMuted((muted) => !muted)} aria-label={isMuted ? "Turn timer sound on" : "Mute timer sound"} title={isMuted ? "Sound off" : "Sound on"}>
            {isMuted ? <VolumeX size={19} aria-hidden="true" /> : <Volume2 size={19} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </section>
  );
}

export default FocusTimer;
