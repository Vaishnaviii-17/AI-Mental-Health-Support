import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Calendar, Trash2, X, AlertCircle, Smile, Search, Filter, ArrowUpDown, ChevronDown, ShieldAlert } from "lucide-react";
import Navbar from "../components/Navbar/Navbar";
import { getJournals, createJournal, deleteJournal } from "../services/journalService";
import "./Journal.css";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

// Turn a GoEmotions probability (0-1) into a display percentage
// string. Handles null/undefined safely (the dominant emotion's
// probability can be null for the controlled "no trained neutral
// label" fallback -- see predictor.py).
function formatEmotionPercent(probability) {
  if (probability === null || probability === undefined || Number.isNaN(Number(probability))) {
    return null;
  }
  return `${(Number(probability) * 100).toFixed(1)}%`;
}

// Consistent display label for any GoEmotions emotion (or the
// "neutral" sentinel). Missing/empty emotion and the literal
// "neutral" label both render as "Neutral" -- never "Unknown".
function displayEmotionLabel(emotion) {
  if (!emotion) return "Neutral";
  if (emotion === "neutral") return "Neutral";
  return emotion.charAt(0).toUpperCase() + emotion.slice(1);
}

// ---------------------------------------------------------------
// RISK SCREENING DISPLAY HELPERS
// ---------------------------------------------------------------
// Risk screening is a heuristic indicator computed by the trained
// GoEmotions model + regex text patterns in predictor.py -- it is
// NEVER a clinical assessment or diagnosis. All copy below is
// written to reflect that: "Risk screening", "heuristic screening
// indicator", never "you are suicidal" / "you have depression".
// ---------------------------------------------------------------

const RISK_LEVEL_DISPLAY = {
  low: { label: "Low", tone: "low" },
  elevated: { label: "Elevated", tone: "elevated" },
  high: { label: "High", tone: "high" },
  critical: { label: "Critical", tone: "critical" },
};

// Human-readable labels for risk categories from predictor.py's
// RISK_PATTERNS -- raw category keys / regex patterns are never
// shown to the user.
const RISK_CATEGORY_LABELS = {
  suicidal_ideation: "Thoughts of not wanting to live",
  self_harm: "Self-harm related language",
  hopelessness: "Hopelessness",
  feeling_trapped: "Feeling trapped",
  severe_distress: "Severe distress",
};

function riskCategoryLabel(category) {
  return RISK_CATEGORY_LABELS[category] || category;
}

function formatRiskPercent(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return null;
  }
  return `${Math.round(Number(score) * 100)}%`;
}

