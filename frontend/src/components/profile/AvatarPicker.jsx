import { useState, useEffect, useRef } from "react";
import { X, Check } from "lucide-react";
import "./AvatarPicker.css";

export const AVATAR_LIST = [
  { id: "lotus",     label: "Lotus",     src: new URL("../../assets/avatars/lotus.svg",     import.meta.url).href },
  { id: "leaf",      label: "Leaf",      src: new URL("../../assets/avatars/leaf.svg",      import.meta.url).href },
  { id: "mountain",  label: "Mountain",  src: new URL("../../assets/avatars/mountain.svg",  import.meta.url).href },
  { id: "moon",      label: "Moon",      src: new URL("../../assets/avatars/moon.svg",      import.meta.url).href },
  { id: "wave",      label: "Wave",      src: new URL("../../assets/avatars/wave.svg",      import.meta.url).href },
  { id: "sun",       label: "Sun",       src: new URL("../../assets/avatars/sun.svg",       import.meta.url).href },
  { id: "butterfly", label: "Butterfly", src: new URL("../../assets/avatars/butterfly.svg", import.meta.url).href },
  { id: "river",     label: "River",     src: new URL("../../assets/avatars/river.svg",     import.meta.url).href },
  { id: "cloud",     label: "Cloud",     src: new URL("../../assets/avatars/cloud.svg",     import.meta.url).href },
  { id: "star",      label: "Star",      src: new URL("../../assets/avatars/star.svg",      import.meta.url).href },
];

export function getAvatarSrc(avatarId) {
  return AVATAR_LIST.find((a) => a.id === avatarId)?.src || AVATAR_LIST[0].src;
}

/**
 * AvatarPicker — modal overlay for selecting an avatar.
 * Props:
 *   currentAvatarId  string   — the currently saved avatar key
 *   onSave(id)       function — called when user confirms selection
 *   onClose()        function — called when user cancels
 */
function AvatarPicker({ currentAvatarId, onSave, onClose }) {
  const [selected, setSelected] = useState(currentAvatarId || "lotus");
  const overlayRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      className="avatar-picker-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Choose your avatar"
    >
      <div className="avatar-picker-card">
        <div className="avatar-picker-header">
          <h3>Choose your avatar</h3>
          <button
            type="button"
            className="avatar-picker-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="avatar-picker-grid">
          {AVATAR_LIST.map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              className={`avatar-option ${selected === avatar.id ? "avatar-option--selected" : ""}`}
              onClick={() => setSelected(avatar.id)}
              aria-label={avatar.label}
              aria-pressed={selected === avatar.id}
            >
              <img src={avatar.src} alt={avatar.label} className="avatar-option-img" />
              {selected === avatar.id && (
                <span className="avatar-option-check" aria-hidden="true">
                  <Check size={14} />
                </span>
              )}
              <span className="avatar-option-label">{avatar.label}</span>
            </button>
          ))}
        </div>

        <div className="avatar-picker-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSave(selected)}
          >
            Save Avatar
          </button>
        </div>
      </div>
    </div>
  );
}

export default AvatarPicker;
