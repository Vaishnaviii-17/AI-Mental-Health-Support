import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";

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

import "./Dashboard.css";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
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

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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

        // No mood recorded today
        if (!mood) {
          setShowMoodModal(true);
        }
        } catch (error) {
          console.error("Unable to load today's mood", error);

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
      const savedMood = editingMood
        ? await updateMood(mood)
        : await saveMood(mood);

      console.log("Today's Mood:", savedMood);

      setTodayMood(savedMood);
      setEditingMood(null);
      setShowMoodModal(false);
    } catch (error) {
      console.error("Unable to save today's mood", error);
    }
  };

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
                mood={todayMood || data.latestMood}
                onUpdate={(mood) => {
                  setEditingMood(mood);
                  setShowMoodModal(true);
                }}
              />
              <MoodChart entries={data.moodHistory} />
            </section>
            <SummaryCards summary={data.summary} />
            <QuickActions />
            <section className="dashboard-content-grid">
              <JournalPreview journals={data.journals} />
              <ProfileWidget profile={profile} />
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
      
    </>
  );
}

export default Dashboard;
