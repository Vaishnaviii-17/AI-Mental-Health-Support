import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, KeyRound, AlertTriangle, LogOut, Loader2, Save,
  Trash2, X, CheckCircle, Eye, EyeOff, ShieldCheck
} from "lucide-react";
import Navbar from "../components/Navbar/Navbar";
import { getProfile, updateProfile, changePassword, deleteAccount } from "../services/profileService";
import "./Profile.css";

function getPasswordStrength(pwd) {
  if (!pwd) return { level: 0, label: "" };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { level: 1, label: "Weak" };
  if (score <= 2) return { level: 2, label: "Fair" };
  if (score <= 3) return { level: 3, label: "Good" };
  return { level: 4, label: "Strong" };
}

function ProfilePage() {
  const navigate = useNavigate();

  // Profile loading and form state
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", email: "" });

  // Password state
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Modal / message state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "", section: "" });
  const [fieldErrors, setFieldErrors] = useState({});

  const clearMessage = () => setMessage({ type: "", text: "", section: "" });

  const showMsg = (type, text, section = "global") => {
    setMessage({ type, text, section });
    if (type === "success") {
      setTimeout(clearMessage, 4500);
    }
  };

  const loadProfile = useCallback(async () => {
    setLoading(true);
    clearMessage();
    try {
      const data = await getProfile();
      setProfile(data);
      setProfileForm({
        name: data.fullName || data.username || "",
        email: data.email || ""
      });
      // Sync localStorage
      const localUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (localUser.username !== data.username) {
        localUser.username = data.username;
        localStorage.setItem("user", JSON.stringify(localUser));
      }
    } catch (err) {
      console.error("Error loading profile", err);
      showMsg("error", "Failed to load your profile details. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
    // Clear specific field error on typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateProfileForm = () => {
    const errors = {};
    if (!profileForm.name.trim()) {
      errors.name = "Full name cannot be empty.";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!profileForm.email.trim() || !emailRegex.test(profileForm.email)) {
      errors.email = "Please enter a valid email address.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePasswordForm = () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    const errors = {};
    if (!currentPassword) errors.currentPassword = "Current password is required.";
    if (!newPassword) errors.newPassword = "New password is required.";
    else if (newPassword.length < 8) errors.newPassword = "New password must be at least 8 characters.";
    if (!confirmPassword) errors.confirmPassword = "Please confirm your new password.";
    else if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!validateProfileForm()) return;

    setUpdatingProfile(true);
    clearMessage();
    try {
      const updated = await updateProfile({
        name: profileForm.name.trim(),
        email: profileForm.email.trim()
      });
      setProfile(updated);
      showMsg("success", "Profile details updated successfully.", "details");
    } catch (err) {
      console.error("Error updating profile", err);
      showMsg("error", err.response?.data?.message || "Failed to update profile.", "details");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!validatePasswordForm()) return;

    const { currentPassword, newPassword } = passwordForm;
    setChangingPassword(true);
    clearMessage();
    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showMsg("success", "Password changed successfully.", "password");
    } catch (err) {
      console.error("Error changing password", err);
      showMsg("error", err.response?.data?.message || "Failed to change password. Please check your current password.", "password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    clearMessage();
    try {
      await deleteAccount();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/");
    } catch (err) {
      console.error("Error deleting account", err);
      showMsg("error", err.response?.data?.message || "Failed to delete account.");
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  const userInitial = profile?.fullName?.charAt(0)?.toUpperCase()
    || profile?.username?.charAt(0)?.toUpperCase()
    || "M";

  const pwStrength = getPasswordStrength(passwordForm.newPassword);

  const toggleShowPassword = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <>
      <Navbar profile={profile} />
      <main id="profile-page" className="profile-page">
        <div className="container">
          {/* Header */}
          <header className="profile-header">
            <span className="eyebrow">Your space</span>
            <h1>Profile</h1>
            <p className="profile-subtitle">Manage your personal settings, password and account.</p>
          </header>

          {/* Global Feedback Message */}
          {message.text && message.section === "global" && (
            <div className={`profile-alert profile-alert--${message.type}`} role="alert">
              {message.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
              <span>{message.text}</span>
            </div>
          )}

          {loading ? (
            <div className="profile-loading-state">
              <Loader2 className="spinner-icon" />
              <p>Fetching profile details...</p>
            </div>
          ) : (
            <div className="profile-grid">
              {/* Left Column: Avatar Card & Logout */}
              <section className="profile-sidebar-column">
                <div className="dashboard-card profile-avatar-card">
                  <div className="profile-big-avatar">{userInitial}</div>
                  <h2>{profile?.fullName || profile?.username}</h2>
                  <p className="profile-email-display">{profile?.email}</p>
                  <p className="profile-member-date">Member since {formatDate(profile?.memberSince)}</p>

                  <button type="button" className="btn btn-ghost profile-logout-btn" onClick={handleLogout}>
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </section>

              {/* Right Column: Edit Forms & Danger Zone */}
              <section className="profile-content-column">
                {/* Personal Details Form */}
                <div className="dashboard-card">
                  <div className="dashboard-card__heading">
                    <div>
                      <span className="eyebrow">Personal Details</span>
                      <h2>Profile details</h2>
                    </div>
                    <User size={20} className="profile-card-icon" />
                  </div>

                  {/* Section-level message */}
                  {message.text && message.section === "details" && (
                    <div className={`profile-section-alert profile-alert--${message.type}`} role="alert">
                      {message.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                      <span>{message.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleUpdateProfile} className="profile-form" noValidate>
                    <div className={`field ${fieldErrors.name ? "field--error" : ""}`}>
                      <label htmlFor="name">Full Name</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        placeholder="Enter your full name"
                        value={profileForm.name}
                        onChange={handleProfileChange}
                        aria-describedby={fieldErrors.name ? "name-error" : undefined}
                      />
                      {fieldErrors.name && (
                        <p className="field-error-msg" id="name-error">{fieldErrors.name}</p>
                      )}
                    </div>

                    <div className={`field ${fieldErrors.email ? "field--error" : ""}`}>
                      <label htmlFor="email">Email Address</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        placeholder="you@example.com"
                        value={profileForm.email}
                        onChange={handleProfileChange}
                        aria-describedby={fieldErrors.email ? "email-error" : undefined}
                      />
                      {fieldErrors.email && (
                        <p className="field-error-msg" id="email-error">{fieldErrors.email}</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary profile-submit-btn"
                      disabled={updatingProfile}
                    >
                      {updatingProfile ? (
                        <Loader2 size={16} className="btn-spinner" />
                      ) : (
                        <Save size={16} />
                      )}
                      {updatingProfile ? "Saving..." : "Save Changes"}
                    </button>
                  </form>
                </div>

                {/* Change Password Form */}
                <div className="dashboard-card">
                  <div className="dashboard-card__heading">
                    <div>
                      <span className="eyebrow">Security</span>
                      <h2>Change password</h2>
                    </div>
                    <ShieldCheck size={20} className="profile-card-icon" />
                  </div>

                  {message.text && message.section === "password" && (
                    <div className={`profile-section-alert profile-alert--${message.type}`} role="alert">
                      {message.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                      <span>{message.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} className="profile-form" noValidate>
                    {/* Current Password */}
                    <div className={`field ${fieldErrors.currentPassword ? "field--error" : ""}`}>
                      <label htmlFor="currentPassword">Current Password</label>
                      <div className="input-with-toggle">
                        <input
                          type={showPasswords.current ? "text" : "password"}
                          id="currentPassword"
                          name="currentPassword"
                          placeholder="Enter current password"
                          value={passwordForm.currentPassword}
                          onChange={handlePasswordChange}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => toggleShowPassword("current")}
                          aria-label={showPasswords.current ? "Hide password" : "Show password"}
                        >
                          {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {fieldErrors.currentPassword && (
                        <p className="field-error-msg">{fieldErrors.currentPassword}</p>
                      )}
                    </div>

                    {/* New Password */}
                    <div className={`field ${fieldErrors.newPassword ? "field--error" : ""}`}>
                      <label htmlFor="newPassword">New Password</label>
                      <div className="input-with-toggle">
                        <input
                          type={showPasswords.new ? "text" : "password"}
                          id="newPassword"
                          name="newPassword"
                          placeholder="At least 8 characters"
                          value={passwordForm.newPassword}
                          onChange={handlePasswordChange}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => toggleShowPassword("new")}
                          aria-label={showPasswords.new ? "Hide password" : "Show password"}
                        >
                          {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {/* Password Strength Indicator */}
                      {passwordForm.newPassword && (
                        <div className="password-strength-bar">
                          <div className={`strength-segments strength-level-${pwStrength.level}`}>
                            <span /><span /><span /><span />
                          </div>
                          <span className={`strength-label strength-label-${pwStrength.level}`}>
                            {pwStrength.label}
                          </span>
                        </div>
                      )}
                      {fieldErrors.newPassword && (
                        <p className="field-error-msg">{fieldErrors.newPassword}</p>
                      )}
                    </div>

                    {/* Confirm New Password */}
                    <div className={`field ${fieldErrors.confirmPassword ? "field--error" : ""}`}>
                      <label htmlFor="confirmPassword">Confirm New Password</label>
                      <div className="input-with-toggle">
                        <input
                          type={showPasswords.confirm ? "text" : "password"}
                          id="confirmPassword"
                          name="confirmPassword"
                          placeholder="Re-enter new password"
                          value={passwordForm.confirmPassword}
                          onChange={handlePasswordChange}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => toggleShowPassword("confirm")}
                          aria-label={showPasswords.confirm ? "Hide password" : "Show password"}
                        >
                          {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {fieldErrors.confirmPassword && (
                        <p className="field-error-msg">{fieldErrors.confirmPassword}</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary profile-submit-btn"
                      disabled={changingPassword}
                    >
                      {changingPassword ? (
                        <Loader2 size={16} className="btn-spinner" />
                      ) : (
                        <KeyRound size={16} />
                      )}
                      {changingPassword ? "Updating..." : "Change Password"}
                    </button>
                  </form>
                </div>

                {/* Danger Zone */}
                <div className="dashboard-card profile-danger-card">
                  <div className="dashboard-card__heading">
                    <div>
                      <span className="eyebrow eyebrow-danger">Danger Zone</span>
                      <h2>Delete account</h2>
                    </div>
                    <AlertTriangle size={20} className="profile-card-icon-danger" />
                  </div>
                  <p className="danger-explanation">
                    Permanently delete your MindEase account and erase all of your data — journals, chats, mood history and settings. This action is <strong>permanent</strong> and cannot be undone.
                  </p>
                  <button
                    type="button"
                    className="btn profile-delete-trigger-btn"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    <Trash2 size={16} />
                    Delete Account
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="profile-modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
            <motion.div
              className="profile-modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.22 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="profile-modal-close"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                aria-label="Close"
              >
                <X size={20} />
              </button>

              <div className="delete-modal-content">
                <div className="danger-icon-large">
                  <AlertTriangle size={32} />
                </div>
                <h2>Delete your account?</h2>
                <p>
                  Are you absolutely sure? This will permanently erase all your journals, chats, mood history and login credentials.
                </p>
                <p className="danger-warning-subtitle">This operation cannot be undone.</p>

                <div className="delete-modal-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn delete-confirm-btn"
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <>
                        <Loader2 size={16} className="btn-spinner" />
                        Deleting...
                      </>
                    ) : (
                      "Yes, delete permanently"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ProfilePage;
