import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import Navbar from "../../components/Navbar/Navbar";
import FeedbackModal from "../../components/activities/FeedbackModal";
import { saveActivitySession, submitActivityFeedback, getActivityStats } from "../../services/activityService";
import "./PopStress.css";

// ─── Constants ──────────────────────────────────────────────────────────────
const GAME_DURATION  = 60;   // seconds
const MAX_MISSES     = 10;   // generous limit — stress relief, not punishment
const SPAWN_MS       = 1400; // ms between spawns
const DANGER_CHANCE  = 0.10; // 10%
const MESSAGE_CHANCE = 0.25; // 25%
const HITBOX_SCALE   = 1.40; // hitbox is 40% larger than visual balloon

const CALMING_MESSAGES = [
  "Breathe easy 🌬️",
  "You're doing great 🌿",
  "One moment at a time 💚",
  "Let it go 🌸",
  "Stay present 🧘",
  "You've got this ✨",
  "Peace is here 🕊️",
];

let _nextId = 0;

function makeBalloon() {
  const rnd  = Math.random();
  const type = rnd < DANGER_CHANCE              ? "danger"
             : rnd < DANGER_CHANCE + MESSAGE_CHANCE ? "message"
             : "normal";

  const size      = 54 + Math.floor(Math.random() * 22); // 54–75 px visual
  const hitboxSize = Math.round(size * HITBOX_SCALE);      // 40% larger hit area

  return {
    id       : ++_nextId,
    type,
    x        : 8 + Math.random() * 82,          // centre X: 8–90 %
    duration : 6.0 + Math.random() * 3.5,       // 6.0–9.5 s to cross the field
    size,
    hitboxSize,
    message  : type === "message"
      ? CALMING_MESSAGES[Math.floor(Math.random() * CALMING_MESSAGES.length)]
      : null,
    popped   : false,
  };
}

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user") || "null"); }
  catch { return null; }
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function PopStress() {
  const storedUser = getStoredUser();
  const navigate   = useNavigate();

  const [gameState,   setGameState]   = useState("intro");
  const [timeLeft,    setTimeLeft]    = useState(GAME_DURATION);
  const [score,       setScore]       = useState(0);
  const [poppedCount, setPoppedCount] = useState(0);
  const [missedCount, setMissedCount] = useState(0);
  const [balloons,    setBalloons]    = useState([]);
  const [endReason,   setEndReason]   = useState("time");
  const [toast,       setToast]       = useState(null);
  const [finalTime,   setFinalTime]   = useState(GAME_DURATION);

  // Database Stats
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorStats, setErrorStats] = useState(false);

  // Feedback and Personal Best state
  const [savedSessionId, setSavedSessionId] = useState(null);
  const [personalBestInfo, setPersonalBestInfo] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Stable refs — safe inside intervals and animation callbacks
  const gameStateRef  = useRef("intro");
  const timeLeftRef   = useRef(GAME_DURATION);
  const timerRef      = useRef(null);
  const spawnRef      = useRef(null);
  const toastTimerRef = useRef(null);

  // Single-submission lock
  const hasSubmittedRef = useRef(false);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Load database statistics on mount
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setErrorStats(false);
    try {
      const data = await getActivityStats("pop_stress");
      setStats(data);
    } catch (err) {
      console.error("Failed to load pop_stress stats:", err);
      setErrorStats(true);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ── End game & Save session exactly once ──────────────────────────────────
  const endGame = useCallback(async (reason) => {
    if (gameStateRef.current !== "playing") return;
    gameStateRef.current = "complete";
    clearInterval(timerRef.current);
    clearInterval(spawnRef.current);
    clearTimeout(toastTimerRef.current);

    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    const timeSurvived = GAME_DURATION - timeLeftRef.current;
    setFinalTime(timeSurvived);
    setEndReason(reason);
    setGameState("complete");
    setBalloons([]);
    setToast(null);

    // Save session in background
    try {
      const result = await saveActivitySession({
        activity_type: "pop_stress",
        score: score, // score is accumulated clicked normal + message balloons
        duration_seconds: timeSurvived,
        completed: reason === "time",
        metadata: {
          balloons_popped: poppedCount,
          missed: missedCount
        }
      });
      if (result) {
        setSavedSessionId(result.session.id);
        if (result.isNewPersonalBest) {
          setPersonalBestInfo({
            isNewPersonalBest: true,
            currentScore: result.session.score,
            previousBest: result.previousBest
          });
        }
        // Refresh local stats dynamically
        fetchStats();
      }
    } catch (err) {
      console.error("Failed to save activity session:", err);
    }
  }, [score, poppedCount, missedCount, fetchStats]);

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        timeLeftRef.current = next;
        if (next <= 0) {
          clearInterval(timerRef.current);
          setTimeout(() => endGame("time"), 0);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [gameState, endGame]);

  // ── Balloon spawner (spawn two at game start to fill field immediately) ───
  useEffect(() => {
    if (gameState !== "playing") return;
    setBalloons([makeBalloon(), makeBalloon()]);

    spawnRef.current = setInterval(() => {
      if (gameStateRef.current !== "playing") return;
      setBalloons(prev => [...prev, makeBalloon()]);
    }, SPAWN_MS);
    return () => clearInterval(spawnRef.current);
  }, [gameState]);

  // ── Pop balloon ───────────────────────────────────────────────────────────
  const popBalloon = useCallback((balloon) => {
    if (gameStateRef.current !== "playing" || balloon.popped) return;

    if (balloon.type === "danger") {
      setBalloons(prev => prev.map(b => b.id === balloon.id ? { ...b, popped: true } : b));
      setTimeout(() => endGame("danger"), 320);
      return;
    }

    setBalloons(prev => prev.map(b => b.id === balloon.id ? { ...b, popped: true } : b));
    setScore(prev => prev + 1);
    setPoppedCount(prev => prev + 1);

    if (balloon.message) {
      clearTimeout(toastTimerRef.current);
      setToast(balloon.message);
      toastTimerRef.current = setTimeout(() => setToast(null), 2200);
    }
  }, [endGame]);

  // ── Hitbox float animation ended (balloon exited game area) ─────────────
  const onHitboxAnimEnd = useCallback((e, balloon) => {
    if (e.target !== e.currentTarget) return;
    if (balloon.popped) return;
    
    setBalloons(prev => prev.filter(b => b.id !== balloon.id));

    // Only normal balloons count as missed balloons
    if (balloon.type !== "normal") return;
    if (gameStateRef.current !== "playing") return;

    setMissedCount(prev => {
      const next = prev + 1;
      if (next >= MAX_MISSES) setTimeout(() => endGame("misses"), 0);
      return next;
    });
  }, [endGame]);

  // ── Inner visual pop animation ended → remove from DOM ───────────────────
  const onPopAnimEnd = useCallback((e, balloon) => {
    e.stopPropagation();
    if (balloon.popped) {
      setBalloons(prev => prev.filter(b => b.id !== balloon.id));
    }
  }, []);

  // ── Start / reset ─────────────────────────────────────────────────────────
  const startGame = () => {
    _nextId = 0;
    timeLeftRef.current = GAME_DURATION;
    setTimeLeft(GAME_DURATION);
    setScore(0);
    setPoppedCount(0);
    setMissedCount(0);
    setBalloons([]);
    setToast(null);
    setFinalTime(GAME_DURATION);
    hasSubmittedRef.current = false;
    setSavedSessionId(null);
    setPersonalBestInfo(null);
    setGameState("playing");
  };

  // Feedback flow
  const handleDoneClick = () => {
    if (savedSessionId) {
      setShowFeedback(true);
    } else {
      navigate("/activities");
    }
  };

  const handleFeedbackSubmit = async (rating) => {
    try {
      await submitActivityFeedback(savedSessionId, rating);
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    } finally {
      setShowFeedback(false);
      navigate("/activities");
    }
  };

  const handleFeedbackSkip = () => {
    setShowFeedback(false);
    navigate("/activities");
  };

  return (
    <div className="app-layout">
      <Navbar profile={storedUser} />

      <div className="container app-content-wrapper">
        <header className="page-header breathing-header">
          <div className="page-header__title-row">
            <Link to="/activities" className="btn btn-ghost back-btn-layout">
              <ArrowLeft size={16} /> Back to Activities
            </Link>
          </div>
        </header>

        <main className="pop-stress-main">

          {/* ── INTRO ─────────────────────────────────────── */}
          {gameState === "intro" && (
            <div className="pop-card">
              <div className="pop-card__icon">🎈</div>
              <h2>Pop the Stress</h2>
              <p>
                Tap the balloons before they float away. Pop as many as you can and release a little tension!
              </p>
              <div className="session-info-box">
                <div className="info-item">
                  <span className="info-label">Duration</span>
                  <span className="info-val">60 seconds</span>
                </div>
                <div className="info-item">
                  <span className="info-label">⚡ Danger balloons</span>
                  <span className="info-val">End the game instantly</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Missed limit</span>
                  <span className="info-val">{MAX_MISSES} misses = game over</span>
                </div>
              </div>

              {/* Dynamic Stats View */}
              {loadingStats ? (
                <p className="stats-loading">Loading your stats...</p>
              ) : errorStats ? (
                <div className="stats-error">
                  <span>Unable to load your activity stats.</span>
                  <button onClick={fetchStats} className="btn btn-ghost btn-retry">Try again</button>
                </div>
              ) : stats ? (
                <div className="your-best-box">
                  <h3>Your Best</h3>
                  {stats.gamesPlayed === 0 ? (
                    <p className="no-stats-msg">No games played yet. Complete your first activity to start tracking your progress.</p>
                  ) : (
                    <div className="stats-list">
                      <div className="stats-list-item">
                        <span>Best Score</span>
                        <strong>{stats.bestScore}</strong>
                      </div>
                      <div className="stats-list-item">
                        <span>Games Played</span>
                        <strong>{stats.gamesPlayed}</strong>
                      </div>
                      <div className="stats-list-item">
                        <span>Best Survival Time</span>
                        <strong>{stats.bestSurvivalTime} sec</strong>
                      </div>
                      <div className="stats-list-item">
                        <span>Balloons Popped</span>
                        <strong>{stats.totalBalloons}</strong>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              <button onClick={startGame} className="btn btn-primary start-session-btn">
                Start Game
              </button>
            </div>
          )}

          {/* ── PLAYING ───────────────────────────────────── */}
          {gameState === "playing" && (
            <div className="pop-playing">
              {/* Stats bar */}
              <div className="pop-stats-bar">
                <div className="pop-stat">
                  <span className="stat-lbl">Score</span>
                  <strong className="stat-val">{score}</strong>
                </div>
                <div className="pop-stat pop-stat--center">
                  <span className="stat-lbl">Time left</span>
                  <strong className={`stat-val stat-val--timer ${timeLeft <= 10 ? "stat-val--urgent" : ""}`}>
                    {timeLeft}s
                  </strong>
                </div>
                <div className="pop-stat">
                  <span className="stat-lbl">Missed</span>
                  <strong className={`stat-val ${missedCount >= MAX_MISSES - 2 ? "stat-val--warn" : ""}`}>
                    {missedCount}/{MAX_MISSES}
                  </strong>
                </div>
              </div>

              {/* Game field */}
              <div className="game-field">
                {toast && <div className="pop-toast">{toast}</div>}

                {balloons.map(b => (
                  <div
                    key={b.id}
                    className="balloon-hitbox"
                    style={{
                      left            : `calc(${b.x}% - ${Math.round(b.hitboxSize / 2)}px)`,
                      width           : `${b.hitboxSize}px`,
                      height          : `${b.hitboxSize}px`,
                      animationName   : "balloon-float",
                      animationDuration: `${b.duration}s`,
                      pointerEvents   : b.popped ? "none" : "all",
                      cursor          : b.popped ? "default" : "pointer",
                    }}
                    onClick={() => popBalloon(b)}
                    onTouchEnd={(e) => { e.preventDefault(); popBalloon(b); }}
                    onAnimationEnd={(e) => onHitboxAnimEnd(e, b)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${b.type} balloon — click or tap to pop`}
                    onKeyDown={(e) => e.key === "Enter" && popBalloon(b)}
                  >
                    <div
                      className={`balloon balloon--${b.type}${b.popped ? " balloon--popped" : ""}`}
                      style={{
                        width : `${b.size}px`,
                        height: `${b.size}px`,
                        animationDuration: b.popped ? "0.35s" : undefined,
                      }}
                      onAnimationEnd={(e) => b.popped && onPopAnimEnd(e, b)}
                    />
                  </div>
                ))}
              </div>

              {/* Controls */}
              <div className="pop-controls">
                <button
                  onClick={() => endGame("time")}
                  className="btn btn-ghost control-btn end-btn"
                  type="button"
                >
                  <X size={15} /> End Game
                </button>
              </div>
            </div>
          )}

          {/* ── COMPLETE ──────────────────────────────────── */}
          {gameState === "complete" && (
            <div className="pop-card">
              {personalBestInfo && (
                <div className="personal-best-banner">
                  <h4>🎉 New Personal Best!</h4>
                  <p>Your score: {personalBestInfo.currentScore} (Previous best: {personalBestInfo.previousBest})</p>
                </div>
              )}

              <div className="pop-card__icon">{endReason === "danger" ? "⚡" : "🎈"}</div>
              <h2>{endReason === "danger" ? "Game Over ⚡" : "Game Complete 🎈"}</h2>

              {endReason === "danger" && (
                <p className="end-reason end-reason--danger">You hit a danger balloon.</p>
              )}
              {endReason === "misses" && (
                <p className="end-reason end-reason--miss">Too many missed balloons.</p>
              )}
              {endReason === "time" && (
                <p className="end-reason end-reason--ok">Great effort — time's up!</p>
              )}

              <div className="completion-summary-box">
                <div className="summary-stat-row">
                  <span>Score:</span>
                  <strong>{score}</strong>
                </div>
                <div className="summary-stat-row">
                  <span>Balloons Popped:</span>
                  <strong>{poppedCount}</strong>
                </div>
                <div className="summary-stat-row">
                  <span>Missed:</span>
                  <strong>{missedCount}</strong>
                </div>
                <div className="summary-stat-row">
                  <span>Time survived:</span>
                  <strong>{Math.min(finalTime, GAME_DURATION)} seconds</strong>
                </div>
              </div>

              <div className="completion-actions-row">
                <button onClick={startGame} className="btn btn-ghost retry-btn">
                  Play Again
                </button>
                <button onClick={handleDoneClick} className="btn btn-primary done-btn">
                  Done
                </button>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Optional Feedback Popup */}
      {showFeedback && (
        <FeedbackModal onSubmit={handleFeedbackSubmit} onSkip={handleFeedbackSkip} />
      )}
    </div>
  );
}
