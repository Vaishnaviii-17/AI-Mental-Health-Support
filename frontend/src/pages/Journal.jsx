import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Calendar,
  Trash2,
  X,
  AlertCircle,
  Smile,
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  ShieldAlert,
  Mic,
  Square,
  Loader2,
  CheckCircle,
} from "lucide-react";

import Navbar from "../components/Navbar/Navbar";
import {
  getJournals,
  createJournal,
  deleteJournal,
  transcribeJournalAudio,
} from "../services/journalService";
import "./Journal.css";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function formatEmotionPercent(probability) {
  if (
    probability === null ||
    probability === undefined ||
    Number.isNaN(Number(probability))
  ) {
    return null;
  }

  return `${(Number(probability) * 100).toFixed(1)}%`;
}

function displayEmotionLabel(emotion) {
  if (!emotion || emotion === "neutral") return "Neutral";

  return emotion.charAt(0).toUpperCase() + emotion.slice(1);
}

function formatRiskPercent(score) {
  if (
    score === null ||
    score === undefined ||
    Number.isNaN(Number(score))
  ) {
    return null;
  }

  return `${Math.round(Number(score) * 100)}%`;
}

function appendTranscript(existingText, transcriptText) {
  const transcript = transcriptText.trim();

  if (!transcript) return existingText;

  const existing = existingText.trimEnd();

  if (!existing) return transcript;

  return `${existing} ${transcript}`;
}

function riskCategoryLabel(category) {
  const labels = {
    suicidal_ideation: "Thoughts of not wanting to live",
    self_harm: "Self-harm related language",
    hopelessness: "Hopelessness",
    feeling_trapped: "Feeling trapped",
    severe_distress: "Severe distress",
  };

  return labels[category] || category;
}

const RISK_LEVEL_DISPLAY = {
  low: { label: "Low", tone: "low" },
  elevated: { label: "Elevated", tone: "elevated" },
  high: { label: "High", tone: "high" },
  critical: { label: "Critical", tone: "critical" },
};

const VOICE_STATUS_LABELS = {
  idle: "Speak",
  recording: "Listening...",
  processing: "Converting speech...",
  success: "Transcribed",
  error: "Speak",
};

const MAX_RECORDING_MS = 2 * 60 * 1000;

