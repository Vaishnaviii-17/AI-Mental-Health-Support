import { motion } from "framer-motion";
import { ArrowRight, Compass } from "lucide-react";
import "./CTA.css";

function CTA() {
  return (
    <section className="cta section">
      <div className="container">
        <motion.div
          className="cta__box"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="cta__title">Ready to begin your healing journey?</h2>
          <p className="cta__desc">
            It takes less than a minute to start — no email, no pressure,
            just you and a calmer place to land.
          </p>
          <div className="cta__buttons">
            <a href="/auth" className="btn btn-gold">
              Create Account <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a href="#features" className="btn btn-ghost-light">
              <Compass size={18} aria-hidden="true" /> Explore Features
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default CTA;
