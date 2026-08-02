import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Globe, UserRound, ArrowRight, Clock } from "lucide-react";
import AuthCard from "../components/AuthCard/AuthCard";
import "./AuthChoice.css";

function AuthChoice() {
  const navigate = useNavigate();

  return (
    <AuthCard
      wide
      panelTitle="Welcome back to a calmer place."
      panelDesc="Choose how you'd like to continue. Everything here stays private, always."
    >
      <div className="auth-choice">
        <h2 className="auth-choice__title">How would you like to continue?</h2>
        <p className="auth-choice__subtitle">
          Pick the option that feels right for you today.
        </p>

        <div className="auth-choice__options">
          <motion.button
            type="button"
            className="auth-choice__card"
            disabled
            aria-disabled="true"
          >
            <span className="auth-choice__icon">
              <Globe size={26} aria-hidden="true" />
            </span>
            <div className="auth-choice__card-text">
              <h3>Continue with Google</h3>
              <p>Sign in quickly with your Google account.</p>
            </div>
            <span className="auth-choice__badge">
              <Clock size={12} aria-hidden="true" /> Coming Soon
            </span>
          </motion.button>

          <motion.button
            type="button"
            className="auth-choice__card auth-choice__card--active"
            onClick={() => navigate("/login")}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="auth-choice__icon auth-choice__icon--dark">
              <UserRound size={26} aria-hidden="true" />
            </span>
            <div className="auth-choice__card-text">
              <h3>Continue Anonymously</h3>
              <p>No email, no personal details — just a private space.</p>
            </div>
            <span className="auth-choice__arrow">
              <ArrowRight size={20} aria-hidden="true" />
            </span>
          </motion.button>
        </div>
      </div>
    </AuthCard>
  );
}

export default AuthChoice;
