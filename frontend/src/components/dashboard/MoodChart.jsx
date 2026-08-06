import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { ArrowUpRight } from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

function MoodChart({ entries = [] }) {
  const scores = entries.map((entry) => entry.score);
  const average = scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1) : "—";
  const data = { labels: entries.map((entry) => entry.label), datasets: [{ data: scores, borderColor: "#c9a66b", backgroundColor: "rgba(201, 166, 107, 0.18)", borderWidth: 2.5, tension: 0.42, fill: true, pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: "#fff", pointBorderColor: "#c9a66b", pointBorderWidth: 2 }] };
  const options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { displayColors: false, backgroundColor: "#163d2f", padding: 10, titleFont: { family: "Manrope" }, bodyFont: { family: "Manrope" }, callbacks: { label: (context) => `Mood score: ${context.parsed.y} / 5` } } }, scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: "#7c8d84", font: { family: "Manrope", size: 11 } } }, y: { display: false, min: 1, max: 5 } }, interaction: { intersect: false, mode: "index" } };

  return <article className="dashboard-card dashboard-chart" aria-labelledby="weekly-mood-title"><div className="dashboard-card__heading"><div><span className="eyebrow">A gentle overview</span><h2 id="weekly-mood-title">Weekly mood</h2></div><a href="#today-mood" className="dashboard-icon-link" aria-label="View mood history"><ArrowUpRight size={18} aria-hidden="true" /></a></div><div className="dashboard-chart__stats"><div><span>Average mood</span><strong>{average}<small> / 5</small></strong></div><p>Last 7 check-ins</p></div><div className="dashboard-chart__canvas"><Line data={data} options={options} aria-label="Mood score line chart for the last seven days" /></div><a href="#today-mood" className="dashboard-text-link">View history <ArrowUpRight size={14} aria-hidden="true" /></a></article>;
}

export default MoodChart;
