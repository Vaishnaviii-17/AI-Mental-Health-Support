import { useEffect, useState, useCallback } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Leaf, Menu, UserRound, X } from "lucide-react";
import ProfileMenu from "./ProfileMenu";
import "./Navbar.css";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "Privacy", href: "#privacy" },
];

const DASHBOARD_LINKS = [
  { label: "Dashboard", href: "#dashboard" },
  { label: "Mood", href: "#today-mood" },
  { label: "Journal", href: "#recent-journals" },
  { label: "Activities", href: "#recommendation" },
  { label: "AI Chat", href: "#quick-actions" },
  { label: "Profile", href: "#profile" },
];

function Navbar({ profile }) {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isDashboard = location.pathname === "/dashboard";
  const links = isDashboard ? DASHBOARD_LINKS : NAV_LINKS;
  const avatarInitial = profile?.username?.charAt(0)?.toUpperCase() || "M";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <header className={`navbar ${scrolled ? "navbar--scrolled" : ""}`}>
      <div className="container navbar__inner">
        <Link to="/" className="navbar__logo" aria-label="MindEase — Home">
          <span className="navbar__logo-icon">
            <Leaf size={20} strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="navbar__logo-text">MindEase</span>
        </Link>

        <nav className="navbar__links" aria-label="Primary navigation">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="navbar__link">
              {link.label}
            </a>
          ))}
        </nav>

        {isDashboard ? (
          <div className="navbar__actions navbar__actions--dashboard">
            <button
              type="button"
              className="navbar__notification"
              aria-label="View notifications"
            >
              <Bell size={19} aria-hidden="true" />
              <span className="navbar__notification-dot" aria-hidden="true" />
            </button>
            <ProfileMenu profile={profile} />
          </div>
        ) : (
          <div className="navbar__actions">
            <NavLink to="/login" className="navbar__login">
              Login
            </NavLink>
            <NavLink to="/auth" className="btn btn-primary navbar__cta">
              Get Started
            </NavLink>
          </div>
        )}

        <button
          type="button"
          className="navbar__hamburger"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-menu"
            className="navbar__mobile"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <nav
              className="navbar__mobile-links"
              aria-label="Mobile navigation"
            >
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="navbar__mobile-link"
                  onClick={closeMenu}
                >
                  {link.label}
                </a>
              ))}
              {isDashboard ? (
                <div className="navbar__mobile-profile">
                  <span className="navbar__avatar" aria-hidden="true">{avatarInitial}</span>
                  <span>{profile?.username || "MindEase member"}</span>
                </div>
              ) : (
                <div className="navbar__mobile-actions">
                  <NavLink
                    to="/login"
                    className="btn btn-ghost"
                    onClick={closeMenu}
                  >
                    Login
                  </NavLink>
                  <NavLink
                    to="/auth"
                    className="btn btn-primary"
                    onClick={closeMenu}
                  >
                    Get Started
                  </NavLink>
                </div>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default Navbar;
