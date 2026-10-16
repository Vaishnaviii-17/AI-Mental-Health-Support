import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import {
  BookOpen,
  Calendar,
  Trash2,
  AlertCircle,
  Smile,
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ShieldAlert,
  Mic,
  Square,
  Loader2,
  CheckCircle,
  Feather,
  Keyboard,
  Leaf,
} from "lucide-react";

import Navbar from "../components/Navbar/Navbar";
import * as journalService from "../services/journalService";
import "./Journal.css";
import IndicVirtualKeyboard from "./IndicVirtualKeyboard";

/* The service is imported as a namespace so that a stale local
   journalService.js (one that lacks an export) cannot crash the module at
   load time. Every function is checked before use; nothing is invented. */
const { getJournals, createJournal, deleteJournal, transcribeJournalAudio } =
  journalService;
const createVoiceJournal = journalService.createVoiceJournal;

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
  if (emotion === "mixed") return "Mixed emotional signals";
  if (!emotion || emotion === "neutral") return "Neutral";

  return emotion.charAt(0).toUpperCase() + emotion.slice(1);
}

function displayMismatchLabel(category) {
  if (!category) return "Unavailable";

  return category.charAt(0).toUpperCase() + category.slice(1);
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

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
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

const JOURNAL_LANGUAGES = {
  en: { label: "English", shortLabel: "ENG" },
  hi: { label: "Hindi", shortLabel: "HIN" },
  mr: { label: "Marathi", shortLabel: "MAR" },
};

const MAX_RECORDING_MS = 2 * 60 * 1000;

const SOFT_EASE = [0.22, 1, 0.36, 1];

const DESK_CARD_VARIANTS = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: SOFT_EASE,
      delayChildren: 0.12,
      staggerChildren: 0.06,
    },
  },
};

const DESK_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: SOFT_EASE },
  },
};

/* Internal journal views: opacity + small y for the landing page,
   a gentle settle for the open book. */
const VIEW_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: SOFT_EASE },
  },
  exit: { opacity: 0, y: -6, transition: { duration: 0.2 } },
};

const BOOK_VIEW_VARIANTS = {
  hidden: { opacity: 0, scale: 0.985, rotateX: 1 },
  visible: {
    opacity: 1,
    scale: 1,
    rotateX: 0,
    transition: { duration: 0.45, ease: SOFT_EASE },
  },
  exit: { opacity: 0, scale: 0.99, transition: { duration: 0.2 } },
};

/* Archive page turn: restrained rotateY, never a full flip. */
const PAGE_TURN_VARIANTS = {
  enter: (direction) => ({
    opacity: 0,
    rotateY: direction > 0 ? 10 : -10,
    x: direction > 0 ? 24 : -24,
  }),
  center: {
    opacity: 1,
    rotateY: 0,
    x: 0,
    transition: { duration: 0.26, ease: SOFT_EASE },
  },
  exit: (direction) => ({
    opacity: 0,
    rotateY: direction > 0 ? -12 : 12,
    x: direction > 0 ? -24 : 24,
    transition: { duration: 0.2, ease: "easeIn" },
  }),
};

/* AI reflection reveal (~650ms in total). Risk screening is rendered
   outside this choreography so it is readable immediately. */
const REFLECTION_VARIANTS = {
  hidden: {},
  visible: {
    transition: { delayChildren: 0.04, staggerChildren: 0.08 },
  },
};

const REFLECT_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: SOFT_EASE },
  },
};

const REFLECT_POP_VARIANTS = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: SOFT_EASE },
  },
};

const REFLECT_LIST_VARIANTS = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

function getAnalysisView(journal) {
  const risk =
    journal?.risk_analysis && typeof journal.risk_analysis === "object"
      ? journal.risk_analysis
      : null;

  const riskLevel = risk?.risk_level;

  return {
    secondary: Array.isArray(journal?.secondary_emotions)
      ? journal.secondary_emotions
      : [],
    hasScore:
      journal?.sentiment_score !== null &&
      journal?.sentiment_score !== undefined,
    risk,
    riskLevel,
    riskDisplay: riskLevel
      ? RISK_LEVEL_DISPLAY[riskLevel] || { label: riskLevel, tone: "low" }
      : null,
    riskCategories: Array.isArray(risk?.detected_risk_categories)
      ? risk.detected_risk_categories
      : [],
    protectiveSignals: Number(risk?.protective_text_signals) || 0,
    riskPercent: formatRiskPercent(risk?.risk_score),
  };
}

function getTranslationView(journal, showTranslated) {
  const originalLanguage = journal?.original_language || "en";
  const languageMeta =
    JOURNAL_LANGUAGES[originalLanguage] || JOURNAL_LANGUAGES.en;
  const canToggle =
    originalLanguage !== "en" && Boolean(journal?.translated_content);

  return {
    languageMeta,
    canToggle,
    content:
      canToggle && showTranslated
        ? journal.translated_content
        : journal?.content,
  };
}

