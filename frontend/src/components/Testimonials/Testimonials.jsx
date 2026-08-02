import { motion } from "framer-motion";
import { Star, User } from "lucide-react";
import "./Testimonials.css";

const TESTIMONIALS = [
  {
    name: "Amara Chen",
    role: "Graduate Student",
    stars: 5,
    review:
      "Journaling used to feel like a chore. MindEase made it feel like a small daily gift I give myself instead.",
  },
  {
    name: "Rohan Iyer",
    role: "Software Engineer",
    stars: 5,
    review:
      "The AI chat doesn't try to fix everything — it just listens. That alone has helped me unwind after long weeks.",
  },
  {
    name: "Naledi Botha",
    role: "Nurse",
    stars: 5,
    review:
      "Tracking my mood between shifts showed me patterns I never noticed. It's quietly become part of my routine.",
  },
];

function Testimonials() {
  return (
    <section id="testimonials" className="testimonials section">
      <div className="container">
        <div className="section-header centered">
          <span className="eyebrow">Stories from our community</span>
          <h2 className="section-title">Loved by people who needed a moment</h2>
        </div>

        <div className="testimonials__grid">
          {TESTIMONIALS.map((t, i) => (
            <motion.article
              key={t.name}
              className="testimonials__card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -8 }}
            >
              <div className="testimonials__stars" aria-label={`${t.stars} out of 5 stars`}>
                {Array.from({ length: t.stars }).map((_, idx) => (
                  <Star key={idx} size={14} fill="currentColor" aria-hidden="true" />
                ))}
              </div>
              <p className="testimonials__review">&ldquo;{t.review}&rdquo;</p>
              <div className="testimonials__person">
                <span className="testimonials__avatar" aria-hidden="true">
                  <User size={18} />
                </span>
                <div>
                  <p className="testimonials__name">{t.name}</p>
                  <p className="testimonials__role">{t.role}</p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Testimonials;
