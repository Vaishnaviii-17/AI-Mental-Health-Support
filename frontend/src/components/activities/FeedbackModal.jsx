import { useState } from "react";
import "./FeedbackModal.css";

const FEEDBACK_OPTIONS = [
  { value: 3, label: "Still the same" },
  { value: 4, label: "A little better" },
  { value: 5, label: "Good" },
];

export default function FeedbackModal({ onSubmit, onSkip }) {
  const [rating, setRating] = useState(null);

  const handleSubmit = () => {
    if (rating !== null && onSubmit) {
      onSubmit(rating);
    }
  };

  return (
    <div className="feedback-modal-overlay">
      <div className="feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <div className="feedback-modal__header">
          <h2 id="feedback-title">How are you feeling now?</h2>
          <p>A gentle, optional reflection before you continue.</p>
        </div>

        <div className="feedback-options-list">
          {FEEDBACK_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`feedback-option-btn ${rating === opt.value ? "active" : ""}`}
              onClick={() => setRating(opt.value)}
            >
              <span className="feedback-option-dot" />
              <span className="feedback-option-label">{opt.label}</span>
            </button>
          ))}
        </div>

        <div className="feedback-actions">
          <button type="button" onClick={onSkip} className="btn btn-ghost skip-btn">
            Skip
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={rating === null}
            className="btn btn-primary submit-btn"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
