import { Link } from "react-router-dom";
import {
  Smile,
  Pencil,
  History,
  Sparkles,
} from "lucide-react";

const MOOD_COLORS = {
  Happy: {
    background: "#FFF8E6",
    color: "#C88A12",
  },
  Calm: {
    background: "#EDF7FF",
    color: "#3B82F6",
  },
  Relaxed: {
    background: "#EEF8F1",
    color: "#2F855A",
  },
  Content: {
    background: "#F4F8EC",
    color: "#5B8A3C",
  },
  Sad: {
    background: "#F4F2FF",
    color: "#7367C8",
  },
  Angry: {
    background: "#FFF2EC",
    color: "#D97745",
  },
  Anxious: {
    background: "#EEF8F7",
    color: "#2E8B83",
  },
};

const formatMoodDateTime = (date) => {
  if (!date) return "";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

function LatestMoodCard({ mood, onUpdate }) {
  if (!mood) {
    return (
      <article className="dashboard-card dashboard-mood-card">

        <div className="dashboard-card__heading">
          <div>
            <span className="eyebrow">
              Latest Mood
            </span>

            <h2>How are you feeling today?</h2>
          </div>

          <Smile size={22} />
        </div>

        <div className="dashboard-empty">

          <p>
            No mood recorded today.
          </p>

          <Link
            to="/mood"
            className="btn btn-primary"
          >
            Check In
          </Link>

        </div>

      </article>
    );
  }

  const moodColor =
    MOOD_COLORS[mood.emotion] || MOOD_COLORS.Content;
  const detectedAt =
  mood.detected_at ||
  mood.detectedAt ||
  mood.created_at ||
  mood.createdAt ||
  null;

  return (
    <article
      className="dashboard-card dashboard-mood-card"
    >
      <div className="dashboard-card__heading">

        <div>

          <span className="eyebrow">
            Latest Mood
          </span>

          <h2>Latest Mood</h2>

        </div>

        <Smile size={22} />

      </div>

      <div className="dashboard-mood-card__body">

        <div
          className="dashboard-mood-card__emoji"
          style={{
            background: moodColor.background,
            color: moodColor.color,
          }}
        >
          {mood.emoji}
        </div>

        <h3 className="dashboard-mood-card__emotion">
          {mood.emotion}
        </h3>

        {detectedAt && (
          <p className="dashboard-mood-card__time">
            Detected {formatMoodDateTime(detectedAt)}
          </p>
        )}

        {mood.note && (
          <div className="dashboard-mood-note">
            <span className="dashboard-mood-note__label">
              Your note
            </span>

            <p>{mood.note}</p>
          </div>
        )}

        {mood.insight && (
          <div className="dashboard-mood-insight">
            <Sparkles
              size={18}
              strokeWidth={2}
            />

            <p>{mood.insight}</p>
          </div>
        )}
      </div>

      <div className="dashboard-mood-actions">
        <button
          type="button"
          className="dashboard-text-link"
          onClick={() => onUpdate?.(mood)}
        >
          Update Mood
        </button>

        <Link
          to="/mood/history"
          className="dashboard-text-link"
        >
          <History size={15} />
          History
        </Link>
      </div>
    </article>
  );
}

export default LatestMoodCard;