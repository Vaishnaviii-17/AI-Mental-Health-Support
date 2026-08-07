import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";

function ProfileWidget({ profile }) {
  const initial = profile?.username?.charAt(0)?.toUpperCase() || "M";
  return (
    <article id="profile" className="dashboard-card dashboard-profile" aria-labelledby="profile-title">
      <span className="eyebrow">Your space</span>
      <div className="dashboard-profile__header">
        <span className="dashboard-profile__avatar">{initial}</span>
        <div>
          <h2 id="profile-title">{profile?.username || "MindEase member"}</h2>
          <p>Member since {profile?.memberSince || "today"}</p>
        </div>
      </div>
      <p className="dashboard-profile__copy">
        Your wellbeing journey is yours alone. Come back whenever you need a calmer place to land.
      </p>
      <Link to="/profile" className="btn btn-ghost">
        <Pencil size={16} aria-hidden="true" /> Edit profile
      </Link>
    </article>
  );
}

export default ProfileWidget;
