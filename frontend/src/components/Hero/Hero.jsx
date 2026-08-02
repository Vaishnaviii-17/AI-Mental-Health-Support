import { motion } from "framer-motion";
import { ArrowRight, Info, Star, Smile, BookOpen, MessageCircle } from "lucide-react";
import "./Hero.css";

const AVATAR_COLORS = ["#c9a66b", "#2f6b52", "#8a6d3b", "#1b4332"];

function Hero() {
  return (
    <section id="home" className="hero" aria-label="Introduction">
      <div className="container hero__inner">
        <motion.div
          className="hero__content"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="eyebrow eyebrow--light">AI Mental Health Support</span>

          <h1 className="hero__heading">
            Feel heard.
            <br />
            Heal slowly.
            <br />
            <span className="hero__heading-accent">At your pace.</span>
          </h1>

          <p className="hero__desc">
            MindEase pairs a gentle AI companion with mood tracking and daily
            journaling, so support is always within reach — private,
            judgment-free, and built around how you actually feel.
          </p>

          <div className="hero__buttons">
            <a href="/auth" className="btn btn-gold">
              Get Started <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a href="#how-it-works" className="btn btn-ghost-light">
              <Info size={18} aria-hidden="true" /> Learn More
            </a>
          </div>

          <div className="hero__social-proof">
            <div className="hero__avatars" aria-hidden="true">
              {AVATAR_COLORS.map((color, i) => (
                <span
                  key={color}
                  className="hero__avatar"
                  style={{ background: color, zIndex: AVATAR_COLORS.length - i }}
                />
              ))}
            </div>
            <div className="hero__social-text">
              <div className="hero__rating">
                <Star size={14} fill="currentColor" aria-hidden="true" />
                <span>4.9 rating</span>
              </div>
              <span className="hero__users">Trusted by 50,000+ users</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="hero__visual"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        >
          <div className="hero__image-frame">
            <div className="hero__image-glow" aria-hidden="true" />
            <div className="hero__image" role="img" aria-label="Person journaling peacefully with a warm cup of tea">
              <Smile size={64} strokeWidth={1.2} aria-hidden="true" />
            </div>

            <motion.div
              className="hero__float hero__float--mood"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="hero__float-icon hero__float-icon--sage">
                <Smile size={16} aria-hidden="true" />
              </span>
              <div>
                <p className="hero__float-title">Today's Mood</p>
                <p className="hero__float-sub">Calm &amp; Grateful</p>
              </div>
            </motion.div>

            <motion.div
              className="hero__float hero__float--journal"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            >
              <span className="hero__float-icon hero__float-icon--gold">
                <BookOpen size={16} aria-hidden="true" />
              </span>
              <div>
                <p className="hero__float-title">Journal Saved</p>
                <p className="hero__float-sub">2 minutes ago</p>
              </div>
            </motion.div>

            <motion.div
              className="hero__float hero__float--chat"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
            >
              <span className="hero__float-icon hero__float-icon--forest">
                <MessageCircle size={16} aria-hidden="true" />
              </span>
              <div>
                <p className="hero__float-title">AI Chat Active</p>
                <p className="hero__float-sub">Listening quietly</p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default Hero;
