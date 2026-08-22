import { Link } from "react-router-dom";
import { ArrowRight, Clock3, Wind } from "lucide-react";

function RecommendationCard({ recommendation }) {
  if (!recommendation) return null;
  return <article id="recommendation" className="dashboard-recommendation" aria-labelledby="recommendation-title"><div className="dashboard-recommendation__content"><span className="eyebrow eyebrow--light">Today&apos;s recommendation</span><h2 id="recommendation-title">{recommendation.title}</h2><p>{recommendation.description}</p><span className="dashboard-recommendation__duration"><Clock3 size={16} aria-hidden="true" /> {recommendation.duration} · {recommendation.type}</span><Link to="/activities" className="btn btn-gold">Start activity <ArrowRight size={17} aria-hidden="true" /></Link></div><div className="dashboard-recommendation__visual" role="img" aria-label="Soft moving air illustration"><Wind size={72} strokeWidth={1} aria-hidden="true" /><span /><span /><span /></div></article>;
}

export default RecommendationCard;
