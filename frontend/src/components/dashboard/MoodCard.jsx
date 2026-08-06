import { Link } from "react-router-dom";
import { Pencil, Plus, Smile } from "lucide-react";

function MoodCard({ mood }) {
  return (
    <article id="today-mood" className="dashboard-card dashboard-mood-card" aria-labelledby="today-mood-title">
      <div className="dashboard-card__heading"><div><span className="eyebrow">Your check-in</span><h2 id="today-mood-title">Today&apos;s mood</h2></div><Smile size={22} aria-hidden="true" /></div>
      {mood ? <div className="dashboard-mood-card__logged"><span className="dashboard-mood-card__emoji" aria-label={mood.name}>{mood.emoji}</span><div><p className="dashboard-mood-card__name">{mood.name}</p><p className="dashboard-mood-card__meta">{mood.score} / 5 · {mood.loggedAt}</p></div><Link to="#" className="dashboard-text-link"><Pencil size={14} aria-hidden="true" /> Edit mood</Link></div> : <div className="dashboard-empty"><p>How are you feeling right now?</p><Link to="#" className="btn btn-primary"><Plus size={17} aria-hidden="true" /> Log today&apos;s mood</Link></div>}
    </article>
  );
}

export default MoodCard;
