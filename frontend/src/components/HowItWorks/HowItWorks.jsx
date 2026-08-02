import { motion } from "framer-motion";
import { UserPlus, MessageSquareHeart, LineChart, Sprout, Sparkle } from "lucide-react";
import "./HowItWorks.css";

const STEPS = [
  {
    icon: UserPlus,
    title: "Create account",
    desc: "Sign up anonymously in seconds — no email required.",
  },
  {
    icon: MessageSquareHeart,
    title: "Talk with AI",
    desc: "Share what's on your mind with a companion that only listens.",
  },
  {
    icon: LineChart,
    title: "Track moods",
    desc: "Watch small daily check-ins turn into a clearer picture over time.",
  },
  {
    icon: Sprout,
    title: "Improve gradually",
    desc: "Build gentle habits that support how you feel, one day at a time.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="how section">
      <div className="container how__inner">
        <div className="how__timeline-col">
          <div className="section-header">
            <span className="eyebrow">The process</span>
            <h2 className="section-title">A gentle path forward</h2>
            <p className="section-desc">
              Four simple steps, designed to fit quietly into your day.
            </p>
          </div>

          <ol className="how__timeline">
            {STEPS.map((step, i) => (
              <motion.li
                key={step.title}
                className="how__step"
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="how__step-marker">
                  <step.icon size={18} aria-hidden="true" />
                </span>
                <div className="how__step-body">
                  <p className="how__step-label">Step {i + 1}</p>
                  <h3 className="how__step-title">{step.title}</h3>
                  <p className="how__step-desc">{step.desc}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>

        <motion.div
          className="how__illustration"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="how__illustration-shape">
            <Sprout size={72} strokeWidth={1} aria-hidden="true" />
          </div>
          <motion.div
            className="how__badge"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkle size={14} aria-hidden="true" />
            <span>Progress: Day 12</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

export default HowItWorks;
