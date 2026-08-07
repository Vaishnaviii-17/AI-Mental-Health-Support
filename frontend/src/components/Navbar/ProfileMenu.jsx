import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  LogOut,
  Settings,
  Shield,
  User,
  UserRound,
} from "lucide-react";
import "./ProfileMenu.css";

function ProfileMenu({ profile }) {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  const menuRef = useRef(null);

  const avatarInitial =
    profile?.username?.charAt(0)?.toUpperCase() || "M";

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    function handleEscape(e) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/");
  }

  return (
    <div className="profile-menu" ref={menuRef}>
      <button
        className="profile-menu__trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="profile-menu__avatar">
          {profile?.username ? (
            avatarInitial
          ) : (
            <UserRound size={18} />
          )}
        </span>

        <ChevronDown
          size={16}
          className={`profile-menu__arrow ${
            open ? "profile-menu__arrow--open" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="profile-menu__dropdown"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{
              duration: 0.22,
            }}
          >
            <div className="profile-menu__header">
              <div className="profile-menu__avatar profile-menu__avatar--large">
                {avatarInitial}
              </div>

              <div>
                <h4>{profile?.username || "MindEase User"}</h4>

                <p>Anonymous Account</p>
              </div>
            </div>

            <div className="profile-menu__divider" />

            <button className="profile-menu__item">
              <User size={18} />
              <span>Profile</span>
            </button>

            <button className="profile-menu__item">
              <Settings size={18} />
              <span>Settings</span>
            </button>

            <button className="profile-menu__item">
              <Shield size={18} />
              <span>Privacy</span>
            </button>

            <div className="profile-menu__divider" />

            <button
              className="profile-menu__item profile-menu__logout"
              onClick={handleLogout}
            >
              <LogOut size={18} />

              <span>Logout</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProfileMenu;