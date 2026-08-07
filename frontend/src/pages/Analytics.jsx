import { useState, useEffect, useCallback, useMemo } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend
} from "chart.js";
import { Smile, Calendar, TrendingUp, CheckCircle2, RefreshCw, ChevronLeft, ChevronRight, BarChart2 } from "lucide-react";
import Navbar from "../components/Navbar/Navbar";
import { getMoodStats, getMoodHistory, getActivityCalendar } from "../services/analyticsService";
import "./Analytics.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function AnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [activityData, setActivityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // History Pagination
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 5;

  const storedUser = getStoredUser();

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, historyData, activityRes] = await Promise.all([
        getMoodStats(),
        getMoodHistory(),
        getActivityCalendar()
      ]);
      setStats(statsData);
      setHistory(historyData || []);
      setActivityData(activityRes || []);
      setHistoryPage(1); 
    } catch (err) {
      console.error("Unable to load analytics data", err);
      setError("Failed to load your wellness analytics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const formatDate = (dateStr) => {
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
  };

  // 12-Month LeetCode/GitHub-Style Activity Heatmap Calculator
  const calendarWeeks = useMemo(() => {
    const weeks = [];
    const today = new Date();
    
    // Start exactly 364 days (52 weeks) ago
    const startDate = new Date();
    startDate.setDate(today.getDate() - 364);
    const startDay = startDate.getDay();
    // Adjust to start on Sunday of that week
    startDate.setDate(startDate.getDate() - startDay);

    // Map activity count to date key YYYY-MM-DD
    const activityMap = {};
    activityData.forEach((item) => {
      activityMap[item.date] = item.count;
    });

    // Generate 53 columns (weeks) x 7 rows (days)
    for (let w = 0; w < 53; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + (w * 7) + d);
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;
        
        const count = activityMap[dateStr] || 0;
        
        week.push({
          date: date,
          dateStr: dateStr,
          count: count,
          isFuture: date > today
        });
      }
      weeks.push(week);
    }
    return weeks;
  }, [activityData]);

  // Labels for months positioned above columns
  const monthLabels = useMemo(() => {
    const labels = [];
    let prevMonth = -1;
    calendarWeeks.forEach((week, wIdx) => {
      const firstDayOfWeek = week[0].date;
      const month = firstDayOfWeek.getMonth();
      if (month !== prevMonth) {
        labels.push({
          text: firstDayOfWeek.toLocaleString("en-US", { month: "short" }),
          colIndex: wIdx
        });
        prevMonth = month;
      }
    });
    return labels;
  }, [calendarWeeks]);

  // Configure Weekly Mood Line Chart
  const lineChartData = useMemo(() => {
    return {
      labels: stats?.weeklyScores?.length ? stats.weeklyScores.map(w => w.label) : ["N/A"],
      datasets: [
        {
          label: "Mood Score",
          data: stats?.weeklyScores?.length ? stats.weeklyScores.map(w => w.score) : [0],
          borderColor: "#c9a66b",
          backgroundColor: "rgba(201, 166, 107, 0.1)",
          borderWidth: 2,
          tension: 0.35,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: "#fff",
          pointBorderColor: "#c9a66b",
        }
      ]
    };
  }, [stats]);

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        backgroundColor: "#163d2f",
        titleFont: { family: "Manrope", size: 11 },
        bodyFont: { family: "Manrope", size: 11 },
        callbacks: {
          label: (context) => `Mood score: ${context.parsed.y} / 5`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#7c8d84", font: { family: "Manrope", size: 10 } }
      },
      y: {
        min: 1,
        max: 5,
        ticks: { stepSize: 1, color: "#7c8d84", font: { size: 10 } },
        grid: { color: "rgba(27, 67, 50, 0.04)" }
      }
    }
  };

  // Configure Emotion Distribution Bar Chart
  const emotionLabels = stats?.emotionDistribution ? Object.keys(stats.emotionDistribution) : [];
  const emotionValues = stats?.emotionDistribution ? Object.values(stats.emotionDistribution) : [];

  const barChartData = useMemo(() => {
    return {
      labels: emotionLabels.length ? emotionLabels : ["No Data"],
      datasets: [
        {
          data: emotionValues.length ? emotionValues : [0],
          backgroundColor: "rgba(27, 67, 50, 0.15)",
          borderColor: "#1b4332",
          borderWidth: 1.25,
          borderRadius: 4,
        }
      ]
    };
  }, [stats, emotionLabels, emotionValues]);

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#163d2f",
        bodyFont: { family: "Manrope", size: 11 }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#7c8d84", font: { family: "Manrope", size: 10 } }
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, color: "#7c8d84", font: { size: 10 } },
        grid: { color: "rgba(27, 67, 50, 0.04)" }
      }
    }
  };

  // Slice history list
  const paginatedHistory = useMemo(() => {
    const startIndex = (historyPage - 1) * itemsPerPage;
    return history.slice(startIndex, startIndex + itemsPerPage);
  }, [history, historyPage]);

  const totalHistoryPages = Math.ceil(history.length / itemsPerPage);

  const hasData = stats && stats.checkinsCount > 0;

  return (
    <>
      <Navbar profile={storedUser} />
      <main id="analytics" className="analytics-page">
        <div className="container">
          {/* Header */}
          <header className="analytics-header">
            <span className="eyebrow">A gentle overview</span>
            <h1>Analytics</h1>
            <p className="analytics-subtitle">A calm, neutral overview of your wellness trends and emotional patterns.</p>
          </header>

          {error && (
            <div className="analytics-error-banner">
              <span>{error}</span>
              <button type="button" className="analytics-retry-btn" onClick={loadAnalytics}>
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="analytics-loading-state">
              <div className="analytics-spinner" />
              <p>Gathering your wellness insights...</p>
            </div>
          ) : !hasData ? (
            <div className="analytics-empty-state dashboard-card compact-card">
              <BarChart2 size={36} className="analytics-empty-icon" />
              <h2>No mood patterns recorded yet</h2>
              <p>Complete a few mood check-ins or save journal entries to see your wellness trends.</p>
            </div>
          ) : (
            <div className="analytics-content-grid">
              
              {/* 1. Summary Cards Grid */}
              <section className="analytics-summary-cards" aria-label="Wellness summary statistics">
                <article className="dashboard-card summary-card-item">
                  <span className="eyebrow">Average Mood</span>
                  <div className="summary-card-value-wrap">
                    <h3>{stats.avgScore} <small>/ 5</small></h3>
                    <CheckCircle2 size={18} className="summary-card-icon mood-check" />
                  </div>
                  <p className="summary-card-description">Your average wellness score over time.</p>
                </article>

                <article className="dashboard-card summary-card-item">
                  <span className="eyebrow">Emotion Pattern</span>
                  <div className="summary-card-value-wrap">
                    <h3>{stats.mostCommon}</h3>
                    <Smile size={18} className="summary-card-icon mood-smile" />
                  </div>
                  <p className="summary-card-description">Your most frequent emotional state.</p>
                </article>

                <article className="dashboard-card summary-card-item">
                  <span className="eyebrow">Check-ins</span>
                  <div className="summary-card-value-wrap">
                    <h3>{stats.checkinsCount}</h3>
                    <Calendar size={18} className="summary-card-icon mood-calendar" />
                  </div>
                  <p className="summary-card-description">Total recorded wellness reflections.</p>
                </article>

                <article className="dashboard-card summary-card-item">
                  <span className="eyebrow">Wellness Trend</span>
                  <div className="summary-card-value-wrap">
                    <h3>{stats.trend}</h3>
                    <TrendingUp size={18} className="summary-card-icon mood-trend" />
                  </div>
                  <p className="summary-card-description">
                    {stats.trend === "Improving" && "Your wellness scores show an upward trajectory."}
                    {stats.trend === "Stable" && "Your emotional patterns remain steady."}
                    {stats.trend === "Declining" && "Scores reflect a slightly heavier emotional pattern."}
                  </p>
                </article>
              </section>

              {/* 2. ACTIVITY CALENDAR (GitHub/LeetCode Heatmap) */}
              <section className="analytics-section-block">
                <div className="section-block-title-row">
                  <span className="eyebrow">MindEase Activity</span>
                  <h2>Daily reflections & usage</h2>
                </div>
                
                <div className="dashboard-card activity-calendar-card">
                  <div className="activity-calendar-header">
                    <span className="calendar-caption">Activity count over the last 12 months</span>
                    <div className="activity-legend">
                      <span>Less</span>
                      <div className="legend-box level-0" title="0 activities" />
                      <div className="legend-box level-1" title="1 activity" />
                      <div className="legend-box level-2" title="2 activities" />
                      <div className="legend-box level-3" title="3 activities" />
                      <div className="legend-box level-4" title="4+ activities" />
                      <span>More</span>
                    </div>
                  </div>

                  <div className="activity-grid-scroll-container">
                    <div className="activity-grid-container">
                      {/* Months labels row */}
                      <div className="month-labels-row">
                        <div className="day-label-spacer" />
                        <div className="month-labels-list">
                          {monthLabels.map((m, idx) => (
                            <span
                              key={idx}
                              className="month-label"
                              style={{ gridColumnStart: m.colIndex + 1 }}
                            >
                              {m.text}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Heatmap grid */}
                      <div className="activity-weeks-grid">
                        <div className="day-labels-column">
                          <span>Mon</span>
                          <span>Wed</span>
                          <span>Fri</span>
                        </div>

                        <div className="weeks-columns-container">
                          {calendarWeeks.map((week, wIdx) => (
                            <div key={wIdx} className="calendar-week-column">
                              {week.map((day, dIdx) => {
                                let levelClass = "level-0";
                                if (day.count === 1) levelClass = "level-1";
                                else if (day.count === 2) levelClass = "level-2";
                                else if (day.count === 3) levelClass = "level-3";
                                else if (day.count >= 4) levelClass = "level-4";

                                const tooltipText = day.isFuture
                                  ? "Future date"
                                  : `${day.date.toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric"
                                    })}: ${day.count} activities`;

                                return (
                                  <div
                                    key={dIdx}
                                    className={`calendar-day-cell ${levelClass} ${day.isFuture ? "cell-future" : ""}`}
                                    title={tooltipText}
                                  />
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. CHARTS ROW */}
              <section className="analytics-charts-row">
                {/* Weekly Trend Line Chart */}
                <article className="dashboard-card analytics-chart-card">
                  <div className="dashboard-card__heading">
                    <div>
                      <span className="eyebrow">Weekly pattern</span>
                      <h2>Your mood trend</h2>
                    </div>
                  </div>
                  <div className="chart-canvas-wrapper">
                    <Line data={lineChartData} options={lineChartOptions} />
                  </div>
                </article>

                {/* Emotion Distribution Bar Chart */}
                <article className="dashboard-card analytics-chart-card">
                  <div className="dashboard-card__heading">
                    <div>
                      <span className="eyebrow">Emotion Distribution</span>
                      <h2>Frequency of emotions</h2>
                    </div>
                  </div>
                  <div className="chart-canvas-wrapper">
                    <Bar data={barChartData} options={barChartOptions} />
                  </div>
                </article>
              </section>

              {/* 4. HISTORY TABLE / LIST */}
              <section className="analytics-history-section">
                <div className="section-block-title-row">
                  <span className="eyebrow">History logs</span>
                  <h2>Recent reflections</h2>
                </div>
                
                {/* A. DESKTOP VIEW: Compact Table Card Layout */}
                <div className="dashboard-card history-table-card desktop-history-view">
                  <div className="table-responsive">
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th className="text-center">Mood</th>
                          <th>Emotion</th>
                          <th>Score</th>
                          <th>AI Insight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedHistory.map((item) => (
                          <tr key={item.id}>
                            <td className="history-date-col">{formatDate(item.date)}</td>
                            <td className="text-center history-mood-col">
                              <span className="history-emoji">{item.mood || "📝"}</span>
                            </td>
                            <td className="history-emotion-col">
                              <span className="emotion-word-badge">{item.emotion}</span>
                            </td>
                            <td>
                              <strong>{item.score} <small>/ 5</small></strong>
                            </td>
                            <td className="history-insight-col">{item.insight || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* B. MOBILE VIEW: Compact Card List Layout */}
                <div className="mobile-history-view">
                  {paginatedHistory.map((item) => (
                    <div key={item.id} className="dashboard-card history-mobile-card">
                      <div className="history-mobile-card-header">
                        <span className="history-emoji">{item.mood || "📝"}</span>
                        <div>
                          <span className="history-mobile-card-date">{formatDate(item.date)}</span>
                          <div className="history-mobile-card-badges">
                            <span className="emotion-word-badge">{item.emotion}</span>
                            <span className="history-mobile-card-score">Score: {item.score}/5</span>
                          </div>
                        </div>
                      </div>
                      {item.insight && (
                        <p className="history-mobile-card-insight">
                          <strong>Reflection:</strong> {item.insight}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalHistoryPages > 1 && (
                  <div className="history-pagination-row">
                    <button
                      type="button"
                      className="btn btn-ghost pagination-btn"
                      onClick={() => setHistoryPage(prev => Math.max(prev - 1, 1))}
                      disabled={historyPage === 1}
                      aria-label="Previous Page"
                    >
                      <ChevronLeft size={14} />
                      <span>Prev</span>
                    </button>
                    <span className="pagination-info">
                      Page {historyPage} of {totalHistoryPages}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost pagination-btn"
                      onClick={() => setHistoryPage(prev => Math.min(prev + 1, totalHistoryPages))}
                      disabled={historyPage === totalHistoryPages}
                      aria-label="Next Page"
                    >
                      <span>Next</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default AnalyticsPage;
