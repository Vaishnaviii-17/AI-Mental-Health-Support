import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Leaf, Activity } from "lucide-react";
import Navbar from "../components/Navbar/Navbar";
import WelcomeCard from "../components/dashboard/WelcomeCard";
import MoodCard from "../components/dashboard/LatestMoodCard";
import MoodChart from "../components/dashboard/MoodChart";
import JournalPreview from "../components/dashboard/JournalPreview";
import RecommendationCard from "../components/dashboard/RecommendationCard";
import QuickActions from "../components/dashboard/QuickActions";
import QuoteCard from "../components/dashboard/QuoteCard";
import SummaryCards from "../components/dashboard/SummaryCards";
import ProfileWidget from "../components/dashboard/ProfileWidget";

import MoodCheckInModal from "../components/mood/MoodCheckInModal";

import {
  DashboardError,
  DashboardLoading,
} from "../components/dashboard/DashboardState";

import { getDashboardData } from "../services/dashboardService";
import {
  getTodayMood,
  saveMood,
  updateMood,
} from "../services/moodService";
import { getOverallStats } from "../services/activityService";

import "./Dashboard.css";


function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

// Streak milestone messages
function streakMessage(streak) {
  if (streak >= 30) return `🔥 ${streak}-day streak! You're unstoppable.`;
  if (streak >= 14) return `🔥 ${streak}-day streak! Two weeks strong!`;
  if (streak >= 7)  return `🔥 ${streak}-day streak! One week of consistency!`;
  if (streak >= 3)  return `🔥 ${streak}-day streak! Keep the momentum going.`;
  if (streak === 2) return `🔥 2-day streak! Great start!`;
  return `🔥 Day 1! Every journey starts here.`;
}

function StreakToast({ streak, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      className="streak-toast"
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.95 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      role="status"
      aria-live="polite"
    >
      <Flame size={18} className="streak-toast__icon" />
      <span>{streakMessage(streak)}</span>
      <button
        type="button"
        className="streak-toast__close"
        onClick={onDismiss}
        aria-label="Dismiss streak notification"
      >
        ×
      </button>
    </motion.div>
  );
}

