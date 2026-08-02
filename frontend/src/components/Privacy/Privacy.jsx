import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import "./Privacy.css";

const GUARANTEES = [
  "Anonymous login",
  "Encrypted journal",
  "Secure authentication",
  "Private conversations",
  "No email required",
];

function Privacy() {
  return (
    <section id="privacy" className="privacy section section-dark">
      <div className="container privacy__inner">
        <div className="privacy__content">
          <span className="eyebrow eyebrow--light">Built on trust</span>
          <h2 className="section-title">Your privacy matters.</h2>
          <p className="section-desc">
            Every part of MindEase is designed so you can be honest without
            being exposed.
          </p>

          <ul className="privacy__list">
            {GUARANTEES.map((item, i) => (
              <motion.li
                key={item}
                className="privacy__item"
                initial={{ opacity: 0, x: -14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              >
                <CheckCircle2 size={20} aria-hidden="true" />
                <span>{item}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <motion.div
          className="privacy__illustration"
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="privacy__shape">
            <ShieldCheck size={80} strokeWidth={1} aria-hidden="true" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default Privacy;
