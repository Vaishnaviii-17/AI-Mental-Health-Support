import { motion } from "framer-motion";
import {
  Smile,
  BookOpen,
  MessageCircleHeart,
  Flame,
} from "lucide-react";

const ICONS = {
  mood: {
    icon: Smile,
    bg: "#FFF8E6",
    color: "#C88A12",
  },
  journal: {
    icon: BookOpen,
    bg: "#F4F0FF",
    color: "#7A5AF8",
  },
  chat: {
    icon: MessageCircleHeart,
    bg: "#EDF7FF",
    color: "#2563EB",
  },
  streak: {
    icon: Flame,
    bg: "#FFF2EC",
    color: "#D97745",
  },
};

function SummaryCards({ summary = [] }) {
  return (
    <section
      className="dashboard-section"
      aria-labelledby="summary-title"
    >
      <div className="dashboard-section__heading">
        <div>
          <span className="eyebrow">
            Your Progress
          </span>

          <h2 id="summary-title">
            A snapshot of your wellness journey
          </h2>
        </div>
      </div>

      <div className="dashboard-summary-grid">
        {summary.map((item, index) => {
          const config = ICONS[item.icon];
          const Icon = config.icon;

          return (
            <motion.article
              key={item.label}
              className="dashboard-summary-card"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: index * 0.07,
              }}
              whileHover={{
                y: -4,
              }}
            >
              <div
                className="dashboard-summary-icon"
                style={{
                  background: config.bg,
                  color: config.color,
                }}
              >
                <Icon size={20} />
              </div>

              <strong>{item.value}</strong>

              <h3>{item.label}</h3>

              <small>{item.detail}</small>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

export default SummaryCards;