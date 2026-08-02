import { useEffect, useRef, useState } from "react";
import { motion, useInView, animate } from "framer-motion";
import "./Stats.css";

const STATS = [
  { value: 50, suffix: "K+", label: "Users" },
  { value: 2.3, suffix: "M+", label: "Mood Entries", decimals: 1 },
  { value: 98, suffix: "%", label: "Anonymous" },
  { value: 24, suffix: "/7", label: "AI Support" },
];

function CountUp({ value, suffix, decimals = 0 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [display, setDisplay] = useState(decimals ? "0.0" : "0");

  useEffect(() => {
    if (!isInView) return undefined;
    const controls = animate(0, value, {
      duration: 1.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        setDisplay(latest.toFixed(decimals));
      },
    });
    return () => controls.stop();
  }, [isInView, value, decimals]);

  return (
    <span ref={ref} className="stats__number">
      {display}
      {suffix}
    </span>
  );
}

function Stats() {
  return (
    <section className="stats" aria-label="MindEase impact statistics">
      <div className="container stats__grid">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="stats__item"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <CountUp value={stat.value} suffix={stat.suffix} decimals={stat.decimals} />
            <span className="stats__label">{stat.label}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export default Stats;
