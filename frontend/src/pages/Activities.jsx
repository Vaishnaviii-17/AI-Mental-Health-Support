import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Music,
  Wind,
  ArrowRight,
  Clock3,
  Play,
  Compass,
  Brain,
  Leaf
} from "lucide-react";
import Navbar from "../components/Navbar/Navbar";
import { getActivityHistory, getOverallStats, getActivityStats } from "../services/activityService";
import "./Activities.css";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function formatActivityName(type) {
  if (type === "pop_stress") return "Pop the Stress";
  if (type === "memory_match") return "Memory Match";
  if (type === "breathing_bubble") return "Breathing Bubble";
  return type;
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
}

function PlantVisualizer({ level }) {
  if (level === 0) {
    return (
      <svg viewBox="0 0 100 100" width="130" height="130" className="garden-plant-svg">
        {/* Pot */}
        <path d="M 25,75 L 75,75 L 70,95 L 30,95 Z" fill="#8d6e63" />
        <path d="M 20,75 L 80,75 L 80,70 L 20,70 Z" fill="#704f44" />
        {/* Seed */}
        <ellipse cx="50" cy="65" rx="6" ry="4" fill="#a1887f" />
        <ellipse cx="50" cy="65" rx="3" ry="2" fill="#5d4037" />
        <text x="50" y="50" textAnchor="middle" fontSize="8" fill="#8d6e63" fontWeight="bold">SEED</text>
      </svg>
    );
  }
  if (level === 1) {
    return (
      <svg viewBox="0 0 100 100" width="130" height="130" className="garden-plant-svg">
        {/* Pot */}
        <path d="M 25,75 L 75,75 L 70,95 L 30,95 Z" fill="#8d6e63" />
        <path d="M 20,75 L 80,75 L 80,70 L 20,70 Z" fill="#704f44" />
        {/* Sprout */}
        <path d="M 50,70 Q 48,55 52,43" stroke="#81c784" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M 52,43 Q 62,38 60,48 Q 52,48 52,43" fill="#4caf50" />
        <path d="M 52,43 Q 42,36 40,46 Q 50,46 52,43" fill="#4caf50" />
      </svg>
    );
  }
  if (level === 2) {
    return (
      <svg viewBox="0 0 100 100" width="130" height="130" className="garden-plant-svg">
        {/* Pot */}
        <path d="M 25,75 L 75,75 L 70,95 L 30,95 Z" fill="#8d6e63" />
        <path d="M 20,75 L 80,75 L 80,70 L 20,70 Z" fill="#704f44" />
        {/* Stem */}
        <path d="M 50,70 Q 46,45 50,28" stroke="#81c784" strokeWidth="5" strokeLinecap="round" fill="none" />
        {/* Leaves */}
        <path d="M 48,53 Q 33,48 36,58 Q 48,58 48,53" fill="#4caf50" />
        <path d="M 50,41 Q 65,36 62,46 Q 50,46 50,41" fill="#4caf50" />
        <path d="M 50,28 Q 62,18 59,30 Q 50,30 50,28" fill="#2e7d32" />
        <path d="M 50,28 Q 38,16 41,28 Q 50,28 50,28" fill="#2e7d32" />
      </svg>
    );
  }
  if (level === 3) {
    return (
      <svg viewBox="0 0 100 100" width="130" height="130" className="garden-plant-svg">
        {/* Pot */}
        <path d="M 25,75 L 75,75 L 70,95 L 30,95 Z" fill="#8d6e63" />
        <path d="M 20,75 L 80,75 L 80,70 L 20,70 Z" fill="#704f44" />
        {/* Main Stem */}
        <path d="M 50,70 Q 45,40 50,18" stroke="#66bb6a" strokeWidth="6" strokeLinecap="round" fill="none" />
        {/* Branches & Leaves */}
        <path d="M 48,55 Q 30,50 35,63 Q 47,60 48,55" fill="#2e7d32" />
        <path d="M 51,47 Q 70,42 65,55 Q 51,53 51,47" fill="#2e7d32" />
        <path d="M 47,35 Q 30,27 28,40 Q 45,38 47,35" fill="#4caf50" />
        <path d="M 50,28 Q 68,20 64,33 Q 50,31 50,28" fill="#4caf50" />
        <ellipse cx="50" cy="18" rx="4" ry="6" fill="#c8e6c9" />
      </svg>
    );
  }
  // Blooming (Level 4+)
  return (
    <svg viewBox="0 0 100 100" width="130" height="130" className="garden-plant-svg">
      {/* Pot */}
      <path d="M 25,75 L 75,75 L 70,95 L 30,95 Z" fill="#8d6e63" />
      <path d="M 20,75 L 80,75 L 80,70 L 20,70 Z" fill="#704f44" />
      {/* Main Stem */}
      <path d="M 50,70 Q 46,40 50,22" stroke="#4caf50" strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* Leaves */}
      <path d="M 48,53 Q 30,47 34,60 Q 47,58 48,53" fill="#2e7d32" />
      <path d="M 51,43 Q 70,37 66,50 Q 51,48 51,43" fill="#2e7d32" />
      <path d="M 48,32 Q 32,24 30,37 Q 45,35 48,32" fill="#2e7d32" />
      {/* Flower Petals */}
      <ellipse cx="50" cy="11" rx="5" ry="9" fill="#ffffff" stroke="#e0e0e0" strokeWidth="0.5" transform="rotate(0, 50, 22)" />
      <ellipse cx="50" cy="11" rx="5" ry="9" fill="#ffffff" stroke="#e0e0e0" strokeWidth="0.5" transform="rotate(40, 50, 22)" />
      <ellipse cx="50" cy="11" rx="5" ry="9" fill="#ffffff" stroke="#e0e0e0" strokeWidth="0.5" transform="rotate(80, 50, 22)" />
      <ellipse cx="50" cy="11" rx="5" ry="9" fill="#ffffff" stroke="#e0e0e0" strokeWidth="0.5" transform="rotate(120, 50, 22)" />
      <ellipse cx="50" cy="11" rx="5" ry="9" fill="#ffffff" stroke="#e0e0e0" strokeWidth="0.5" transform="rotate(160, 50, 22)" />
      <ellipse cx="50" cy="11" rx="5" ry="9" fill="#ffffff" stroke="#e0e0e0" strokeWidth="0.5" transform="rotate(200, 50, 22)" />
      <ellipse cx="50" cy="11" rx="5" ry="9" fill="#ffffff" stroke="#e0e0e0" strokeWidth="0.5" transform="rotate(240, 50, 22)" />
      <ellipse cx="50" cy="11" rx="5" ry="9" fill="#ffffff" stroke="#e0e0e0" strokeWidth="0.5" transform="rotate(280, 50, 22)" />
      <ellipse cx="50" cy="11" rx="5" ry="9" fill="#ffffff" stroke="#e0e0e0" strokeWidth="0.5" transform="rotate(320, 50, 22)" />
      {/* Flower Center */}
      <circle cx="50" cy="22" r="7" fill="#fbc02d" />
    </svg>
  );
}

