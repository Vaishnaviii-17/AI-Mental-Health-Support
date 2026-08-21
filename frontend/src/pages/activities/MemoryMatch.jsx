import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw } from "lucide-react";
import Navbar from "../../components/Navbar/Navbar";
import FeedbackModal from "../../components/activities/FeedbackModal";
import { saveActivitySession, submitActivityFeedback, getActivityStats } from "../../services/activityService";
import "./MemoryMatch.css";

// ─── Card data ───────────────────────────────────────────────────────────────
const CARD_DATA = [
  { id: "meditation", emoji: "🧘", label: "Meditation", message: "Take a moment to slow down."                        },
  { id: "nature",     emoji: "🌿", label: "Nature",     message: "A little fresh air can help you reset."            },
  { id: "sunshine",   emoji: "☀️", label: "Sunshine",   message: "Let a little light into your day."                 },
  { id: "hope",       emoji: "🌈", label: "Hope",       message: "Difficult moments can pass."                       },
  { id: "self-love",  emoji: "❤️", label: "Self-love",  message: "Be kind to yourself."                              },
  { id: "support",    emoji: "🫶", label: "Support",    message: "You don't have to handle everything alone."        },
  { id: "happiness",  emoji: "😊", label: "Happiness",  message: "Notice one small thing that feels good."           },
  { id: "rest",       emoji: "💤", label: "Rest",       message: "Rest is productive too."                           },
];

