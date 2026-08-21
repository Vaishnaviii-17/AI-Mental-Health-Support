import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Pause, X, RotateCcw, CheckCircle2, Wind } from "lucide-react";
import Navbar from "../../components/Navbar/Navbar";
import FeedbackModal from "../../components/activities/FeedbackModal";
import { saveActivitySession, submitActivityFeedback, getActivityStats } from "../../services/activityService";
import "./BreathingBubble.css";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

const SESSION_DURATION = 60; // 1 minute in seconds
const CYCLE_BREATHE_IN = 4;   // 4 seconds
const CYCLE_HOLD = 2;         // 2 seconds
const CYCLE_BREATHE_OUT = 4;  // 4 seconds
const CYCLE_TOTAL = CYCLE_BREATHE_IN + CYCLE_HOLD + CYCLE_BREATHE_OUT; // 10 seconds

function BreathingBubble() {
  const storedUser = getStoredUser();
  const navigate = useNavigate();

  // Screen States: 'intro' | 'active' | 'complete'
  const [screen, setScreen] = useState("intro");
  
  // Timer States
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  // Stats Frozen for Completion Screen
  const [finalCycles, setFinalCycles] = useState(0);
  const [finalPercentage, setFinalPercentage] = useState(0);

  // Database Stats
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorStats, setErrorStats] = useState(false);

  // Feedback and Personal Best state
  const [savedSessionId, setSavedSessionId] = useState(null);
  const [personalBestInfo, setPersonalBestInfo] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Single-submission locks
  const hasSubmittedRef = useRef(false);

  // Load database statistics on mount
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setErrorStats(false);
    try {
      const data = await getActivityStats("breathing_bubble");
      setStats(data);
    } catch (err) {
      console.error("Failed to load breathing stats:", err);
      setErrorStats(true);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Main countdown tick loop
  useEffect(() => {
    let interval = null;
    if (isActive && !isPaused) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => {
          if (prev >= SESSION_DURATION - 1) {
            clearInterval(interval);
            return SESSION_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, isPaused]);

  // Handle natural session completion when elapsed time reaches max
  useEffect(() => {
    if (isActive && elapsedSeconds >= SESSION_DURATION) {
      finishSession(true);
    }
  }, [elapsedSeconds, isActive]);

  // Derive active values directly from elapsedSeconds to prevent sync/closure bugs
  const timeLeft = Math.max(0, SESSION_DURATION - elapsedSeconds);
  const currentCycleTime = elapsedSeconds % CYCLE_TOTAL;
  
  let breathPhase = "Breathe In";
  let phaseTimeLeft = 0;
  
  if (currentCycleTime < CYCLE_BREATHE_IN) {
    breathPhase = "Breathe In";
    phaseTimeLeft = CYCLE_BREATHE_IN - currentCycleTime;
  } else if (currentCycleTime < CYCLE_BREATHE_IN + CYCLE_HOLD) {
    breathPhase = "Hold";
    phaseTimeLeft = (CYCLE_BREATHE_IN + CYCLE_HOLD) - currentCycleTime;
  } else {
    breathPhase = "Breathe Out";
    phaseTimeLeft = CYCLE_TOTAL - currentCycleTime;
  }
  
  const cycleCount = Math.floor(elapsedSeconds / CYCLE_TOTAL) + 1;

  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Start Session
  const startSession = () => {
    setElapsedSeconds(0);
    setIsActive(true);
    setIsPaused(false);
    hasSubmittedRef.current = false;
    setSavedSessionId(null);
    setPersonalBestInfo(null);
    setScreen("active");
  };

  // Pause / Resume
  const togglePause = () => {
    setIsPaused((prev) => !prev);
  };

  // Complete / End early and save session exactly once
  const finishSession = async (natural = false) => {
    setIsActive(false);
    setIsPaused(false);
    
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    const finalSeconds = natural ? SESSION_DURATION : elapsedSeconds;
    const pct = Math.min(100, Math.round((finalSeconds / SESSION_DURATION) * 100));
    const cycles = Math.floor(finalSeconds / CYCLE_TOTAL);
    
    setFinalPercentage(pct);
    setFinalCycles(cycles);
    setScreen("complete");

    // Persist result to DB
    try {
      const result = await saveActivitySession({
        activity_type: "breathing_bubble",
        score: pct,
        duration_seconds: finalSeconds,
        completed: pct === 100,
        metadata: {
          cycles,
          completion_percent: pct
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
  };

  const endSessionEarly = () => {
    finishSession(false);
  };

  // Restart
  const restartSession = () => {
    setElapsedSeconds(0);
    setScreen("intro");
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

  // Determine CSS class for bubble scale based on current breath phase and state
  const getBubbleClass = () => {
    if (isPaused || screen !== "active") return "bubble--static";
    if (breathPhase === "Breathe In") return "bubble--expand";
    if (breathPhase === "Hold") return "bubble--hold";
    return "bubble--contract";
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

        <main className="breathing-bubble-container">
          
          {/* INTRO SCREEN */}
          {screen === "intro" && (
            <div className="breathing-card intro-view">
              <div className="intro-icon-wrap">
                <Wind size={32} className="intro-icon" />
              </div>
              <h2>Breathing Bubble</h2>
              <p>
                Take a comfortable seated position, slow down, and follow the bubble's rhythm to balance your nervous system.
              </p>
              
              <div className="session-info-box">
                <div className="info-item">
                  <span className="info-label">Duration</span>
                  <span className="info-val">1 Minute</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Pace</span>
                  <span className="info-val">10s cycles (4s in, 2s hold, 4s out)</span>
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
                  {stats.totalSessions === 0 ? (
                    <p className="no-stats-msg">No sessions completed yet. Complete your first session to start tracking your progress.</p>
                  ) : (
                    <div className="stats-list">
                      <div className="stats-list-item">
                        <span>Best Completion</span>
                        <strong>{stats.bestCompletion}%</strong>
                      </div>
                      <div className="stats-list-item">
                        <span>Longest Session</span>
                        <strong>{stats.longestSession < 60 ? `${stats.longestSession} sec` : `${Math.round(stats.longestSession / 60)} min`}</strong>
                      </div>
                      <div className="stats-list-item">
                        <span>Sessions</span>
                        <strong>{stats.totalSessions}</strong>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              <button onClick={startSession} className="btn btn-primary start-session-btn">
                Start Session
              </button>
            </div>
          )}

          {/* ACTIVE SESSION SCREEN */}
          {screen === "active" && (
            <div className="breathing-card active-view">
              <span className="eyebrow active-eyebrow">Follow the bubble</span>
              
              {/* Breath Phase Prompter */}
              <h2 className="breath-phase-text">{breathPhase}</h2>
              <span className="phase-duration-cue">
                {breathPhase === "Hold" ? "Keep holding..." : `${phaseTimeLeft}s remaining`}
              </span>

              {/* Animated Breathing Bubble */}
              <div className="bubble-wrapper">
                <div className="bubble-glow-ring" />
                <div className={`breathing-bubble ${getBubbleClass()}`} />
              </div>

              {/* Stats & Session Progress */}
              <div className="active-stats-row">
                <div className="active-stat-item">
                  <span className="stat-lbl">Time remaining</span>
                  <strong className="stat-val">{formatTime(timeLeft)}</strong>
                </div>
                <div className="active-stat-item">
                  <span className="stat-lbl">Session Cycle</span>
                  <strong className="stat-val">Cycle: {cycleCount}</strong>
                </div>
              </div>

              {/* Interactive Controls */}
              <div className="session-controls-row">
                <button 
                  onClick={togglePause} 
                  className={`btn ${isPaused ? "btn-primary" : "btn-gold"} control-btn`}
                  type="button"
                  aria-label={isPaused ? "Resume breathing session" : "Pause breathing session"}
                >
                  {isPaused ? (
                    <>
                      <Play size={15} fill="currentColor" /> Resume
                    </>
                  ) : (
                    <>
                      <Pause size={15} fill="currentColor" /> Pause
                    </>
                  )}
                </button>
                <button 
                  onClick={endSessionEarly} 
                  className="btn btn-ghost control-btn end-btn"
                  type="button"
                  aria-label="End breathing session early"
                >
                  <X size={15} /> End Session
                </button>
              </div>
            </div>
          )}

          {/* COMPLETE SCREEN */}
          {screen === "complete" && (
            <div className="breathing-card complete-view">
              {personalBestInfo && (
                <div className="personal-best-banner">
                  <h4>🎉 New Personal Best!</h4>
                  <p>Your completion: {personalBestInfo.currentScore}% (Previous best: {personalBestInfo.previousBest}%)</p>
                </div>
              )}

              <div className="success-icon-wrap">
                <CheckCircle2 size={36} className="success-icon" />
              </div>
              <h2>Session Complete 🌿</h2>
              <p className="complete-msg">
                Well done. Taking a conscious pause to breathe is a wonderful step towards mental clarity.
              </p>

              <div className="completion-summary-box">
                <div className="summary-stat-row">
                  <span>Duration:</span>
                  <strong>1 minute</strong>
                </div>
                <div className="summary-stat-row">
                  <span>Breathing cycles:</span>
                  <strong>{finalCycles}</strong>
                </div>
                <div className="summary-stat-row">
                  <span>Completion:</span>
                  <strong>{finalPercentage}%</strong>
                </div>
              </div>

              <div className="completion-actions-row">
                <button onClick={restartSession} className="btn btn-ghost retry-btn">
                  <RotateCcw size={14} /> Restart
                </button>
                <button onClick={handleDoneClick} className="btn btn-primary done-btn">
                  Done
                </button>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Optional Feedback Popup Overlay */}
      {showFeedback && (
        <FeedbackModal onSubmit={handleFeedbackSubmit} onSkip={handleFeedbackSkip} />
      )}
    </div>
  );
}

export default BreathingBubble;