function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  // Today's mood
  const [todayMood, setTodayMood] = useState(null);
  const [moodLoading, setMoodLoading] = useState(true);
  const [moodChecked, setMoodChecked] = useState(false);

  // Mood modal
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [editingMood, setEditingMood] = useState(null);

  // Streak toast
  const [streakToast, setStreakToast] = useState(null);
  const isFirstCheckIn = useRef(false);

  // Wellness Activities widget
  const [activitySummary, setActivitySummary] = useState(null);
  const [loadingActivitySummary, setLoadingActivitySummary] = useState(true);

  const storedUser = getStoredUser();

  const loadDashboard = useCallback(async () => {
    setError(false);
    try {
      setData(await getDashboardData());
    } catch (loadError) {
      console.error("Unable to load dashboard", loadError);
      setError(true);
    }
  }, []);

  const loadActivitySummary = useCallback(async () => {
    setLoadingActivitySummary(true);
    try {
      const overallStats = await getOverallStats();
      setActivitySummary(overallStats);
    } catch (err) {
      console.error("Unable to load activity summary", err);
    } finally {
      setLoadingActivitySummary(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    loadActivitySummary();
  }, [loadActivitySummary]);


  useEffect(() => {
    if (data && window.location.hash) {
      const id = window.location.hash.substring(1);
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 200);
    }
  }, [data]);

  useEffect(() => {
    let isCurrent = true;

    async function loadTodayMood() {
      try {
        setMoodLoading(true);
        setMoodChecked(false);

        const mood = await getTodayMood();

        if (!isCurrent) return;

        setTodayMood(mood);
        setMoodChecked(true);

        // No mood recorded today — open check-in modal
        if (!mood) {
          isFirstCheckIn.current = true;
          setShowMoodModal(true);
        }
        } catch (err) {
          console.error("Unable to load today's mood", err);

          if (isCurrent) {
            setMoodChecked(true);
          }
        } finally {
          if (isCurrent) {
            setMoodLoading(false);
          }
        }
      }

    loadTodayMood();

    return () => {
      isCurrent = false;
    };
  }, []);

  const handleMoodSave = async (mood) => {
    try {
      const isNew = !editingMood;
      const savedMood = editingMood
        ? await updateMood(mood)
        : await saveMood(mood);

      setTodayMood(savedMood);
      setEditingMood(null);
      setShowMoodModal(false);

      // Re-fetch dashboard data to get updated summary + combined mood
      const freshData = await getDashboardData();
      setData(freshData);

      // Show streak toast only on a fresh new check-in (not an edit)
      if (isNew && isFirstCheckIn.current) {
        const streakSummaryItem = freshData?.summary?.find(s => s.icon === "streak");
        const streak = streakSummaryItem?.value ?? 1;
        setStreakToast(streak);
        isFirstCheckIn.current = false;
      }
    } catch (err) {
      console.error("Unable to save today's mood", err);
    }
  };

  // The mood shown on the card: prefer today's combined mood (which includes
  // all three sources) over the raw latest mood event.
  const displayMood = data?.todayCombinedMood || todayMood || data?.latestMood;
  const profile = { ...data?.profile, ...storedUser };

  return (
    <>
      <a href="#dashboard" className="skip-link">
        Skip to dashboard content
      </a>
      <Navbar profile={profile} />
      {error ? (
        <DashboardError onRetry={loadDashboard} />
      ) : !data ? (
        <DashboardLoading />
      ) : (
        <main className={`dashboard ${ showMoodModal ? "dashboard--blur" : ""}`}>
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <WelcomeCard username={profile.username} />
            </motion.div>
            <section
              id="today-mood"
              className="dashboard-overview"
              aria-label="Today at a glance"
            >
              <MoodCard
                mood={displayMood}
                onUpdate={(mood) => {
                  setEditingMood(mood);
                  setShowMoodModal(true);
                }}
              />
              <MoodChart />
            </section>
            <SummaryCards summary={data.summary} />
            <QuickActions />
            <section className="dashboard-content-grid">
              <JournalPreview journals={data.journals} />
              <div className="dashboard-right-col">
                {/* Wellness Activities Widget */}
                <div className="dashboard-card wellness-activities-widget">
                  <div className="dashboard-card__heading">
                    <div>
                      <span className="eyebrow">Wellness Activities</span>
                      <h2>Your Progress</h2>
                    </div>
                    <Activity size={18} style={{ color: "var(--forest-600)", flexShrink: 0 }} />
                  </div>

                  {loadingActivitySummary ? (
                    <p className="wellness-widget-loading">Loading...</p>
                  ) : activitySummary ? (
                    <div className="wellness-widget-body">
                      <div className="wellness-metric-row">
                        <Activity size={13} style={{ color: "var(--forest-500)", flexShrink: 0 }} />
                        <span>
                          <strong>{activitySummary.summary.completedCount}</strong>{" "}
                          {activitySummary.summary.completedCount === 1 ? "activity" : "activities"} completed
                        </span>
                      </div>
                      <div className="wellness-metric-row">
                        <Leaf size={13} style={{ color: "var(--forest-500)", flexShrink: 0 }} />
                        <span>
                          <strong>
                            {activitySummary.summary.totalDurationSeconds > 0
                              ? Math.round(activitySummary.summary.totalDurationSeconds / 60)
                              : 0}
                          </strong>{" "}
                          minutes of mindful activity
                        </span>
                      </div>
                      <div className="wellness-metric-row">
                        <Leaf size={13} style={{ color: "var(--forest-400)", flexShrink: 0 }} />
                        <span>
                          Garden: <strong>{activitySummary.garden.gardenStage}</strong>
                        </span>
                      </div>

                      {activitySummary.summary.completedCount === 0 && (
                        <p className="wellness-empty-hint">
                          Complete your first activity to start growing your garden.
                        </p>
                      )}

                      <Link to="/activities" className="btn btn-ghost wellness-view-btn">
                        View Activities
                      </Link>
                    </div>
                  ) : (
                    <p className="wellness-widget-loading">No activity data yet.</p>
                  )}
                </div>

                <ProfileWidget profile={profile} />
              </div>
            </section>

            <RecommendationCard recommendation={data.recommendation} />
            
            <QuoteCard quote={data.quote} />
            
          </div>
        </main>
      )}
      {data && !moodLoading && showMoodModal && (
        <MoodCheckInModal
          mood={editingMood}
          onClose={() => {
            setEditingMood(null);
            setShowMoodModal(false);
          }}
          onSave={handleMoodSave}
        />
      )}

      {/* Streak Toast */}
      <AnimatePresence>
        {streakToast !== null && (
          <StreakToast
            streak={streakToast}
            onDismiss={() => setStreakToast(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default Dashboard;
