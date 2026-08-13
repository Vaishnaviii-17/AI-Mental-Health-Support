import { useCallback, useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { getMoodStats } from "../../services/analyticsService";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
);

function MoodChart() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadMoodStats = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const data = await getMoodStats();
      setStats(data);
    } catch (err) {
      console.error("Unable to load dashboard mood chart data", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMoodStats();
  }, [loadMoodStats]);

  const weeklyScores = useMemo(() => {
    if (!Array.isArray(stats?.weeklyScores)) {
      return [];
    }

    return stats.weeklyScores;
  }, [stats]);

  const scores = useMemo(
    () =>
      weeklyScores
        .map((entry) => Number(entry.score))
        .filter((score) => Number.isFinite(score)),
    [weeklyScores]
  );

  const average = scores.length
    ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)
    : "—";

  const chartData = useMemo(
    () => ({
      labels: weeklyScores.length
        ? weeklyScores.map((entry) => entry.label)
        : ["No data"],
      datasets: [
        {
          label: "Mood Score",
          data: weeklyScores.length
            ? weeklyScores.map((entry) => entry.score)
            : [0],
          borderColor: "#c9a66b",
          backgroundColor: "rgba(201, 166, 107, 0.18)",
          borderWidth: 2.5,
          tension: 0.42,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: "#fff",
          pointBorderColor: "#c9a66b",
          pointBorderWidth: 2,
        },
      ],
    }),
    [weeklyScores]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          displayColors: false,
          backgroundColor: "#163d2f",
          padding: 10,
          titleFont: {
            family: "Manrope",
          },
          bodyFont: {
            family: "Manrope",
          },
          callbacks: {
            label: (context) =>
              `Mood score: ${context.parsed.y} / 5`,
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          border: {
            display: false,
          },
          ticks: {
            color: "#7c8d84",
            font: {
              family: "Manrope",
              size: 11,
            },
          },
        },
        y: {
          display: false,
          min: 1,
          max: 5,
        },
      },
      interaction: {
        intersect: false,
        mode: "index",
      },
    }),
    []
  );

  return (
    <article
      className="dashboard-card dashboard-chart"
      aria-labelledby="weekly-mood-title"
    >
      <div className="dashboard-card__heading">
        <div>
          <span className="eyebrow">A gentle overview</span>
          <h2 id="weekly-mood-title">Weekly mood</h2>
        </div>

        <a
          href="#today-mood"
          className="dashboard-icon-link"
          aria-label="View mood history"
        >
          <ArrowUpRight size={18} aria-hidden="true" />
        </a>
      </div>

      <div className="dashboard-chart__stats">
        <div>
          <span>Average mood</span>

          <strong>
            {loading ? "…" : average}
            <small> / 5</small>
          </strong>
        </div>

        <p>
          {loading
            ? "Loading mood data..."
            : weeklyScores.length
              ? "Weekly mood trend"
              : "No mood data yet"}
        </p>
      </div>

      <div className="dashboard-chart__canvas">
        {loading ? (
          <div className="dashboard-chart__state">
            <span>Loading your mood trend...</span>
          </div>
        ) : error ? (
          <div className="dashboard-chart__state">
            <span>Unable to load mood data.</span>

            <button
              type="button"
              className="dashboard-chart__retry"
              onClick={loadMoodStats}
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        ) : (
          <Line
            data={chartData}
            options={chartOptions}
            aria-label="Mood score line chart based on your weekly mood data"
          />
        )}
      </div>

      <a href="#today-mood" className="dashboard-text-link">
        View history <ArrowUpRight size={14} aria-hidden="true" />
      </a>
    </article>
  );
}

export default MoodChart;