function JournalPage() {
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [voiceStatus, setVoiceStatus] = useState("idle");
  const [voiceError, setVoiceError] = useState("");

  const [form, setForm] = useState({
    title: "",
    content: "",
  });

  const [searchText, setSearchText] = useState("");
  const [emotionFilter, setEmotionFilter] = useState("All");
  const [dateSort, setDateSort] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(6);
  const [activeJournal, setActiveJournal] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const isUnmountingRef = useRef(false);

  const storedUser = getStoredUser();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getJournals();
      setJournals(data || []);
    } catch (err) {
      console.error("Unable to load journals:", err);
      setError("Failed to load your journal entries. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    isUnmountingRef.current = false;

    return () => {
      isUnmountingRef.current = true;

      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }

      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }

      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (
      !form.title.trim() ||
      !form.content.trim() ||
      voiceStatus === "recording" ||
      voiceStatus === "processing"
    ) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const created = await createJournal({
        title: form.title.trim(),
        content: form.content.trim(),
      });

      const newEntry = created?.journal || created;

      setJournals((prev) => [newEntry, ...prev]);
      setForm({ title: "", content: "" });
      setSuccess(true);

      window.setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving journal entry:", err);

      setError(
        err.response?.data?.message ||
          "Failed to save journal entry. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const stopRecordingTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const processRecording = async () => {
    const chunks = audioChunksRef.current;
    audioChunksRef.current = [];

    if (!chunks.length) {
      setVoiceStatus("error");
      setVoiceError("No audio was recorded. Please try again.");
      return;
    }

    const audioBlob = new Blob(chunks, {
      type: chunks[0]?.type || "audio/webm",
    });

    if (audioBlob.size <= 0) {
      setVoiceStatus("error");
      setVoiceError("No audio was recorded. Please try again.");
      return;
    }

    setVoiceStatus("processing");
    setVoiceError("");

    try {
      const transcript = await transcribeJournalAudio(audioBlob);
      const text = transcript?.text?.trim();

      if (!text) {
        setVoiceStatus("error");
        setVoiceError(
          "No speech was detected. Please try again or type your journal instead."
        );
        return;
      }

      setForm((prev) => ({
        ...prev,
        content: appendTranscript(prev.content, text),
      }));

      setVoiceStatus("success");

      window.setTimeout(() => {
        setVoiceStatus((current) =>
          current === "success" ? "idle" : current
        );
      }, 2500);
    } catch (err) {
      console.error("Transcription failed:", err);

      setVoiceStatus("error");
      setVoiceError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to transcribe audio. Please try again."
      );
    }
  };

  const handleVoiceToggle = async () => {
    if (voiceStatus === "recording") {
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }

      mediaRecorderRef.current?.stop();
      return;
    }

    if (voiceStatus === "processing" || submitting) return;

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceStatus("error");
      setVoiceError(
        "Voice journaling is not supported in this browser. Please use a supported browser or type your journal instead."
      );
      return;
    }

    try {
      setVoiceError("");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      mediaStreamRef.current = stream;

      let recorderOptions;

      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        recorderOptions = { mimeType: "audio/webm;codecs=opus" };
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        recorderOptions = { mimeType: "audio/webm" };
      }

      const recorder = new MediaRecorder(stream, recorderOptions);

      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setVoiceStatus("error");
        setVoiceError(
          "An error occurred while recording. Please try again."
        );
      };

      recorder.onstop = async () => {
        stopRecordingTracks();

        if (isUnmountingRef.current) return;

        await processRecording();
      };

      mediaRecorderRef.current = recorder;

      recorder.start();
      setVoiceStatus("recording");

      recordingTimeoutRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, MAX_RECORDING_MS);
    } catch (err) {
      stopRecordingTracks();

      setVoiceStatus("error");

      setVoiceError(
        err?.name === "NotAllowedError" ||
          err?.name === "PermissionDeniedError"
          ? "Microphone permission was denied. Please allow microphone access or type your journal instead."
          : "Unable to access your microphone. Please try again or type your journal instead."
      );
    }
  };

  const handleDelete = async (id, event) => {
    event.stopPropagation();

    if (!window.confirm("Permanently delete this journal entry?")) return;

    setError(null);

    try {
      await deleteJournal(id);

      setJournals((prev) => prev.filter((journal) => journal.id !== id));

      if (activeJournal?.id === id) {
        setActiveJournal(null);
      }
    } catch (err) {
      console.error("Error deleting journal entry:", err);

      setError(
        err.response?.data?.message ||
          "Failed to delete journal entry."
      );
    }
  };

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const uniqueEmotions = useMemo(() => {
    const emotions = new Set();

    journals.forEach((journal) => {
      if (journal.emotion) {
        emotions.add(journal.emotion);
      }
    });

    return ["All", ...Array.from(emotions)];
  }, [journals]);

  const processedJournals = useMemo(() => {
    let result = [...journals];

    if (searchText.trim()) {
      const term = searchText.toLowerCase();

      result = result.filter(
        (journal) =>
          journal.title.toLowerCase().includes(term) ||
          journal.content.toLowerCase().includes(term)
      );
    }

    if (emotionFilter !== "All") {
      result = result.filter(
        (journal) => journal.emotion === emotionFilter
      );
    }

    result.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);

      return dateSort === "newest"
        ? dateB - dateA
        : dateA - dateB;
    });

    return result;
  }, [journals, searchText, emotionFilter, dateSort]);

  const paginatedJournals = useMemo(
    () => processedJournals.slice(0, visibleCount),
    [processedJournals, visibleCount]
  );

  const activeSecondaryEmotions = Array.isArray(
    activeJournal?.secondary_emotions
  )
    ? activeJournal.secondary_emotions
    : [];

  const activeRiskAnalysis =
    activeJournal?.risk_analysis &&
    typeof activeJournal.risk_analysis === "object"
      ? activeJournal.risk_analysis
      : null;

  const activeRiskLevel = activeRiskAnalysis?.risk_level;
  const activeRiskDisplay = activeRiskLevel
    ? RISK_LEVEL_DISPLAY[activeRiskLevel] || {
        label: activeRiskLevel,
        tone: "low",
      }
    : null;

  const activeRiskCategories = Array.isArray(
    activeRiskAnalysis?.detected_risk_categories
  )
    ? activeRiskAnalysis.detected_risk_categories
    : [];

  const activeProtectiveSignals =
    Number(activeRiskAnalysis?.protective_text_signals) || 0;

  const activeRiskPercent = formatRiskPercent(
    activeRiskAnalysis?.risk_score
  );

  const characterCount = form.content.length;

  const isVoiceBusy =
    voiceStatus === "recording" ||
    voiceStatus === "processing";

  return (
    <>
      <Navbar profile={storedUser} />

      <main id="journal" className="journal-page">
        <div className="container">
          <header className="journal-header">
            <span className="eyebrow">Your private space</span>
            <h1>Journal</h1>
            <p className="journal-subtitle">
              A private space to write, reflect and let your thoughts out.
            </p>
          </header>

          {error && (
            <div className="journal-alert journal-alert--error" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              className="journal-alert journal-alert--success"
              role="alert"
            >
              <span>
                Journal entry saved successfully and analyzed!
              </span>
            </div>
          )}

          <div className="journal-layout-grid">
            <section className="journal-form-section">
              <div className="dashboard-card compact-card">
                <div className="dashboard-card__heading">
                  <div>
                    <span className="eyebrow">New Entry</span>
                    <h2 className="card-compact-title">
                      How was your day?
                    </h2>
                  </div>

                  <BookOpen
                    size={16}
                    className="journal-icon-title"
                  />
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
                      <label htmlFor="content">
                        Your thoughts
                      </label>

                      <div className="journal-textarea-tools">
                        <button
                          type="button"
                          className={`journal-voice-btn journal-voice-btn--${voiceStatus}`}
                          onClick={handleVoiceToggle}
                          disabled={
                            submitting ||
                            voiceStatus === "processing"
                          }
                          aria-label={
                            voiceStatus === "recording"
                              ? "Stop recording"
                              : "Start voice journaling"
                          }
                          title={
                            voiceStatus === "recording"
                              ? "Stop recording"
                              : "Start voice journaling"
                          }
                        >
                          {voiceStatus === "recording" ? (
                            <Square size={13} />
                          ) : voiceStatus === "processing" ? (
                            <Loader2
                              size={13}
                              className="journal-voice-spin"
                            />
                          ) : voiceStatus === "success" ? (
                            <CheckCircle size={13} />
                          ) : (
                            <Mic size={13} />
                          )}

                          <span>
                            {VOICE_STATUS_LABELS[voiceStatus]}
                          </span>
                        </button>

                        <span className="char-counter">
                          {characterCount} characters
                        </span>
                      </div>
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

                    {voiceError && (
                      <p className="journal-voice-message journal-voice-message--error">
                        {voiceError}
                      </p>
                    )}

                    {voiceStatus === "processing" && (
                      <p className="journal-voice-message">
                        Converting speech to editable journal text...
                      </p>
                    )}
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-compact"
                      onClick={() => {
                        setForm({ title: "", content: "" });
                        setVoiceError("");
                      }}
                      disabled={submitting || isVoiceBusy}
                    >
                      Clear
                    </button>

                    <button
                      type="submit"
                      className="btn btn-primary btn-compact"
                      disabled={
                        submitting ||
                        isVoiceBusy ||
                        !form.title.trim() ||
                        !form.content.trim()
                      }
                    >
                      {submitting ? "Saving..." : "Save Entry"}
                    </button>
                  </div>
                </form>
              </div>
            </section>

            <section className="journal-list-section">
              <div className="list-header-row">
                <h2 className="section-heading-title">
                  Previous reflections
                </h2>

                <span className="entries-count">
                  Showing{" "}
                  {Math.min(
                    paginatedJournals.length,
                    processedJournals.length
                  )}{" "}
                  of {processedJournals.length}
                </span>
              </div>

              <div className="dashboard-card journal-controls-card">
                <div className="controls-search-wrap">
                  <Search size={14} className="search-icon" />

                  <input
                    type="text"
                    placeholder="Search reflections..."
                    value={searchText}
                    onChange={(event) => {
                      setSearchText(event.target.value);
                      setVisibleCount(6);
                    }}
                    className="search-input"
                  />
                </div>

                <div className="controls-dropdowns-row">
                  <div className="filter-select-group">
                    <Filter
                      size={12}
                      className="control-icon"
                    />

                    <select
                      value={emotionFilter}
                      onChange={(event) => {
                        setEmotionFilter(event.target.value);
                        setVisibleCount(6);
                      }}
                      className="control-select"
                      aria-label="Filter entries by emotion"
                    >
                      {uniqueEmotions.map((emotion) => (
                        <option key={emotion} value={emotion}>
                          {emotion === "All"
                            ? "All Emotions"
                            : displayEmotionLabel(emotion)}
                        </option>
                      ))}
                    </select>

                    <ChevronDown
                      size={12}
                      className="select-arrow"
                    />
                  </div>

                  <div className="sort-select-group">
                    <ArrowUpDown
                      size={12}
                      className="control-icon"
                    />

                    <select
                      value={dateSort}
                      onChange={(event) =>
                        setDateSort(event.target.value)
                      }
                      className="control-select"
                      aria-label="Sort entries by date"
                    >
                      <option value="newest">
                        Newest First
                      </option>
                      <option value="oldest">
                        Oldest First
                      </option>
                    </select>

                    <ChevronDown
                      size={12}
                      className="select-arrow"
                    />
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
                  <BookOpen
                    size={28}
                    className="empty-state-icon"
                  />

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
                      transition={{
                        duration: 0.2,
                        delay: index * 0.03,
                      }}
                      onClick={() => setActiveJournal(journal)}
                    >
                      <div className="journal-card-header">
                        <div className="journal-card-title-group">
                          <span
                            className="journal-card-emoji"
                            role="img"
                            aria-label="mood"
                          >
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
                          onClick={(event) =>
                            handleDelete(journal.id, event)
                          }
                          aria-label="Delete journal entry"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <p className="journal-card-preview">
                        {journal.content.length > 100
                          ? `${journal.content.slice(0, 100)}...`
                          : journal.content}
                      </p>

                      <div className="journal-card-footer">
                        <span className="journal-emotion-badge">
                          {displayEmotionLabel(journal.emotion)}
                        </span>

                        <span className="journal-read-link">
                          View →
                        </span>
                      </div>
                    </motion.article>
                  ))}
                </div>
              )}

              {processedJournals.length >
                paginatedJournals.length && (
                <button
                  type="button"
                  className="btn btn-ghost load-more-btn"
                  onClick={() =>
                    setVisibleCount((prev) => prev + 6)
                  }
                >
                  Load More Reflections
                </button>
              )}
            </section>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {activeJournal && (
          <div
            className="journal-modal-overlay"
            onClick={() => setActiveJournal(null)}
          >
            <motion.div
              className="journal-modal-card"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              onClick={(event) => event.stopPropagation()}
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
                <span
                  className="journal-modal-emoji"
                  role="img"
                  aria-label="mood"
                >
                  {activeJournal.mood || "📝"}
                </span>

                <div>
                  <span className="eyebrow">
                    Journal Entry
                  </span>

                  <h2>{activeJournal.title}</h2>

                  <time className="journal-modal-time">
                    <Calendar size={12} />
                    {formatDate(activeJournal.created_at)}
                  </time>
                </div>
              </header>

              <div className="journal-modal-body">
                <p className="journal-modal-content">
                  {activeJournal.content}
                </p>
              </div>

              {(activeJournal.emotion ||
                activeJournal.sentiment_score !== null ||
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

                        <strong>
                          {displayEmotionLabel(
                            activeJournal.emotion
                          )}
                        </strong>
                      </div>
                    )}

                    {activeJournal.sentiment_score !== null &&
                      activeJournal.sentiment_score !==
                        undefined && (
                        <div className="analysis-item">
                          <span>Wellness Score</span>

                          <strong>
                            {activeJournal.sentiment_score} / 5
                          </strong>
                        </div>
                      )}
                  </div>

                  <div className="journal-analysis-secondary">
                    <span className="journal-analysis-secondary-label">
                      Other detected emotions
                    </span>

                    {activeSecondaryEmotions.length > 0 ? (
                      <ul className="journal-secondary-emotion-list">
                        {activeSecondaryEmotions.map(
                          (item, index) => {
                            const percentage =
                              formatEmotionPercent(
                                item.probability
                              );

                            return (
                              <li
                                key={`${item.label}-${index}`}
                              >
                                <span className="journal-secondary-emotion-name">
                                  {displayEmotionLabel(
                                    item.label
                                  )}
                                </span>

                                {percentage && (
                                  <span className="journal-secondary-emotion-pct">
                                    {percentage}
                                  </span>
                                )}
                              </li>
                            );
                          }
                        )}
                      </ul>
                    ) : (
                      <p className="journal-analysis-secondary-empty">
                        No additional strong emotional signals
                        detected.
                      </p>
                    )}
                  </div>

                  {activeJournal.insight && (
                    <div className="journal-analysis-insight">
                      <p>
                        <strong>Reflection:</strong>{" "}
                        {activeJournal.insight}
                      </p>
                    </div>
                  )}
                </footer>
              )}

              {activeRiskAnalysis && (
                <footer className="journal-modal-footer journal-risk-footer">
                  <div className="journal-analysis-header">
                    <ShieldAlert size={14} />
                    <h4>Risk Screening</h4>
                  </div>

                  <p className="journal-risk-disclaimer">
                    Heuristic screening indicator, not a clinical
                    assessment.
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
                        <span>
                          Risk Level:{" "}
                          {activeRiskDisplay?.label ||
                            activeRiskLevel}
                        </span>

                        {activeRiskPercent && (
                          <span>
                            Risk Score: {activeRiskPercent}
                          </span>
                        )}
                      </div>

                      {activeRiskCategories.length > 0 && (
                        <div className="journal-risk-categories">
                          <span className="journal-analysis-secondary-label">
                            Detected risk categories
                          </span>

                          <ul className="journal-risk-category-list">
                            {activeRiskCategories.map(
                              (category) => (
                                <li key={category}>
                                  {riskCategoryLabel(category)}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                    </>
                  )}

                  {activeProtectiveSignals > 0 && (
                    <p className="journal-risk-protective">
                      {activeProtectiveSignals} protective
                      signal
                      {activeProtectiveSignals === 1
                        ? ""
                        : "s"} also detected in this entry.
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