const TOTAL_PAIRS      = CARD_DATA.length; // 8
const GOOD_TIME_SEC    = 90;               // ≤ this → full time efficiency score
const FLIP_BACK_DELAY  = 1100;             // ms before mismatched pair flips back
const MATCH_CLEAR_DELAY = 650;            // ms before matched pair releases lock

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildDeck() {
  const deck = CARD_DATA.flatMap((item, i) => [
    { uid: i * 2,     pairId: item.id, emoji: item.emoji, label: item.label, message: item.message, isMatched: false },
    { uid: i * 2 + 1, pairId: item.id, emoji: item.emoji, label: item.label, message: item.message, isMatched: false },
  ]);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function formatTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function computeScore(attempts, elapsedSec) {
  const completionScore = 40;
  const attemptScore = Math.round(Math.min(1, TOTAL_PAIRS / Math.max(1, attempts)) * 30);
  const timeScore = Math.round(Math.min(1, GOOD_TIME_SEC / Math.max(1, elapsedSec)) * 30);
  return Math.min(100, completionScore + attemptScore + timeScore);
}

function getScoreMessage(score) {
  if (score >= 85) return "Great work! You stayed focused and completed the activity.";
  if (score >= 70) return "Well done! You showed solid focus and calm.";
  if (score >= 55) return "Good effort! Keep playing to sharpen your focus.";
  return "Every attempt counts. Try again to build your memory.";
}

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user") || "null"); }
  catch { return null; }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function MemoryMatch() {
  const storedUser = getStoredUser();
  const navigate   = useNavigate();

  const [gameState,     setGameState]     = useState("intro"); // intro | playing | complete
  const [cards,         setCards]         = useState([]);
  const [flippedIds,    setFlippedIds]    = useState([]);      // 0, 1, or 2 currently revealed uids
  const [matchedCount,  setMatchedCount]  = useState(0);
  const [attempts,      setAttempts]      = useState(0);
  const [elapsedSec,    setElapsedSec]    = useState(0);
  const [matchMessage,  setMatchMessage]  = useState(null);
  const [matchMsgKey,   setMatchMsgKey]   = useState(0);       // force re-mount for animation

  // Database Stats
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorStats, setErrorStats] = useState(false);

  // Feedback and Personal Best state
  const [savedSessionId, setSavedSessionId] = useState(null);
  const [personalBestInfo, setPersonalBestInfo] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // ── Refs — stable access inside event handlers without stale closures ──────
  const isCheckingRef    = useRef(false);  // blocks further clicks while pair is being evaluated
  const flippedIdsRef    = useRef([]);     // mirrors flippedIds synchronously
  const cardsRef         = useRef([]);     // mirrors cards synchronously
  const attemptsRef      = useRef(0);
  const elapsedSecRef    = useRef(0);
  const matchMsgTimerRef = useRef(null);
  const completionTimerRef = useRef(null);
  const flipBackTimerRef = useRef(null);

  // Single-submission lock
  const hasSubmittedRef = useRef(false);

  // Keep mirrors in sync
  useEffect(() => { flippedIdsRef.current = flippedIds; }, [flippedIds]);
  useEffect(() => { cardsRef.current = cards; }, [cards]);
  useEffect(() => { attemptsRef.current = attempts; }, [attempts]);
  useEffect(() => { elapsedSecRef.current = elapsedSec; }, [elapsedSec]);

  // Load database statistics on mount
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setErrorStats(false);
    try {
      const data = await getActivityStats("memory_match");
      setStats(data);
    } catch (err) {
      console.error("Failed to load memory match stats:", err);
      setErrorStats(true);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== "playing") return;
    const interval = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [gameState]);

  // ── Finish game & Save session exactly once ────────────────────────────────
  const finishGame = useCallback(async (finalAttempts, finalSeconds) => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    const calmFocusScore = computeScore(finalAttempts, finalSeconds);

    setGameState("complete");

    // Persist result to DB
    try {
      const result = await saveActivitySession({
        activity_type: "memory_match",
        score: calmFocusScore,
        duration_seconds: finalSeconds,
        completed: true,
        metadata: {
          attempts: finalAttempts,
          matches: TOTAL_PAIRS
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
  }, [fetchStats]);

  // ── Card click handler ────────────────────────────────────────────────────
  const handleCardClick = useCallback((card) => {
    if (isCheckingRef.current)                    return;
    if (card.isMatched)                           return;
    if (flippedIdsRef.current.includes(card.uid)) return;
    if (flippedIdsRef.current.length >= 2)        return;

    const newFlipped = [...flippedIdsRef.current, card.uid];
    setFlippedIds(newFlipped);
    flippedIdsRef.current = newFlipped;

    if (newFlipped.length < 2) return; // wait for second pick

    // Both cards revealed — evaluate
    isCheckingRef.current = true;
    setAttempts(prev => {
      const next = prev + 1;
      attemptsRef.current = next;
      return next;
    });

    const [uid1, uid2] = newFlipped;
    const deck = cardsRef.current;
    const c1 = deck.find(c => c.uid === uid1);
    const c2 = deck.find(c => c.uid === uid2);

    if (c1.pairId === c2.pairId) {
      // MATCH
      setCards(prev =>
        prev.map(c => (c.uid === uid1 || c.uid === uid2) ? { ...c, isMatched: true } : c)
      );

      clearTimeout(matchMsgTimerRef.current);
      setMatchMsgKey(k => k + 1);
      setMatchMessage(c1.message);
      matchMsgTimerRef.current = setTimeout(() => setMatchMessage(null), 2800);

      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = setTimeout(() => {
        setFlippedIds([]);
        flippedIdsRef.current = [];
        isCheckingRef.current = false;

        setMatchedCount(prev => {
          const next = prev + 1;
          if (next >= TOTAL_PAIRS) {
            // Trigger finishGame with stable ref values to prevent stale closures
            finishGame(attemptsRef.current, elapsedSecRef.current);
          }
          return next;
        });
      }, MATCH_CLEAR_DELAY);

    } else {
      // NO MATCH
      clearTimeout(flipBackTimerRef.current);
      flipBackTimerRef.current = setTimeout(() => {
        setFlippedIds([]);
        flippedIdsRef.current = [];
        isCheckingRef.current = false;
      }, FLIP_BACK_DELAY);
    }
  }, [finishGame]);

  // ── Start / restart ───────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    clearTimeout(matchMsgTimerRef.current);
    clearTimeout(completionTimerRef.current);
    clearTimeout(flipBackTimerRef.current);
    isCheckingRef.current = false;
    flippedIdsRef.current = [];
    attemptsRef.current = 0;
    elapsedSecRef.current = 0;

    const deck = buildDeck();
    cardsRef.current = deck;
    setCards(deck);
    setFlippedIds([]);
    setMatchedCount(0);
    setAttempts(0);
    setElapsedSec(0);
    setMatchMessage(null);
    hasSubmittedRef.current = false;
    setSavedSessionId(null);
    setPersonalBestInfo(null);
    setGameState("playing");
  }, []);

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

  const isCardFlipped = (card) => card.isMatched || flippedIds.includes(card.uid);
  const finalScore    = computeScore(attempts, elapsedSec);

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

        <main className="mm-main">

          {/* ── INTRO ────────────────────────────────── */}
          {gameState === "intro" && (
            <div className="mm-panel">
              <div className="mm-panel__icon">🧠</div>
              <h2>Match Your Calm</h2>
              <p className="mm-panel__subtitle">
                Find matching pairs of positive wellness moments and give your mind a short break.
              </p>
              <div className="session-info-box">
                <div className="info-item">
                  <span className="info-label">Pairs to match</span>
                  <span className="info-val">8 pairs · 16 cards</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Calm Focus Score</span>
                  <span className="info-val">Based on accuracy &amp; speed</span>
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
                        <span>Best Focus</span>
                        <strong>{stats.bestScore}%</strong>
                      </div>
                      <div className="stats-list-item">
                        <span>Best Time</span>
                        <strong>{stats.bestTime} sec</strong>
                      </div>
                      <div className="stats-list-item">
                        <span>Fewest Attempts</span>
                        <strong>{stats.fewestAttempts}</strong>
                      </div>
                      <div className="stats-list-item">
                        <span>Games Played</span>
                        <strong>{stats.gamesPlayed}</strong>
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

          {/* ── PLAYING ──────────────────────────────── */}
          {gameState === "playing" && (
            <div className="mm-playing">
              {/* Stats bar */}
              <div className="mm-stats-bar">
                <div className="mm-stat">
                  <span className="stat-lbl">Time</span>
                  <strong className="stat-val">{formatTime(elapsedSec)}</strong>
                </div>
                <div className="mm-stat mm-stat--center">
                  <span className="stat-lbl">Matches</span>
                  <strong className="stat-val stat-val--lg">{matchedCount} / {TOTAL_PAIRS}</strong>
                </div>
                <div className="mm-stat">
                  <span className="stat-lbl">Attempts</span>
                  <strong className="stat-val">{attempts}</strong>
                </div>
              </div>

              {/* Calming message banner */}
              <div className="mm-msg-row">
                {matchMessage && (
                  <span key={matchMsgKey} className="mm-msg-text">
                    ✨ {matchMessage}
                  </span>
                )}
              </div>

              {/* 4 × 4 card grid */}
              <div className="mm-grid" role="grid" aria-label="Memory match game board">
                {cards.map(card => (
                  <div
                    key={card.uid}
                    role="gridcell"
                    className={[
                      "mm-card",
                      isCardFlipped(card) ? "mm-card--flipped" : "",
                      card.isMatched      ? "mm-card--matched"  : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => handleCardClick(card)}
                    onKeyDown={(e) => e.key === "Enter" && handleCardClick(card)}
                    tabIndex={card.isMatched ? -1 : 0}
                    aria-label={
                      card.isMatched
                        ? `${card.label} — matched`
                        : isCardFlipped(card)
                        ? `${card.label} — revealed`
                        : "Face-down card"
                    }
                    aria-pressed={isCardFlipped(card)}
                  >
                    <div className="mm-card-inner">
                      <div className="mm-face mm-face--back" aria-hidden="true">
                        <span className="mm-back-mark">✦</span>
                      </div>
                      <div className="mm-face mm-face--front">
                        <span className="mm-emoji" role="img" aria-label={card.label}>
                          {card.emoji}
                        </span>
                        <span className="mm-label">{card.label}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Controls */}
              <div className="mm-controls">
                <button onClick={startGame} className="btn btn-ghost control-btn" type="button">
                  <RotateCcw size={14} /> Restart
                </button>
              </div>
            </div>
          )}

          {/* ── COMPLETE ─────────────────────────────── */}
          {gameState === "complete" && (
            <div className="mm-panel mm-panel--complete">
              {personalBestInfo && (
                <div className="personal-best-banner">
                  <h4>🎉 New Personal Best!</h4>
                  <p>Your focus score: {personalBestInfo.currentScore}% (Previous best: {personalBestInfo.previousBest}%)</p>
                </div>
              )}

              <div className="mm-panel__icon">🌟</div>
              <h2>Activity Complete</h2>
              <p className="mm-panel__subtitle">{getScoreMessage(finalScore)}</p>

              {/* Score display */}
              <div className="mm-score-box">
                <span className="mm-score-box__label">🌟 Calm Focus Score</span>
                <strong className="mm-score-box__value">{finalScore}%</strong>
              </div>

              {/* Stats */}
              <div className="completion-summary-box">
                <div className="summary-stat-row">
                  <span>Matches:</span>
                  <strong>{TOTAL_PAIRS} / {TOTAL_PAIRS}</strong>
                </div>
                <div className="summary-stat-row">
                  <span>Attempts:</span>
                  <strong>{attempts}</strong>
                </div>
                <div className="summary-stat-row">
                  <span>Time:</span>
                  <strong>{formatTime(elapsedSec)}</strong>
                </div>
              </div>

              <div className="completion-actions-row">
                <button onClick={startGame} className="btn btn-ghost retry-btn">
                  Play Again
                </button>
                <button
                  onClick={handleDoneClick}
                  className="btn btn-primary done-btn"
                >
                  Back to Activities
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
