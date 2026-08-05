import { Quote } from "lucide-react";

function QuoteCard({ quote }) {
  if (!quote) return null;
  return <article className="dashboard-quote" aria-labelledby="daily-quote-title"><Quote size={28} strokeWidth={1.4} aria-hidden="true" /><div><span className="eyebrow">A thought for today</span><h2 id="daily-quote-title">&ldquo;{quote.text}&rdquo;</h2><p>— {quote.author}</p></div></article>;
}

export default QuoteCard;
