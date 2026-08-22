import { useState } from "react";
import "./FeedbackModal.css";

const FEEDBACK_OPTIONS = [
  { value: 1, label: "Much worse" },
  { value: 2, label: "A little worse" },
  { value: 3, label: "About the same" },
  { value: 4, label: "A little better" },
  { value: 5, label: "Much better" },
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
      <div className="feedback-modal">
        <div className="feedback-modal__header">
          <h2>How was this activity?</h2>
          <p>How do you feel after completing it?</p>
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
