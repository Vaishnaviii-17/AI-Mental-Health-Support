import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen,
  MessageCircleHeart,
  Smile,
  Timer,
  Sparkles,
} from "lucide-react";

const ACTIONS = [
  {
    label: "Chat with AI",
    description: "Talk it through",
    icon: MessageCircleHeart,
    href: "/chat",
    isRouter: true,
    dark: true,
  },
  { label: "Journal", description: "Write freely", icon: BookOpen, href: "/journal", isRouter: true },
  { label: "Activities", description: "Find a pause", icon: Sparkles, href: "#recommendation", isRouter: false },
  { label: "Focus timer", description: "Be present", icon: Timer, href: "/focus-timer", isRouter: true },
];

function QuickActions() {
  return (
    <section
      id="quick-actions"
      className="dashboard-section"
      aria-labelledby="quick-actions-title"
    >
      <div className="dashboard-section__heading">
        <div>
          <span className="eyebrow">One small step</span>
          <h2 id="quick-actions-title">Quick actions</h2>
        </div>
      </div>
      <div className="dashboard-quick-actions">
        {ACTIONS.map((action, index) => {
          const Tag = action.isRouter ? Link : "a";
          const motionProps = {
            initial: { opacity: 0, y: 14 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.4, delay: index * 0.05 },
            whileHover: { y: -5 },
          };
          
          if (action.isRouter) {
            const MotionLink = motion(Link);
            return (
              <MotionLink
                to={action.href}
                key={action.label}
                className={`dashboard-quick-action ${action.dark ? "dashboard-quick-action--dark" : ""}`}
                {...motionProps}
              >
                <span>
                  <action.icon size={21} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <strong>{action.label}</strong>
                <small>{action.description}</small>
              </MotionLink>
            );
          } else {
            const MotionAnchor = motion.a;
            return (
              <MotionAnchor
                href={action.href}
                key={action.label}
                className={`dashboard-quick-action ${action.dark ? "dashboard-quick-action--dark" : ""}`}
                {...motionProps}
              >
                <span>
                  <action.icon size={21} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <strong>{action.label}</strong>
                <small>{action.description}</small>
              </MotionAnchor>
            );
          }
        })}
      </div>
    </section>
  );
}

export default QuickActions;
