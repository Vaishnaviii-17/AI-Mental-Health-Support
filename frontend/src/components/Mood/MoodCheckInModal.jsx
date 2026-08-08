import { useMemo, useState } from "react";
import { X } from "lucide-react";
import "./MoodCheckInModal.css";

const MOODS = [
  {
    value: 1,
    emoji: "😢",
    label: "Very Sad",
    color: "#E76F51",
  },
  {
    value: 2,
    emoji: "😟",
    label: "Sad",
    color: "#F4A261",
  },
  {
    value: 3,
    emoji: "😐",
    label: "Neutral",
    color: "#6B7280",
  },
  {
    value: 4,
    emoji: "🙂",
    label: "Happy",
    color: "#2F855A",
  },
  {
    value: 5,
    emoji: "😊",
    label: "Very Happy",
    color: "#C89B3C",
  },
];

function MoodCheckInModal({
  mood,
  onClose,
  onSave,
}) {
  const [selectedMood, setSelectedMood] = useState(
    mood?.score ?? null
  );

  const [note, setNote] = useState(
    mood?.note ?? ""
  );
  const currentMood = useMemo(() => {
    return MOODS.find((mood) => mood.value === selectedMood);
  }, [selectedMood]);

  const handleSave = () => {
    if (!currentMood) return;

    if (onSave) {
      onSave({
        emoji: currentMood.emoji,
        emotion: currentMood.label,
        score: currentMood.value,
        note: note.trim(),
      });
    }
  };

  return (
    <div className="mood-modal-overlay">
      <div className="mood-modal">

        <button
          className="mood-modal__close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="mood-modal__header">

          <div className="mood-modal__icon">
            🌿
          </div>

          <h2>How are you feeling today?</h2>

          <p>
            Take a moment to check in with yourself.
          </p>

        </div>

        <div className="mood-selector">

          {MOODS.map((mood) => (
            <button
              key={mood.value}
              type="button"
              className={`mood-selector__item ${
                selectedMood === mood.value
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setSelectedMood(mood.value)
              }
            >
              <span className="mood-selector__emoji">
                {mood.emoji}
              </span>
            </button>
          ))}

        </div>

        <div className="mood-selected-label">

          {currentMood
            ? currentMood.label
            : "Select your mood"}

        </div>

        <div className="mood-note">

          <label htmlFor="mood-note">
            Add a note (optional)
          </label>

          <textarea
            id="mood-note"
            value={note}
            maxLength={200}
            placeholder="How has your day been so far?"
            onChange={(e) =>
              setNote(e.target.value)
            }
          />

          <span className="mood-note__count">
            {note.length}/200
          </span>

        </div>

        <button
          className="btn btn-primary mood-save-btn"
          disabled={!selectedMood}
          onClick={handleSave}
        >
          {mood ? "Update My Mood" : "Save My Mood"}
        </button>

      </div>
    </div>
  );
}

export default MoodCheckInModal;