function formatMinutes(seconds) {
  if (!seconds || seconds <= 0) return "0 min";
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

function formatHoursAndMinutes(seconds) {
  if (!seconds || seconds <= 0) return "0 min";
  const mins = Math.round(seconds / 60);
  if (mins < 60) {
    return `${mins} min`;
  }
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (remainingMins === 0) {
    return `${hrs}h`;
  }
  return `${hrs}h ${remainingMins}m`;
}

function ActivitiesPage() {
  const storedUser = getStoredUser();

  // Garden and Overall Stats
  const [overall, setOverall] = useState(null);
  const [loadingOverall, setLoadingOverall] = useState(true);
  const [errorOverall, setErrorOverall] = useState(false);

  // Individual Game Stats
  const [popStats, setPopStats] = useState(null);
  const [memoryStats, setMemoryStats] = useState(null);
  const [breathingStats, setBreathingStats] = useState(null);
  const [loadingGameStats, setLoadingGameStats] = useState(true);

  // Paginated History
  const [history, setHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [errorHistory, setErrorHistory] = useState(false);

  const fetchOverall = useCallback(async () => {
    setLoadingOverall(true);
    setErrorOverall(false);
    try {
      const data = await getOverallStats();
      setOverall(data);
    } catch (err) {
      console.error("Failed to load overall activity stats:", err);
      setErrorOverall(true);
    } finally {
      setLoadingOverall(false);
    }
  }, []);

  const fetchGameStats = useCallback(async () => {
    setLoadingGameStats(true);
    try {
      const [pop, mem, breath] = await Promise.all([
        getActivityStats("pop_stress"),
        getActivityStats("memory_match"),
        getActivityStats("breathing_bubble")
      ]);
      setPopStats(pop);
      setMemoryStats(mem);
      setBreathingStats(breath);
    } catch (err) {
      console.error("Failed to load individual activity stats:", err);
    } finally {
      setLoadingGameStats(false);
    }
  }, []);

  const fetchHistory = useCallback(async (page, append = false) => {
    setLoadingHistory(true);
    setErrorHistory(false);
    try {
      const data = await getActivityHistory(page, 5);
      if (data) {
        setHistory(prev => append ? [...prev, ...data.sessions] : data.sessions);
        setHasMoreHistory(data.hasMore);
      }
    } catch (err) {
      console.error("Failed to load activity history:", err);
      setErrorHistory(true);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchOverall();
    fetchGameStats();
    fetchHistory(1, false);
  }, [fetchOverall, fetchGameStats, fetchHistory]);

  const loadMoreHistory = () => {
    const nextPage = historyPage + 1;
    setHistoryPage(nextPage);
    fetchHistory(nextPage, true);
  };

  const getActivityIcon = (type) => {
    if (type === "pop_stress") return <Sparkles size={16} className="history-type-icon text-sparkles" />;
    if (type === "memory_match") return <Brain size={16} className="history-type-icon text-brain" />;
    return <Wind size={16} className="history-type-icon text-wind" />;
  };

  return (
    <div className="app-layout">
      <Navbar profile={storedUser} />

      <div className="container app-content-wrapper activities-page-polish">
        
        {/* A. HEADER / INTRO */}
        <header className="page-header">
          <div className="page-header__title-row">
            <span className="eyebrow">Wellness Hub</span>
            <h1>Activities</h1>
          </div>
          <p className="page-header__subtitle">
            Find a small activity that helps you pause, relax, refocus, or take your mind off things.
          </p>
        </header>

        <div className="activities-stacked-flow">
          
          {/* B. TODAY'S ACTIVITY */}
          <section className="activities-section">
            <div className="section-block-title-row">
              <span className="eyebrow">Daily recommendation</span>
              <h2>Today's Activity</h2>
            </div>
            
            <article className="dashboard-recommendation activities-recommendation-card">
              <div className="dashboard-recommendation__content">
                <span className="eyebrow eyebrow--light">Today's Highlight</span>
                <h2>A three-minute breathing reset</h2>
                <p>A gentle pause to settle your mind and create some space for yourself.</p>
                <span className="dashboard-recommendation__duration">
                  <Clock3 size={16} aria-hidden="true" /> 1 min · Breathing exercise
                </span>
                <Link to="/activities/breathing" className="btn btn-gold">
                  Start Activity <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
              <div className="dashboard-recommendation__visual" role="img" aria-label="Soft moving air illustration">
                <Wind size={72} strokeWidth={1} aria-hidden="true" />
                <span />
                <span />
                <span />
              </div>
            </article>
          </section>

          {/* C. RELAX & UNWIND */}
          <section className="activities-section">
            <div className="section-block-title-row">
              <span className="eyebrow">Relax & Unwind</span>
              <h2>Gentle activities for relaxation and calming</h2>
            </div>
            
            <div className="activities-card-list">
              {/* MEDITATION CARD */}
              <div className="dashboard-card activity-card card-coming-soon">
                <div className="activity-card-header">
                  <Compass size={24} className="activity-icon-lucide" />
                  <span className="badge-coming-soon">Available soon</span>
                </div>
                <h3>Meditation</h3>
                <p>Take a quiet moment and slow down.</p>
                <button className="btn btn-ghost btn-disabled" disabled>
                  Available soon
                </button>
              </div>

              {/* CALMING MUSIC CARD */}
              <div className="dashboard-card activity-card card-coming-soon">
                <div className="activity-card-header">
                  <Music size={24} className="activity-icon-lucide" />
                  <span className="badge-coming-soon">Available soon</span>
                </div>
                <h3>Calming Music</h3>
                <p>Take a pause with calming sounds and music.</p>
                <button className="btn btn-ghost btn-disabled" disabled>
                  Available soon
                </button>
              </div>

              {/* BREATHING BUBBLE CARD */}
              <div className="dashboard-card activity-card">
                <div className="activity-card-header">
                  <Wind size={24} className="activity-icon-lucide text-wind" />
                  <span className="activity-duration">1 min</span>
                </div>
                <h3>Breathing Bubble</h3>
                <p>Follow a gentle breathing rhythm with a simple expanding and contracting bubble.</p>
                <Link to="/activities/breathing" className="btn btn-primary btn-play">
                  <Play size={14} fill="currentColor" /> Start
                </Link>
              </div>
            </div>
          </section>

          {/* D. FOCUS & PLAY */}
          <section className="activities-section">
            <div className="section-block-title-row">
              <span className="eyebrow">Focus & Play</span>
              <h2>Short interactive activities for focus, distraction and stress relief</h2>
            </div>

            <div className="activities-card-list">
              {/* POP THE STRESS CARD */}
              <div className="dashboard-card activity-card">
                <div className="activity-card-header">
                  <Sparkles size={24} className="activity-icon-lucide text-sparkles" />
                  <span className="activity-duration">60 sec</span>
                </div>
                <h3>Pop the Stress</h3>
                <p>Pop balloons, release a little tension, and see how high you can score.</p>
                <Link to="/activities/pop-stress" className="btn btn-primary btn-play">
                  <Play size={14} fill="currentColor" /> Play
                </Link>
              </div>

              {/* MEMORY MATCH CARD */}
              <div className="dashboard-card activity-card">
                <div className="activity-card-header">
                  <Brain size={24} className="activity-icon-lucide text-brain" />
                  <span className="activity-duration">1–3 min</span>
                </div>
                <h3>Memory Match</h3>
                <p>Match the pairs and give your mind a short focus break.</p>
                <Link to="/activities/memory-match" className="btn btn-primary btn-play">
                  <Play size={14} fill="currentColor" /> Play
                </Link>
              </div>
            </div>
          </section>

          {/* E. YOUR PROGRESS / GARDEN */}
          <section className="activities-section">
            <div className="section-block-title-row">
              <span className="eyebrow">Progress</span>
              <h2>Your Garden</h2>
            </div>

            {loadingOverall ? (
              <div className="dashboard-card garden-hero-card card-loading-center">
                <p className="no-stats-msg">Growing your garden...</p>
              </div>
            ) : errorOverall ? (
              <div className="dashboard-card garden-hero-card card-loading-center">
                <p className="no-stats-msg text-error-msg">Unable to load garden progress.</p>
                <button onClick={fetchOverall} className="btn btn-ghost btn-retry">Retry</button>
              </div>
            ) : overall ? (
              <div className="dashboard-card garden-hero-card">
                
                {/* Centered Plant SVG Column */}
                <div className="garden-hero-plant-col">
                  <PlantVisualizer level={overall.garden.gardenLevel} />
                </div>

                {/* Progress Details Column */}
                <div className="garden-hero-details-col">
                  <div className="garden-badge-wrap">
                    <div className="garden-badge">
                      <Leaf size={12} className="garden-badge-icon" /> {overall.garden.gardenStage}
                    </div>
                  </div>
                  
                  <h3 className="garden-hero-title">{overall.garden.gardenStage}</h3>
                  
                  <p className="garden-hero-ratio-text">
                    {overall.garden.completedActivities === 1 
                      ? "1 activity completed"
                      : `${overall.garden.completedActivities} activities completed`}
                  </p>

                  <div className="garden-hero-progress-row">
                    <div className="garden-progress-bar-wrapper">
                      <div 
                        className={`garden-progress-bar-fill level-${overall.garden.gardenLevel}`}
                        style={{ width: `${overall.garden.progressToNextLevel}%` }}
                      />
                    </div>
                  </div>

                  {overall.garden.completedActivities === 0 ? (
                    <p className="garden-hero-tip-text">
                      You haven't completed an activity yet. Start your first activity to grow your garden.
                    </p>
                  ) : (
                    <p className="garden-hero-tip-text">
                      {overall.garden.nextLevelAt 
                        ? `${overall.garden.nextLevelAt - overall.garden.completedActivities} more activities to reach ${
                            overall.garden.gardenLevel === 0 ? "Sprout"
                            : overall.garden.gardenLevel === 1 ? "Growing"
                            : overall.garden.gardenLevel === 2 ? "Young Plant"
                            : "Blooming"
                          }`
                        : "Your garden has reached full bloom! Beautiful job."}
                    </p>
                  )}

                  {/* Mindful Time Breakdown Side-by-Side */}
                  <div className="garden-hero-mindful-grid">
                    <div className="garden-hero-mindful-item">
                      <span>Today's mindful time</span>
                      <strong>{formatMinutes(overall.todayMindfulSeconds)}</strong>
                    </div>
                    <div className="garden-hero-mindful-item">
                      <span>This week</span>
                      <strong>{formatHoursAndMinutes(overall.weekMindfulSeconds)}</strong>
                    </div>
                  </div>

                  {/* Feedback summary rating */}
                  {overall.feedback.ratingCount > 0 ? (
                    <div className="garden-hero-feedback-summary">
                      <span className="feedback-summary-lbl">Activity Experience: </span>
                      <strong className="feedback-summary-val">{overall.feedback.averageRating} / 5</strong>
                      <span className="feedback-summary-count"> (Based on {overall.feedback.ratingCount} ratings)</span>
                    </div>
                  ) : (
                    <div className="garden-hero-feedback-summary">
                      <span className="feedback-summary-lbl">Activity Experience: </span>
                      <span className="feedback-summary-val" style={{ color: "var(--text-muted)", fontSize: "var(--fs-2xs)" }}>
                        No feedback yet
                      </span>
                    </div>
                  )}

                </div>
              </div>
            ) : null}
          </section>

          {/* F. ACTIVITY INSIGHTS (STATS) */}
          <section className="activities-section">
            <div className="section-block-title-row">
              <span className="eyebrow">Insights</span>
              <h2>Activity Insights</h2>
            </div>

            {loadingGameStats ? (
              <p className="stats-loading">Loading stats...</p>
            ) : (
              <div className="game-stats-grid">
                {/* Pop the Stress stats */}
                <div className="dashboard-card stat-table-card">
                  <div className="stat-card-title-row">
                    <Sparkles size={18} className="activity-icon-lucide text-sparkles" />
                    <h4>Pop the Stress</h4>
                  </div>
                  <div className="stat-rows-list">
                    <div className="stat-row-item">
                      <span>Best Score</span>
                      <strong>{popStats?.gamesPlayed > 0 ? popStats.bestScore : "—"}</strong>
                    </div>
                    <div className="stat-row-item">
                      <span>Games Played</span>
                      <strong>{popStats?.gamesPlayed > 0 ? popStats.gamesPlayed : "—"}</strong>
                    </div>
                    <div className="stat-row-item">
                      <span>Best Time</span>
                      <strong>{popStats?.gamesPlayed > 0 ? `${popStats.bestSurvivalTime} sec` : "—"}</strong>
                    </div>
                    <div className="stat-row-item">
                      <span>Balloons Popped</span>
                      <strong>{popStats?.gamesPlayed > 0 ? popStats.totalBalloons : "—"}</strong>
                    </div>
                  </div>
                </div>

                {/* Memory Match stats */}
                <div className="dashboard-card stat-table-card">
                  <div className="stat-card-title-row">
                    <Brain size={18} className="activity-icon-lucide text-brain" />
                    <h4>Memory Match</h4>
                  </div>
                  <div className="stat-rows-list">
                    <div className="stat-row-item">
                      <span>Best Focus Score</span>
                      <strong>{memoryStats?.gamesPlayed > 0 ? `${memoryStats.bestScore}%` : "—"}</strong>
                    </div>
                    <div className="stat-row-item">
                      <span>Best Completed Time</span>
                      <strong>{memoryStats?.gamesPlayed > 0 && memoryStats.bestTime > 0 ? `${memoryStats.bestTime} sec` : "—"}</strong>
                    </div>
                    <div className="stat-row-item">
                      <span>Fewest Attempts</span>
                      <strong>{memoryStats?.gamesPlayed > 0 && memoryStats.fewestAttempts > 0 ? memoryStats.fewestAttempts : "—"}</strong>
                    </div>
                    <div className="stat-row-item">
                      <span>Games Played</span>
                      <strong>{memoryStats?.gamesPlayed > 0 ? memoryStats.gamesPlayed : "—"}</strong>
                    </div>
                  </div>
                </div>

                {/* Breathing Bubble stats */}
                <div className="dashboard-card stat-table-card">
                  <div className="stat-card-title-row">
                    <Wind size={18} className="activity-icon-lucide text-wind" />
                    <h4>Breathing Bubble</h4>
                  </div>
                  <div className="stat-rows-list">
                    <div className="stat-row-item">
                      <span>Best Completion</span>
                      <strong>{breathingStats?.totalSessions > 0 ? `${breathingStats.bestCompletion}%` : "—"}</strong>
                    </div>
                    <div className="stat-row-item">
                      <span>Longest Session</span>
                      <strong>{breathingStats?.totalSessions > 0 ? `${breathingStats.longestSession} sec` : "—"}</strong>
                    </div>
                    <div className="stat-row-item">
                      <span>Total Sessions</span>
                      <strong>{breathingStats?.totalSessions > 0 ? breathingStats.totalSessions : "—"}</strong>
                    </div>
                    <div className="stat-row-item">
                      <span>Total Minutes</span>
                      <strong>{breathingStats?.totalSessions > 0 ? `${breathingStats.totalMinutes} min` : "—"}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* G. ACTIVITY HISTORY */}
          <section className="activities-section">
            <div className="section-block-title-row">
              <span className="eyebrow">Logbook</span>
              <h2>Activity History</h2>
            </div>

            {loadingHistory && history.length === 0 ? (
              <p className="stats-loading">Loading your history...</p>
            ) : errorHistory ? (
              <div className="stats-error">
                <span>Unable to load your history logs.</span>
                <button onClick={() => fetchHistory(1, false)} className="btn btn-ghost btn-retry">Try again</button>
              </div>
            ) : history.length === 0 ? (
              <div className="dashboard-card empty-history-card">
                <p className="no-stats-msg">No activities played yet. Complete your first activity to start tracking your progress.</p>
              </div>
            ) : (
              <div className="history-logs-container">
                
                {/* Desktop View Table */}
                <div className="dashboard-card history-table-card desktop-history-view-table">
                  <div className="table-responsive">
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th>Activity</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th className="text-right">Score</th>
                          <th className="text-right">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map(session => {
                          const isCompleted = session.completed;
                          const isPop = session.activity_type === "pop_stress";
                          
                          let badgeClass = "status-completed";
                          let badgeText = "Completed";
                          if (!isCompleted) {
                            if (isPop) {
                              badgeClass = "status-gameover";
                              badgeText = "Game Over";
                            } else {
                              badgeClass = "status-ended";
                              badgeText = "Ended Early";
                            }
                          }

                          return (
                            <tr key={session.id}>
                              <td className="history-name-col">
                                <div className="history-activity-icon-label">
                                  {getActivityIcon(session.activity_type)}
                                  <strong>{formatActivityName(session.activity_type)}</strong>
                                </div>
                              </td>
                              <td className="history-date-col">{formatDate(session.created_at)}</td>
                              <td>
                                <span className={`status-badge ${badgeClass}`}>{badgeText}</span>
                              </td>
                              <td className="text-right"><strong>{session.score}</strong></td>
                              <td className="text-right"><strong>{session.duration_seconds} sec</strong></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile/Tablet Card List View */}
                <div className="mobile-history-card-list">
                  {history.map(session => {
                    const isCompleted = session.completed;
                    const isPop = session.activity_type === "pop_stress";
                    
                    let badgeClass = "status-completed";
                    let badgeText = "Completed";
                    if (!isCompleted) {
                      if (isPop) {
                        badgeClass = "status-gameover";
                        badgeText = "Game Over";
                      } else {
                        badgeClass = "status-ended";
                        badgeText = "Ended Early";
                      }
                    }

                    return (
                      <div key={session.id} className="dashboard-card history-session-card">
                        <div className="history-session-header">
                          <div className="history-session-title">
                            <div className="history-activity-icon-label" style={{ gap: "4px" }}>
                              {getActivityIcon(session.activity_type)}
                              <strong>{formatActivityName(session.activity_type)}</strong>
                            </div>
                            <span className="history-session-date">{formatDate(session.created_at)}</span>
                          </div>
                          <span className={`status-badge ${badgeClass}`}>{badgeText}</span>
                        </div>
                        <div className="history-session-details">
                          <span>Score: <strong>{session.score}</strong></span>
                          <span>Duration: <strong>{session.duration_seconds} sec</strong></span>
                          {session.activity_type === "pop_stress" && (
                            <>
                              <span>Popped: <strong>{session.metadata.balloons_popped || 0}</strong></span>
                              <span>Missed: <strong>{session.metadata.missed || 0}</strong></span>
                            </>
                          )}
                          {session.activity_type === "memory_match" && (
                            <span>Attempts: <strong>{session.metadata.attempts || 0}</strong></span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hasMoreHistory && (
                  <div className="history-load-more-row">
                    <button 
                      onClick={loadMoreHistory} 
                      disabled={loadingHistory}
                      className="btn btn-ghost load-more-btn"
                    >
                      {loadingHistory ? "Loading..." : "Load More"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

        </div>

      </div>
    </div>
  );
}

export default ActivitiesPage;
