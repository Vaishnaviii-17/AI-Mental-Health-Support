import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Leaf } from "lucide-react";
import "./AuthCard.css";

/**
 * Shared centered card shell for AuthChoice, Login and Signup pages.
 * `panelTitle` / `panelDesc` populate the decorative dark side panel.
 */
function AuthCard({ children, panelTitle, panelDesc, wide = false }) {
  return (
    <div className="auth-screen">
      <div className={`auth-card ${wide ? "auth-card--wide" : ""}`}>
        <motion.div
          className="auth-card__panel"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link to="/" className="auth-card__logo">
            <span className="auth-card__logo-icon">
              <Leaf size={18} aria-hidden="true" />
            </span>
            MindEase
          </Link>
          <h1 className="auth-card__panel-title">{panelTitle}</h1>
          <p className="auth-card__panel-desc">{panelDesc}</p>

          <div className="auth-card__quote">
            <p>
              &ldquo;A quiet space that finally felt like it was built for
              me.&rdquo;
            </p>
            <span>— A MindEase user</span>
          </div>
        </motion.div>

        <motion.div
          className="auth-card__content"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

export default AuthCard;
