import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Calendar, Trash2, X, AlertCircle, Smile, Search, Filter, ArrowUpDown, ChevronDown } from "lucide-react";
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
      const newEntry = await createJournal({
        title: form.title.trim(),
        content: form.content.trim()
      });
      
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

  // List of unique emotions for filter dropdown
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
                          {emotion === "All" ? "All Emotions" : emotion}
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
                  {paginatedJournals.map((journal, index) => (
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
                          {journal.emotion || "Neutral"}
                        </span>
                        <span className="journal-read-link">
                          View &rarr;
                        </span>
                      </div>
                    </motion.article>
                  ))}
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
                  activeJournal.risk_level ||
                activeJournal.insight) && (
                <footer className="journal-modal-footer">
                  <div className="journal-analysis-header">
                    <Smile size={14} />
                    <h4>AI Mood Reflection</h4>
                  </div>
                  <div className="journal-analysis-grid">
                    {activeJournal.emotion && (
                      <div className="analysis-item">
                        <span>Emotion</span>
                        <strong>{activeJournal.emotion}</strong>
                      </div>
                    )}
                    {activeJournal.sentiment_score !== null &&
                      activeJournal.sentiment_score !== undefined && (
                        <div className="analysis-item">
                          <span>Wellness Score</span>
                          <strong>{activeJournal.sentiment_score} / 5</strong>
                        </div>
                      )}
                      {activeJournal.risk_level && (
                        <div className="analysis-item">
                          <span>Risk Indication</span>
                          <strong>
                            {activeJournal.risk_level === "low" && "🟢 Low"}
                            {activeJournal.risk_level === "elevated" && "🟠 Moderate"}
                            {activeJournal.risk_level === "high" && "🔴 High"}
                            {activeJournal.risk_level === "critical" && "🔴 High"}
                          </strong>
                        </div>
                      )}
                  </div>
                  {activeJournal.insight && (
                    <div className="journal-analysis-insight">
                      <p><strong>Reflection:</strong> {activeJournal.insight}</p>
                    </div>
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