function JournalPage() {
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Form states
  const [form, setForm] = useState({ title: "", content: "" });

  // Search, Filter & Sort states
  const [searchText, setSearchText] = useState("");
  const [emotionFilter, setEmotionFilter] = useState("All");
  const [dateSort, setDateSort] = useState("newest");

  // Pagination
  const [visibleCount, setVisibleCount] = useState(6);

  // Modal / View Entry state
  const [activeJournal, setActiveJournal] = useState(null);

  const storedUser = getStoredUser();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJournals();
      setJournals(data || []);
    } catch (err) {
      console.error("Unable to load journals", err);
      setError("Failed to load your journal entries. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const created = await createJournal({
        title: form.title.trim(),
        content: form.content.trim()
      });

      // The API returns { journal, analysis }. The saved journal row
      // (including the persisted `emotion`, `secondary_emotions`, and
      // `risk_analysis` fields) is what belongs in the list -- not
      // the wrapper object.
      const newEntry = created?.journal || created;

      setJournals((prev) => [newEntry, ...prev]);
      setForm({ title: "", content: "" });
      setSuccess(true);

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving journal entry", err);
      setError(err.response?.data?.message || "Failed to save journal entry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Permanently delete this journal entry?")) return;

    setError(null);
    try {
      await deleteJournal(id);
      setJournals((prev) => prev.filter((j) => j.id !== id));
      if (activeJournal?.id === id) {
        setActiveJournal(null);
      }
    } catch (err) {
      console.error("Error deleting journal entry", err);
      setError(err.response?.data?.message || "Failed to delete journal entry.");
    }
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  // List of unique emotions for filter dropdown. GoEmotions is
  // fine-grained/multi-label, so this is not restricted to any fixed
  // set of emotions -- it simply reflects whatever labels have
  // actually been detected across the user's entries.
  const uniqueEmotions = useMemo(() => {
    const list = new Set();
    journals.forEach(j => {
      if (j.emotion) list.add(j.emotion);
    });
    return ["All", ...Array.from(list)];
  }, [journals]);

  // Process search, filtering, and sorting in memory
  const processedJournals = useMemo(() => {
    let result = [...journals];

    if (searchText.trim()) {
      const term = searchText.toLowerCase();
      result = result.filter(
        j => j.title.toLowerCase().includes(term) || j.content.toLowerCase().includes(term)
      );
    }

    if (emotionFilter !== "All") {
      result = result.filter(j => j.emotion === emotionFilter);
    }

    result.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateSort === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [journals, searchText, emotionFilter, dateSort]);

  const paginatedJournals = useMemo(() => {
    return processedJournals.slice(0, visibleCount);
  }, [processedJournals, visibleCount]);

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 6);
  };

  const characterCount = form.content.length;

  // Secondary emotions for the entry currently open in the modal, if
  // any. Read directly from the API response / stored journal row --
  // never hardcoded.
  const activeSecondaryEmotions = Array.isArray(activeJournal?.secondary_emotions)
    ? activeJournal.secondary_emotions
    : [];

  // Risk screening for the entry currently open in the modal. Older
  // rows saved before the risk_analysis column existed (or before a
  // migration was run) will have risk_analysis = null/undefined --
  // handled safely here so the UI never crashes and simply omits the
  // risk panel for those entries.
  const activeRiskAnalysis =
    activeJournal?.risk_analysis && typeof activeJournal.risk_analysis === "object"
      ? activeJournal.risk_analysis
      : null;

  const activeRiskLevel = activeRiskAnalysis?.risk_level || null;
  const activeRiskDisplay = activeRiskLevel
    ? RISK_LEVEL_DISPLAY[activeRiskLevel] || { label: activeRiskLevel, tone: "low" }
    : null;
  const activeRiskCategories = Array.isArray(activeRiskAnalysis?.detected_risk_categories)
    ? activeRiskAnalysis.detected_risk_categories
    : [];
  const activeProtectiveSignals = Number(activeRiskAnalysis?.protective_text_signals) || 0;
  const activeRiskPercent = formatRiskPercent(activeRiskAnalysis?.risk_score);

  return (
    <>
      <Navbar profile={storedUser} />
      <main id="journal" className="journal-page">
        <div className="container">
          {/* Header */}
          <header className="journal-header">
            <span className="eyebrow">Your private space</span>
            <h1>Journal</h1>
            <p className="journal-subtitle">
              A private space to write, reflect and let your thoughts out.
            </p>
          </header>

          {/* Alert messages */}
          {error && (
            <div className="journal-alert journal-alert--error" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="journal-alert journal-alert--success" role="alert">
              <span>Journal entry saved successfully and analyzed!</span>
            </div>
          )}

          <div className="journal-layout-grid">
            {/* Left side: Create Entry Form */}
            <section className="journal-form-section">
              <div className="dashboard-card compact-card">
                <div className="dashboard-card__heading">
                  <div>
                    <span className="eyebrow">New Entry</span>
                    <h2 className="card-compact-title">How was your day?</h2>
                  </div>
                  <BookOpen size={16} className="journal-icon-title" />
                </div>

                <form onSubmit={handleSave} className="journal-form">
                  <div className="field">
                    <label htmlFor="title">Title</label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      placeholder="Give your entry a title..."
                      value={form.title}
                      onChange={handleChange}
                      maxLength={100}
                      required
                    />
                  </div>

                  <div className="field">
                    <div className="label-row">
                      <label htmlFor="content">Your thoughts</label>
                      <span className="char-counter">{characterCount} characters</span>
                    </div>
                    <textarea
                      id="content"
                      name="content"
                      placeholder="Write freely. Your journal is private and secure..."
                      value={form.content}
                      onChange={handleChange}
                      rows={5}
                      required
                    />
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-compact"
                      onClick={() => setForm({ title: "", content: "" })}
                      disabled={submitting}
                    >
                      Clear
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-compact"
                      disabled={submitting || !form.title.trim() || !form.content.trim()}
                    >
                      {submitting ? "Saving..." : "Save Entry"}
                    </button>
                  </div>
                </form>
              </div>
            </section>

            {/* Right side: Past Reflections History */}
            <section className="journal-list-section">
              <div className="list-header-row">
                <h2 className="section-heading-title">Previous reflections</h2>
                <span className="entries-count">
                  Showing {Math.min(paginatedJournals.length, processedJournals.length)} of {processedJournals.length}
                </span>
              </div>

              {/* Search, Filter, and Sort Controls Panel */}
              <div className="dashboard-card journal-controls-card">
                <div className="controls-search-wrap">
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search reflections..."
                    value={searchText}
                    onChange={(e) => {
                      setSearchText(e.target.value);
                      setVisibleCount(6);
                    }}
                    className="search-input"
                  />
                </div>

                <div className="controls-dropdowns-row">
                  <div className="filter-select-group">
                    <Filter size={12} className="control-icon" />
                    <select
                      value={emotionFilter}
                      onChange={(e) => {
                        setEmotionFilter(e.target.value);
                        setVisibleCount(6);
                      }}
                      className="control-select"
                      aria-label="Filter entries by emotion"
                    >
                      {uniqueEmotions.map(emotion => (
                        <option key={emotion} value={emotion}>
                          {emotion === "All" ? "All Emotions" : displayEmotionLabel(emotion)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="select-arrow" />
                  </div>

                  <div className="sort-select-group">
                    <ArrowUpDown size={12} className="control-icon" />
                    <select
                      value={dateSort}
                      onChange={(e) => setDateSort(e.target.value)}
                      className="control-select"
                      aria-label="Sort entries by date"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                    </select>
                    <ChevronDown size={12} className="select-arrow" />
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="journal-state-container">
                  <div className="loading-spinner" />
                  <p>Opening your journal archive...</p>
                </div>
              ) : paginatedJournals.length === 0 ? (
                <div className="journal-state-container dashboard-card compact-card">
                  <BookOpen size={28} className="empty-state-icon" />
                  <h3>No reflections found</h3>
                  <p>
                    {searchText || emotionFilter !== "All"
                      ? "Try clearing your filters."
                      : "Write your first entry to get started."}
                  </p>
                </div>
              ) : (
                <div className="journals-list-grid">
                  {paginatedJournals.map((journal, index) => {
                    // Compact risk screening indicator, shown for every
                    // level (including Low) so the card always reflects
                    // that entry's actual result -- reusing the SAME
                    // risk_analysis data already returned with each
                    // journal row, never recalculated here. Old/legacy
                    // rows without risk_analysis simply render nothing.
                    const cardRiskLevel = journal?.risk_analysis?.risk_level || null;
                    const cardRiskDisplay = cardRiskLevel
                      ? RISK_LEVEL_DISPLAY[cardRiskLevel] || { label: cardRiskLevel, tone: cardRiskLevel }
                      : null;

                    return (
                      <motion.article
                        key={journal.id}
                        className="dashboard-card journal-card-item"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        onClick={() => setActiveJournal(journal)}
                      >
                        <div className="journal-card-header">
                          <div className="journal-card-title-group">
                            <span className="journal-card-emoji" role="img" aria-label="mood">
                              {journal.mood || "📝"}
                            </span>
                            <div className="journal-card-header-text">
                              <h3>{journal.title}</h3>
                              <time className="journal-card-time">
                                <Calendar size={10} />
                                {formatDate(journal.created_at)}
                              </time>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="journal-delete-btn"
                            onClick={(e) => handleDelete(journal.id, e)}
                            aria-label="Delete journal entry"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Truncated preview limited to 100 characters */}
                        <p className="journal-card-preview">
                          {journal.content.length > 100
                            ? `${journal.content.slice(0, 100)}...`
                            : journal.content}
                        </p>

                        <div className="journal-card-footer">
                          <span className="journal-emotion-badge">
                            {displayEmotionLabel(journal.emotion)}
                          </span>
                          {cardRiskDisplay && (
                            <span
                              className={`journal-risk-badge journal-risk-badge--${cardRiskLevel}`}
                              title="Heuristic screening indicator, not a clinical assessment"
                            >
                              <ShieldAlert size={11} />
                              Risk: {cardRiskDisplay.label}
                            </span>
                          )}
                          <span className="journal-read-link">
                            View &rarr;
                          </span>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              )}

              {/* Load More Pagination Button */}
              {processedJournals.length > paginatedJournals.length && (
                <button
                  type="button"
                  className="btn btn-ghost load-more-btn"
                  onClick={handleLoadMore}
                >
                  Load More Reflections
                </button>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* Interactive Modal to view full details */}
      <AnimatePresence>
        {activeJournal && (
          <div className="journal-modal-overlay" onClick={() => setActiveJournal(null)}>
            <motion.div
              className="journal-modal-card"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="journal-modal-close"
                onClick={() => setActiveJournal(null)}
                aria-label="Close details"
              >
                <X size={18} />
              </button>

              <header className="journal-modal-header">
                <span className="journal-modal-emoji" role="img" aria-label="mood">
                  {activeJournal.mood || "📝"}
                </span>
                <div>
                  <span className="eyebrow">Journal Entry</span>
                  <h2>{activeJournal.title}</h2>
                  <time className="journal-modal-time">
                    <Calendar size={12} />
                    {formatDate(activeJournal.created_at)}
                  </time>
                </div>
              </header>

              <div className="journal-modal-body">
                <p className="journal-modal-content">{activeJournal.content}</p>
              </div>

              {(activeJournal.emotion ||
                (activeJournal.sentiment_score !== null &&
                  activeJournal.sentiment_score !== undefined) ||
                activeJournal.insight) && (
                <footer className="journal-modal-footer">
                  <div className="journal-analysis-header">
                    <Smile size={14} />
                    <h4>AI Mood Reflection</h4>
                  </div>
                  <div className="journal-analysis-grid">
                    {activeJournal.emotion && (
                      <div className="analysis-item">
                        <span>Dominant Emotion</span>
                        <strong>{displayEmotionLabel(activeJournal.emotion)}</strong>
                      </div>
                    )}
                    {activeJournal.sentiment_score !== null &&
                      activeJournal.sentiment_score !== undefined && (
                        <div className="analysis-item">
                          <span>Wellness Score</span>
                          <strong>{activeJournal.sentiment_score} / 5</strong>
                        </div>
                      )}
                  </div>

                  {/* Secondary/supporting emotions, read straight from
                      the stored GoEmotions result -- never hardcoded. */}
                  <div className="journal-analysis-secondary">
                    <span className="journal-analysis-secondary-label">
                      Other detected emotions
                    </span>
                    {activeSecondaryEmotions.length > 0 ? (
                      <ul className="journal-secondary-emotion-list">
                        {activeSecondaryEmotions.map((item, idx) => {
                          const pct = formatEmotionPercent(item.probability);
                          return (
                            <li key={`${item.label}-${idx}`}>
                              <span className="journal-secondary-emotion-name">
                                {displayEmotionLabel(item.label)}
                              </span>
                              {pct && (
                                <span className="journal-secondary-emotion-pct">
                                  {pct}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="journal-analysis-secondary-empty">
                        No additional strong emotional signals detected.
                      </p>
                    )}
                  </div>

                  {activeJournal.insight && (
                    <div className="journal-analysis-insight">
                      <p><strong>Reflection:</strong> {activeJournal.insight}</p>
                    </div>
                  )}
                </footer>
              )}

              {/* Risk screening panel -- only rendered when
                  risk_analysis data exists for this entry. Older
                  rows saved before this feature (or before the
                  migration ran) simply have no panel here; nothing
                  crashes and nothing is implied about them. */}
              {activeRiskAnalysis && (
                <footer className="journal-modal-footer journal-risk-footer">
                  <div className="journal-analysis-header">
                    <ShieldAlert size={14} />
                    <h4>Risk Screening</h4>
                  </div>

                  <p className="journal-risk-disclaimer">
                    Heuristic screening indicator, not a clinical assessment.
                  </p>

                  {activeRiskLevel === "low" ? (
                    <p className="journal-risk-summary journal-risk-summary--low">
                      Risk screening: Low
                    </p>
                  ) : (
                    <>
                      <div
                        className={`journal-risk-summary journal-risk-summary--${activeRiskLevel}`}
                      >
                        <span>Risk Level: {activeRiskDisplay?.label || activeRiskLevel}</span>
                        {activeRiskPercent && <span>Risk Score: {activeRiskPercent}</span>}
                      </div>

                      {activeRiskCategories.length > 0 && (
                        <div className="journal-risk-categories">
                          <span className="journal-analysis-secondary-label">
                            Detected risk categories
                          </span>
                          <ul className="journal-risk-category-list">
                            {activeRiskCategories.map((category) => (
                              <li key={category}>{riskCategoryLabel(category)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}

                  {activeProtectiveSignals > 0 && (
                    <p className="journal-risk-protective">
                      {activeProtectiveSignals} protective signal
                      {activeProtectiveSignals === 1 ? "" : "s"} also detected in this entry.
                    </p>
                  )}
                </footer>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default JournalPage;