function RiskScreening({ analysis }) {
  if (!analysis.risk) return null;

  return (
    <section
      className="journal-risk-panel"
      aria-label="Risk screening"
    >
      <div className="journal-analysis-header">
        <ShieldAlert size={14} aria-hidden="true" />
        <h4>Risk Screening</h4>
      </div>

      <p className="journal-risk-disclaimer">
        Heuristic screening indicator, not a clinical assessment.
      </p>

      {analysis.riskLevel === "low" ? (
        <p className="journal-risk-summary journal-risk-summary--low">
          Risk screening: Low
        </p>
      ) : (
        <>
          <div
            className={`journal-risk-summary journal-risk-summary--${analysis.riskLevel}`}
          >
            <span>
              Risk Level:{" "}
              {analysis.riskDisplay?.label || analysis.riskLevel}
            </span>

            {analysis.riskPercent && (
              <span>Risk Score: {analysis.riskPercent}</span>
            )}
          </div>

          {analysis.riskCategories.length > 0 && (
            <div className="journal-risk-categories">
              <span className="journal-analysis-secondary-label">
                Detected risk categories
              </span>

              <ul className="journal-risk-category-list">
                {analysis.riskCategories.map((category) => (
                  <li key={category}>{riskCategoryLabel(category)}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {analysis.protectiveSignals > 0 && (
        <p className="journal-risk-protective">
          {analysis.protectiveSignals} protective signal
          {analysis.protectiveSignals === 1 ? "" : "s"} also detected in
          this entry.
        </p>
      )}
    </section>
  );
}

function VoiceSignals({ journal }) {
  const multimodal =
    journal?.multimodal_analysis &&
    typeof journal.multimodal_analysis === "object"
      ? journal.multimodal_analysis
      : null;

  if (!multimodal) return null;

  const fusion = multimodal.fusion || null;
  const mismatch = multimodal.mismatch || null;
  const voiceEmotion = multimodal.voiceEmotion || null;
  const textEmotion = multimodal.textEmotion || null;
  const originalLanguage = journal?.original_language || "en";
  const languageMeta =
    JOURNAL_LANGUAGES[originalLanguage] || JOURNAL_LANGUAGES.en;

  return (
    <section
      className="journal-voice-analysis-panel"
      aria-label="Voice mood signals"
    >
      <div className="journal-analysis-header">
        <Mic size={14} aria-hidden="true" />
        <h4>Voice Mood Signals</h4>
      </div>

      <div className="journal-analysis-grid journal-voice-analysis-grid">
        <div className="analysis-item">
          <span>Overall mood</span>
          <strong>
            {displayEmotionLabel(fusion?.finalMood || journal.emotion)}
          </strong>
        </div>

        <div className="analysis-item">
          <span>Text emotion</span>
          <strong>{displayEmotionLabel(textEmotion?.dominant)}</strong>
        </div>

        <div className="analysis-item">
          <span>Voice tone</span>
          <strong>
            {voiceEmotion
              ? displayEmotionLabel(voiceEmotion.commonEmotion)
              : "Unavailable"}
          </strong>
        </div>

        <div className="analysis-item">
          <span>Emotional mismatch</span>
          <strong>{displayMismatchLabel(mismatch?.category)}</strong>
        </div>
      </div>

      {multimodal.voiceEmotionError && (
        <p className="journal-analysis-secondary-empty">
          Speech emotion analysis was unavailable, so this entry used the
          text mood signal.
        </p>
      )}

      {multimodal.speechEmotionLanguageNote && originalLanguage !== "en" && (
        <p className="journal-risk-disclaimer">
          Voice tone analysis uses the original acoustic signal and may be
          less reliable for {languageMeta.label}.
        </p>
      )}
    </section>
  );
}

function ReflectionPanel({ journal, heading }) {
  const analysis = getAnalysisView(journal);

  const hasReflection =
    Boolean(journal.emotion) ||
    analysis.hasScore ||
    Boolean(journal.insight);

  return (
    <motion.div
      className="journal-reflection"
      variants={REFLECTION_VARIANTS}
      initial="hidden"
      animate="visible"
    >
      <motion.header
        className="journal-reflection-head"
        variants={REFLECT_ITEM_VARIANTS}
      >
        <span className="journal-sheet-eyebrow">
          <Smile size={13} aria-hidden="true" />
          {heading}
        </span>
      </motion.header>

      {hasReflection ? (
        <>
          {journal.emotion && (
            <motion.div
              className="journal-dominant"
              variants={REFLECT_POP_VARIANTS}
            >
              <span
                className="journal-dominant-emoji"
                role="img"
                aria-label="mood"
              >
                {journal.mood || "📝"}
              </span>

              <div className="journal-dominant-text">
                <span className="journal-dominant-label">
                  Dominant emotion
                </span>
                <strong>{displayEmotionLabel(journal.emotion)}</strong>
              </div>
            </motion.div>
          )}

          {analysis.hasScore && (
            <motion.div
              className="journal-score"
              variants={REFLECT_ITEM_VARIANTS}
            >
              <span>Wellness Score</span>
              <strong>{journal.sentiment_score} / 5</strong>
            </motion.div>
          )}

          <motion.div
            className="journal-analysis-secondary"
            variants={REFLECT_ITEM_VARIANTS}
          >
            <span className="journal-analysis-secondary-label">
              Other detected emotions
            </span>

            {analysis.secondary.length > 0 ? (
              <motion.ul
                className="journal-secondary-emotion-list"
                variants={REFLECT_LIST_VARIANTS}
              >
                {analysis.secondary.map((item, index) => {
                  const percentage = formatEmotionPercent(
                    item.probability
                  );
                  const barWidth =
                    percentage !== null
                      ? Math.max(
                          0,
                          Math.min(100, Number(item.probability) * 100)
                        )
                      : 0;

                  return (
                    <motion.li
                      key={`${item.label}-${index}`}
                      variants={REFLECT_ITEM_VARIANTS}
                    >
                      <span className="journal-secondary-emotion-name">
                        {displayEmotionLabel(item.label)}
                      </span>

                      {percentage && (
                        <span className="journal-secondary-emotion-pct">
                          {percentage}
                        </span>
                      )}

                      {percentage && (
                        <span
                          className="journal-emotion-bar"
                          aria-hidden="true"
                        >
                          <span style={{ width: `${barWidth}%` }} />
                        </span>
                      )}
                    </motion.li>
                  );
                })}
              </motion.ul>
            ) : (
              <p className="journal-analysis-secondary-empty">
                No additional strong emotional signals detected.
              </p>
            )}
          </motion.div>

          {journal.insight && (
            <motion.div
              className="journal-analysis-insight"
              variants={REFLECT_ITEM_VARIANTS}
            >
              <p>
                <strong>Reflection:</strong> {journal.insight}
              </p>
            </motion.div>
          )}
        </>
      ) : (
        <p className="journal-analysis-secondary-empty">
          No emotional analysis is available for this entry.
        </p>
      )}

      <VoiceSignals journal={journal} />

      <RiskScreening analysis={analysis} />
    </motion.div>
  );
}

function EntryPaper({
  journal,
  eyebrow,
  showTranslated,
  onToggleTranslation,
  footer,
}) {
  const translation = getTranslationView(journal, showTranslated);

  return (
    <div className="journal-entry-paper">
      <header className="journal-entry-head">
        <span className="journal-sheet-eyebrow">
          <BookOpen size={13} aria-hidden="true" />
          {eyebrow}
        </span>

        <time
          className="journal-diary-date"
          dateTime={journal.created_at}
        >
          <Calendar size={11} aria-hidden="true" />
          {formatDate(journal.created_at)}
        </time>
      </header>

      <h3 className="journal-entry-title">{journal.title}</h3>

      <div className="journal-entry-body">
        {translation.canToggle && (
          <motion.button
            type="button"
            className="journal-translation-toggle"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.15 }}
            onClick={onToggleTranslation}
            aria-label={
              showTranslated
                ? `Show original ${translation.languageMeta.label} journal text`
                : "Show English translation"
            }
          >
            {showTranslated
              ? translation.languageMeta.shortLabel
              : "ENG"}
          </motion.button>
        )}

        <p className="journal-entry-content">{translation.content}</p>
      </div>

      {footer}
    </div>
  );
}

function JournalPage() {
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [voiceStatus, setVoiceStatus] = useState("idle");
  const [voiceError, setVoiceError] = useState("");
  const [voiceAudioBlob, setVoiceAudioBlob] = useState(null);
  const [notice, setNotice] = useState(null);
  const [entryLanguage, setEntryLanguage] = useState("en");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const contentRef = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const [showTranslatedJournal, setShowTranslatedJournal] = useState(false);

  const [form, setForm] = useState({
    title: "",
    content: "",
  });

  const [searchText, setSearchText] = useState("");
  const [emotionFilter, setEmotionFilter] = useState("All");
  const [dateSort, setDateSort] = useState("newest");

  const [journalView, setJournalView] = useState("home");
  const [introDone, setIntroDone] = useState(
    () =>
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [archiveIndex, setArchiveIndex] = useState(0);
  const [pageDirection, setPageDirection] = useState(1);
  const [savedReflection, setSavedReflection] = useState(null);

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

  const rememberSelection = () => {
    const element = contentRef.current;
    if (element) selectionRef.current = { start: element.selectionStart, end: element.selectionEnd };
  };

  const insertKeyboardText = (text) => {
    const element = contentRef.current;
    const { start, end } = selectionRef.current;
    const safeStart = Math.min(start, form.content.length);
    const safeEnd = Math.min(end, form.content.length);
    const next = form.content.slice(0, safeStart) + text + form.content.slice(safeEnd);
    const position = safeStart + text.length;
    setForm((prev) => ({ ...prev, content: next }));
    selectionRef.current = { start: position, end: position };
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(position, position);
    });
  };

  const keyboardBackspace = () => {
    const { start, end } = selectionRef.current;
    const safeStart = Math.min(start, form.content.length);
    const safeEnd = Math.min(end, form.content.length);
    if (safeStart === 0 && safeStart === safeEnd) return;
    // Segment by grapheme so matras and conjuncts are deleted together where supported.
    const prefix = form.content.slice(0, safeStart);
    const graphemes = typeof Intl.Segmenter === "function"
      ? Array.from(new Intl.Segmenter("hi", { granularity: "grapheme" }).segment(prefix), (item) => item.segment)
      : Array.from(prefix);
    const previous = safeStart === safeEnd ? prefix.slice(0, -((graphemes.at(-1) || "").length)) : prefix;
    const position = previous.length;
    setForm((prev) => ({ ...prev, content: previous + prev.content.slice(safeEnd) }));
    selectionRef.current = { start: position, end: position };
    requestAnimationFrame(() => {
      contentRef.current?.focus();
      contentRef.current?.setSelectionRange(position, position);
    });
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
    setNotice(null);
    setSuccess(false);

    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        originalLanguage: entryLanguage,
      };

      let created;

      if (voiceAudioBlob && typeof createVoiceJournal === "function") {
        created = await createVoiceJournal({
          ...payload,
          audioBlob: voiceAudioBlob,
        });
      } else {
        if (voiceAudioBlob) {
          /* Never drop the audio silently: tell the user plainly. */
          setNotice(
            "Voice tone analysis is unavailable because createVoiceJournal is missing from journalService. This entry was saved with text analysis only."
          );
        }

        created = await createJournal(payload);
      }

      const newEntry = created?.journal || created;

      setJournals((prev) => [newEntry, ...prev]);
      setSavedReflection(newEntry);
      setShowTranslatedJournal(false);
      setForm({ title: "", content: "" });
      setEntryLanguage("en");
      setKeyboardOpen(false);
      setVoiceAudioBlob(null);
      setVoiceError("");
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
      const transcript = await transcribeJournalAudio(
        audioBlob,
        entryLanguage
      );
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
      setVoiceAudioBlob(audioBlob);

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
      setSavedReflection((current) =>
        current?.id === id ? null : current
      );
      setShowTranslatedJournal(false);
      setPageDirection(1);
    } catch (err) {
      console.error("Error deleting journal entry:", err);

      setError(
        err.response?.data?.message ||
          "Failed to delete journal entry."
      );
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
          (journal.title || "").toLowerCase().includes(term) ||
          (journal.content || "").toLowerCase().includes(term)
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

  const recentJournals = useMemo(
    () =>
      [...journals]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 3),
    [journals]
  );

  const journalOverview = useMemo(() => {
    const now = new Date();
    const emotionCounts = {};
    let thisMonth = 0;
    let withEmotion = 0;

    journals.forEach((journal) => {
      const created = new Date(journal.created_at);

      if (
        !Number.isNaN(created.getTime()) &&
        created.getMonth() === now.getMonth() &&
        created.getFullYear() === now.getFullYear()
      ) {
        thisMonth += 1;
      }

      if (journal.emotion) {
        const key = String(journal.emotion).toLowerCase();

        emotionCounts[key] = (emotionCounts[key] || 0) + 1;
        withEmotion += 1;
      }
    });

    const ranked = Object.entries(emotionCounts).sort(
      (a, b) => b[1] - a[1]
    );

    const hasClearLeader =
      withEmotion >= 2 &&
      ranked.length > 0 &&
      (ranked.length === 1 || ranked[0][1] > ranked[1][1]);

    return {
      total: journals.length,
      thisMonth,
      distinctEmotions: ranked.length,
      topEmotion: hasClearLeader ? ranked[0][0] : null,
    };
  }, [journals]);

  useEffect(() => {
    setArchiveIndex((current) => {
      const lastIndex = Math.max(processedJournals.length - 1, 0);

      return current > lastIndex ? lastIndex : current;
    });
  }, [processedJournals.length]);

  const safeArchiveIndex = Math.min(
    archiveIndex,
    Math.max(processedJournals.length - 1, 0)
  );
  const archiveJournal = processedJournals[safeArchiveIndex] || null;

  const goToArchiveIndex = (nextIndex) => {
    if (
      nextIndex < 0 ||
      nextIndex > processedJournals.length - 1 ||
      nextIndex === safeArchiveIndex
    ) {
      return;
    }

    setPageDirection(nextIndex > safeArchiveIndex ? 1 : -1);
    setShowTranslatedJournal(false);
    setArchiveIndex(nextIndex);
  };

  const resetArchivePosition = () => {
    setArchiveIndex(0);
    setPageDirection(1);
    setShowTranslatedJournal(false);
  };

  const openRecentEntry = (index) => {
    setSearchText("");
    setEmotionFilter("All");
    setDateSort("newest");
    setPageDirection(1);
    setShowTranslatedJournal(false);
    setArchiveIndex(index);
    setJournalView("archive");
  };

  const startNewEntry = () => {
    setSavedReflection(null);
    setVoiceAudioBlob(null);
    setShowTranslatedJournal(false);
  };

  const characterCount = form.content.length;

  const isVoiceBusy =
    voiceStatus === "recording" ||
    voiceStatus === "processing";

  const saveDisabled =
    submitting ||
    isVoiceBusy ||
    !form.title.trim() ||
    !form.content.trim();

  const todayDate = new Date();
  const diaryDateLabel = todayDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const homeDateLabel = todayDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const diaryDateTime = todayDate.toLocaleDateString("en-CA");

  const toggleTranslation = () =>
    setShowTranslatedJournal((current) => !current);

  const renderCover = () => (
    <motion.div
      key="cover"
      className="journal-cover-scene"
      role="status"
      aria-label="Opening your journal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.25 }}
    >
      <div className="journal-cover-book">
        <div className="journal-cover-pages" aria-hidden="true">
          <Leaf size={22} />
        </div>

        <motion.div
          className="journal-cover-lid"
          initial={{ rotateY: 0 }}
          animate={{ rotateY: [0, 0, -112] }}
          transition={{
            duration: 0.8,
            delay: 0.1,
            times: [0, 0.3, 1],
            ease: SOFT_EASE,
          }}
          onAnimationComplete={() => setIntroDone(true)}
        >
          <span className="journal-cover-icon" aria-hidden="true">
            <BookOpen size={22} />
          </span>
          <span className="journal-cover-brand">MINDEASE</span>
          <span className="journal-cover-rule" aria-hidden="true" />
          <span className="journal-cover-title">My Journal</span>
        </motion.div>
      </div>
    </motion.div>
  );

  const renderSubnav = () => (
    <nav className="journal-subnav" aria-label="Journal sections">
      <button
        type="button"
        className="journal-subnav-back"
        onClick={() => setJournalView("home")}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Journal Home
      </button>

      <div className="journal-subnav-tabs">
        <button
          type="button"
          className={`journal-subnav-tab${
            journalView === "write" ? " is-active" : ""
          }`}
          aria-current={journalView === "write" ? "page" : undefined}
          onClick={() => setJournalView("write")}
        >
          Today&apos;s Entry
        </button>

        <button
          type="button"
          className={`journal-subnav-tab${
            journalView === "archive" ? " is-active" : ""
          }`}
          aria-current={journalView === "archive" ? "page" : undefined}
          onClick={() => setJournalView("archive")}
        >
          Previous Entries
        </button>
      </div>
    </nav>
  );

  const renderHome = () => (
    <motion.div
      key="home"
      className="journal-home"
      variants={VIEW_VARIANTS}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <header className="journal-header">
        <span className="eyebrow">Your private space</span>
        <h1>Journal</h1>
        <p className="journal-subtitle">
          A quiet space for your thoughts
        </p>
      </header>

      <motion.section
        className="journal-hero"
        variants={DESK_CARD_VARIANTS}
        initial="hidden"
        animate="visible"
        aria-label="Today's journal"
      >
        <motion.div
          className="journal-hero-mark"
          variants={DESK_ITEM_VARIANTS}
        >
          <BookOpen size={20} aria-hidden="true" />
        </motion.div>

        <motion.time
          className="journal-hero-date"
          dateTime={diaryDateTime}
          variants={DESK_ITEM_VARIANTS}
        >
          {homeDateLabel}
        </motion.time>

        <motion.h2
          className="journal-hero-title"
          variants={DESK_ITEM_VARIANTS}
        >
          How are you feeling today?
        </motion.h2>

        <motion.p
          className="journal-hero-text"
          variants={DESK_ITEM_VARIANTS}
        >
          Take a moment to slow down, reflect, and write what&apos;s on
          your mind.
        </motion.p>

        <motion.div
          className="journal-hero-actions"
          variants={DESK_ITEM_VARIANTS}
        >
          <motion.button
            type="button"
            className="btn btn-primary"
            whileHover={{ scale: 1.015, y: -1 }}
            whileTap={{ scale: 0.975 }}
            transition={{ duration: 0.15 }}
            onClick={() => setJournalView("write")}
          >
            <Feather size={15} aria-hidden="true" />
            Write Today&apos;s Entry
          </motion.button>

          <motion.button
            type="button"
            className="btn btn-ghost"
            whileHover={{ scale: 1.015, y: -1 }}
            whileTap={{ scale: 0.975 }}
            transition={{ duration: 0.15 }}
            onClick={() => setJournalView("archive")}
          >
            <BookOpen size={15} aria-hidden="true" />
            Open My Journal
          </motion.button>
        </motion.div>
      </motion.section>

      {!loading && journals.length > 0 && (
        <motion.div
          className="journal-home-lower"
          variants={DESK_CARD_VARIANTS}
          initial="hidden"
          animate="visible"
        >
          <motion.section
            className="journal-overview"
            variants={DESK_ITEM_VARIANTS}
            aria-label="Journal overview"
          >
            <h3 className="journal-section-label">Overview</h3>

            <dl className="journal-metrics">
              <div className="journal-metric">
                <dt>Total entries</dt>
                <dd>{journalOverview.total}</dd>
              </div>

              <div className="journal-metric">
                <dt>This month</dt>
                <dd>{journalOverview.thisMonth}</dd>
              </div>

              {journalOverview.distinctEmotions > 0 && (
                <div className="journal-metric">
                  <dt>Emotions reflected</dt>
                  <dd>{journalOverview.distinctEmotions}</dd>
                </div>
              )}

              {journalOverview.topEmotion && (
                <div className="journal-metric">
                  <dt>Most common</dt>
                  <dd>{displayEmotionLabel(journalOverview.topEmotion)}</dd>
                </div>
              )}
            </dl>
          </motion.section>

          <motion.section
            className="journal-recent"
            variants={DESK_ITEM_VARIANTS}
            aria-label="Recent reflections"
          >
            <h3 className="journal-section-label">Recent reflections</h3>

            <ul className="journal-recent-list">
              {recentJournals.map((journal, index) => (
                <li key={journal.id}>
                  <button
                    type="button"
                    className="journal-recent-item"
                    onClick={() => openRecentEntry(index)}
                  >
                    <span
                      className="journal-recent-emoji"
                      role="img"
                      aria-label="mood"
                    >
                      {journal.mood || "📝"}
                    </span>

                    <span className="journal-recent-text">
                      <span className="journal-recent-title">
                        {journal.title}
                      </span>
                      <span className="journal-recent-meta">
                        <time dateTime={journal.created_at}>
                          {formatDate(journal.created_at)}
                        </time>
                        {journal.emotion && (
                          <span className="journal-emotion-badge">
                            {displayEmotionLabel(journal.emotion)}
                          </span>
                        )}
                      </span>
                    </span>

                    <ChevronRight
                      size={15}
                      className="journal-recent-arrow"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
        </motion.div>
      )}

      {!loading && !error && journals.length === 0 && (
        <p className="journal-home-note">
          Your journal is waiting for its first page.
        </p>
      )}
    </motion.div>
  );

  const renderWrite = () => (
    <motion.div
      key="write"
      className="journal-write"
      variants={BOOK_VIEW_VARIANTS}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {renderSubnav()}

      <div className="journal-book-head">
        <span className="journal-sheet-eyebrow">Today&apos;s Entry</span>
        <h2 className="journal-view-title">
          <time dateTime={diaryDateTime}>{diaryDateLabel}</time>
        </h2>
      </div>

      <div className="journal-book-stage">
        <div className="journal-book journal-book--write">
          <section
            className="journal-leaf journal-leaf--left"
            aria-label="Writing page"
          >
            {savedReflection ? (
              <EntryPaper
                journal={savedReflection}
                eyebrow="Saved entry"
                showTranslated={showTranslatedJournal}
                onToggleTranslation={toggleTranslation}
                footer={
                  <div className="journal-leaf-footer">
                    <button
                      type="button"
                      className="btn btn-ghost btn-compact"
                      onClick={startNewEntry}
                    >
                      <Feather size={14} aria-hidden="true" />
                      Start a New Entry
                    </button>
                  </div>
                }
              />
            ) : (
              <>
                <p className="journal-dear-diary" aria-hidden="true">
                  Dear Diary,
                </p>

                <form onSubmit={handleSave} className="journal-form">
                  <div className="journal-field">
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

                  <div className="journal-field journal-field--grow">
                    <label htmlFor="content">Your thoughts</label>

                    <div className="journal-paper-area">
                      <textarea
                        id="content"
                        ref={contentRef}
                        onSelect={rememberSelection}
                        onClick={rememberSelection}
                        onKeyUp={rememberSelection}
                        name="content"
                        className="journal-paper-textarea"
                        placeholder="Write freely. Your journal is private and secure..."
                        value={form.content}
                        onChange={handleChange}
                        rows={9}
                        required
                      />
                    </div>

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

                  <div className="journal-textarea-tools">
                    <div className="journal-language-select-group">
                      <span className="journal-language-selected">
                        {JOURNAL_LANGUAGES[entryLanguage].shortLabel}
                      </span>

                      <select
                        value={entryLanguage}
                        onChange={(event) => {
                          setEntryLanguage(event.target.value);
                          setKeyboardOpen(false);
                        }}
                        className="journal-language-select"
                        aria-label="Journal language"
                        disabled={isVoiceBusy || submitting}
                      >
                        {Object.entries(JOURNAL_LANGUAGES).map(
                          ([code, language]) => (
                            <option key={code} value={code}>
                              {language.label}
                            </option>
                          )
                        )}
                      </select>

                      <ChevronDown
                        size={12}
                        className="journal-language-select-arrow"
                      />
                    </div>

                    <button
                      type="button"
                      className={`journal-voice-btn journal-voice-btn--${voiceStatus}${
                        voiceStatus === "recording"
                          ? " journal-recording-pulse"
                          : ""
                      }`}
                      onClick={handleVoiceToggle}
                      disabled={
                        submitting || voiceStatus === "processing"
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

                      <span>{VOICE_STATUS_LABELS[voiceStatus]}</span>
                    </button>

                    {entryLanguage !== "en" && (
                      <button type="button" className="journal-voice-btn" aria-expanded={keyboardOpen} aria-controls="journal-indic-keyboard" disabled={isVoiceBusy || submitting} onClick={() => { rememberSelection(); setKeyboardOpen((current) => !current); }}>
                        <Keyboard size={13} aria-hidden="true" /> {keyboardOpen ? "Hide keyboard" : "Keyboard"}
                      </button>
                    )}

                    <span className="char-counter">
                      {characterCount} characters
                    </span>
                  </div>

                  {keyboardOpen && entryLanguage !== "en" && (
                    <div id="journal-indic-keyboard">
                      <IndicVirtualKeyboard language={entryLanguage} disabled={isVoiceBusy || submitting} onInsert={insertKeyboardText} onBackspace={keyboardBackspace} />
                    </div>
                  )}

                  <div className="journal-sheet-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-compact"
                      onClick={() => {
                        setForm({ title: "", content: "" });
                        setEntryLanguage("en");
                        setKeyboardOpen(false);
                        setVoiceError("");
                        setVoiceAudioBlob(null);
                        setNotice(null);
                      }}
                      disabled={submitting || isVoiceBusy}
                    >
                      Clear
                    </button>

                    <motion.button
                      type="submit"
                      className="btn btn-primary btn-compact"
                      disabled={saveDisabled}
                      whileHover={
                        saveDisabled
                          ? undefined
                          : { scale: 1.015, y: -1 }
                      }
                      whileTap={
                        saveDisabled ? undefined : { scale: 0.975 }
                      }
                      transition={{ duration: 0.15 }}
                    >
                      {submitting ? "Saving..." : "Save Entry"}
                    </motion.button>
                  </div>
                </form>
              </>
            )}
          </section>

          <section
            className="journal-leaf journal-leaf--right"
            aria-label="Reflection page"
            aria-live="polite"
          >
            <AnimatePresence mode="wait" initial={false}>
              {savedReflection ? (
                <motion.div
                  key={`reflection-${savedReflection.id ?? "new"}`}
                  className="journal-leaf-fill"
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                >
                  <ReflectionPanel
                    journal={savedReflection}
                    heading="Your Reflection"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  className="journal-leaf-fill journal-placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="journal-placeholder-icon">
                    {submitting ? (
                      <Loader2
                        size={20}
                        className="journal-voice-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Leaf size={20} aria-hidden="true" />
                    )}
                  </span>

                  <span className="journal-sheet-eyebrow">
                    Your Reflection
                  </span>

                  <p>
                    {submitting
                      ? "Reflecting on your entry..."
                      : "Your emotional reflection will appear here after you save this entry."}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </div>
    </motion.div>
  );

  const renderArchiveBody = () => {
    if (loading) {
      return (
        <div className="journal-state-container">
          <div className="loading-spinner" />
          <p>Opening your journal archive...</p>
        </div>
      );
    }

    if (journals.length === 0) {
      return (
        <div className="journal-empty">
          <BookOpen
            size={28}
            className="empty-state-icon"
            aria-hidden="true"
          />
          <h3>Your journal is waiting for its first page.</h3>
          <p>Write today&apos;s entry and it will appear here.</p>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setJournalView("write")}
          >
            <Feather size={15} aria-hidden="true" />
            Write Today&apos;s Entry
          </button>
        </div>
      );
    }

    return (
      <>
        <div className="journal-archive-toolbar">
          <div className="controls-search-wrap">
            <Search size={14} className="search-icon" />

            <input
              type="text"
              placeholder="Search entries..."
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                resetArchivePosition();
              }}
              className="search-input"
              aria-label="Search entries"
            />
          </div>

          <div className="filter-select-group">
            <Filter size={12} className="control-icon" />

            <select
              value={emotionFilter}
              onChange={(event) => {
                setEmotionFilter(event.target.value);
                resetArchivePosition();
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

            <ChevronDown size={12} className="select-arrow" />
          </div>

          <div className="sort-select-group">
            <ArrowUpDown size={12} className="control-icon" />

            <select
              value={dateSort}
              onChange={(event) => {
                setDateSort(event.target.value);
                resetArchivePosition();
              }}
              className="control-select"
              aria-label="Sort entries by date"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>

            <ChevronDown size={12} className="select-arrow" />
          </div>
        </div>

        {!archiveJournal ? (
          <div className="journal-empty">
            <BookOpen
              size={28}
              className="empty-state-icon"
              aria-hidden="true"
            />
            <h3>No reflections found</h3>
            <p>Try clearing your filters.</p>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setSearchText("");
                setEmotionFilter("All");
                resetArchivePosition();
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div
              className="journal-page-turner"
              role="group"
              aria-label="Turn journal pages"
            >
              <button
                type="button"
                className="journal-turn-btn"
                onClick={() => goToArchiveIndex(safeArchiveIndex - 1)}
                disabled={safeArchiveIndex <= 0}
                aria-label="Previous entry"
              >
                <ChevronLeft size={15} aria-hidden="true" />
                Previous
              </button>

              <span className="journal-page-counter" aria-live="polite">
                {safeArchiveIndex + 1} / {processedJournals.length}
              </span>

              <button
                type="button"
                className="journal-turn-btn"
                onClick={() => goToArchiveIndex(safeArchiveIndex + 1)}
                disabled={
                  safeArchiveIndex >= processedJournals.length - 1
                }
                aria-label="Next entry"
              >
                Next
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>

            <div className="journal-book-stage">
              <AnimatePresence
                mode="wait"
                custom={pageDirection}
                initial={false}
              >
                <motion.div
                  key={archiveJournal.id}
                  className="journal-book journal-book--archive"
                  custom={pageDirection}
                  variants={PAGE_TURN_VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <article className="journal-leaf journal-leaf--left">
                    <EntryPaper
                      journal={archiveJournal}
                      eyebrow="Saved entry"
                      showTranslated={showTranslatedJournal}
                      onToggleTranslation={toggleTranslation}
                      footer={
                        <div className="journal-leaf-footer">
                          <span className="journal-page-number">
                            Page {safeArchiveIndex * 2 + 1}
                          </span>

                          <button
                            type="button"
                            className="journal-delete-btn"
                            onClick={(event) =>
                              handleDelete(archiveJournal.id, event)
                            }
                            aria-label="Delete journal entry"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            <span>Delete</span>
                          </button>
                        </div>
                      }
                    />
                  </article>

                  <aside
                    className="journal-leaf journal-leaf--right"
                    aria-label="AI reflection"
                  >
                    <div className="journal-leaf-fill">
                      <ReflectionPanel
                        journal={archiveJournal}
                        heading="AI Reflection"
                      />
                    </div>

                    <div className="journal-leaf-footer journal-leaf-footer--right">
                      <span className="journal-page-number">
                        Page {safeArchiveIndex * 2 + 2}
                      </span>
                    </div>
                  </aside>
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        )}
      </>
    );
  };

  const renderArchive = () => (
    <motion.div
      key="archive"
      className="journal-archive"
      variants={BOOK_VIEW_VARIANTS}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {renderSubnav()}

      <div className="journal-book-head">
        <span className="journal-sheet-eyebrow">Your journal</span>
        <h2 className="journal-view-title">Previous Entries</h2>
      </div>

      {renderArchiveBody()}
    </motion.div>
  );

  const renderStage = () => {
    if (!introDone) return renderCover();
    if (journalView === "write") return renderWrite();
    if (journalView === "archive") return renderArchive();

    return renderHome();
  };

  return (
    <MotionConfig reducedMotion="user">
      <Navbar profile={storedUser} />

      <main id="journal" className="journal-page">
        <div className="container journal-shell">
          {error && (
            <div className="journal-alert journal-alert--error" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div
              className="journal-alert journal-alert--warning"
              role="alert"
            >
              <AlertCircle size={15} />
              <span>{notice}</span>
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

          <div className="journal-stage">
            <AnimatePresence mode="wait">{renderStage()}</AnimatePresence>
          </div>
        </div>
      </main>
    </MotionConfig>
  );
}

export default JournalPage;