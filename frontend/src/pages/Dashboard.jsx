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
import {
  DashboardError,
  DashboardLoading,
} from "../components/dashboard/DashboardState";
import { getDashboardData } from "../services/dashboardService";
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
    let isCurrent = true;

    getDashboardData()
      .then((dashboardData) => {
        if (isCurrent) setData(dashboardData);
      })
      .catch((loadError) => {
        console.error("Unable to load dashboard", loadError);
        if (isCurrent) setError(true);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

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
        <main id="dashboard" className="dashboard">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <WelcomeCard username={profile.username} />
            </motion.div>
            <section
              className="dashboard-overview"
              aria-label="Today at a glance"
            >
              <MoodCard mood={data.latestMood} />
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
    </>
  );
}

export default Dashboard;
