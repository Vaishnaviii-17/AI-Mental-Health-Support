import { motion } from "framer-motion";
import {
  MessageCircle,
  Smile,
  BookOpen,
  Timer,
  Sparkles,
  LifeBuoy,
} from "lucide-react";
import "./Features.css";

const FEATURES = [
  {
    icon: MessageCircle,
    title: "AI Chat",
    desc: "A calm, always-available companion to talk things through, any hour of the day.",
    dark: true,
  },
  {
    icon: Smile,
    title: "Mood Tracker",
    desc: "Log how you feel in seconds and notice patterns forming over weeks and months.",
  },
  {
    icon: BookOpen,
    title: "Daily Journal",
    desc: "A private, guided space to write freely without fear of judgment.",
  },
  {
    icon: Timer,
    title: "Focus Timer",
    desc: "Gentle, distraction-free sessions to help you stay present and grounded.",
  },
  {
    icon: Sparkles,
    title: "AI Insights",
    desc: "Thoughtful reflections drawn from your entries, surfaced only when helpful.",
  },
  {
    icon: LifeBuoy,
    title: "Emergency Resources",
    desc: "Immediate access to trusted helplines and grounding exercises when it matters most.",
  },
];

function Features() {
  return (
    <section id="features" className="features section">
      <div className="container">
        <div className="section-header centered">
          <span className="eyebrow">What MindEase offers</span>
          <h2 className="section-title">Everything you need to feel steadier</h2>
          <p className="section-desc">
            Six simple tools, built to work together quietly in the background
            of your day.
          </p>
        </div>

        <div className="features__grid">
          {FEATURES.map((feature, i) => (
            <motion.article
              key={feature.title}
              className={`features__card ${feature.dark ? "features__card--dark" : ""}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
            >
              <span className="features__icon" aria-hidden="true">
                <feature.icon size={22} strokeWidth={1.8} />
              </span>
              <h3 className="features__title">{feature.title}</h3>
              <p className="features__desc">{feature.desc}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Features;
