import { ArrowRight, BookOpen } from "lucide-react";

function JournalPreview({ journals = [] }) {
  return <article id="recent-journals" className="dashboard-card dashboard-journals" aria-labelledby="recent-journals-title"><div className="dashboard-card__heading"><div><span className="eyebrow">Your private space</span><h2 id="recent-journals-title">Recent journals</h2></div><BookOpen size={22} aria-hidden="true" /></div>{journals.length ? <div className="dashboard-journals__list">{journals.slice(0, 2).map((journal) => <article className="dashboard-journal" key={journal.id}><span className="dashboard-journal__emoji" aria-hidden="true">{journal.mood}</span><div><div className="dashboard-journal__topline"><h3>{journal.title}</h3><time>{journal.date}</time></div><p>{journal.preview}</p><a href="#recent-journals" className="dashboard-text-link">Read more <ArrowRight size={14} aria-hidden="true" /></a></div></article>)}</div> : <div className="dashboard-empty"><p>Your reflections will appear here when you&apos;re ready.</p></div>}<a href="#recent-journals" className="dashboard-view-all">View all journals <ArrowRight size={15} aria-hidden="true" /></a></article>;
}

export default JournalPreview;
