import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Send,
  Trash2,
  ShieldAlert,
  Sparkles,
  MessageSquareHeart,
  Plus,
  Menu,
  Mic,
  Square,
  Loader2,
  CheckCircle,
} from "lucide-react";
import Navbar from "../components/Navbar/Navbar";
import {
  getChatHistory,
  sendMessage,
  transcribeChatAudio,
  clearChat,
  deleteSession,
} from "../services/chatService";
import "./Chat.css";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function appendTranscript(existingText, transcriptText) {
  const transcript = transcriptText.trim();

  if (!transcript) return existingText;

  const existing = existingText.trimEnd();

  if (!existing) return transcript;

  return `${existing} ${transcript}`;
}

const VOICE_STATUS_LABELS = {
  idle: "Speak",
  recording: "Listening...",
  processing: "Converting speech...",
  success: "Transcribed",
  error: "Speak",
};

const MAX_RECORDING_MS = 2 * 60 * 1000;

function ChatPage() {
  const [allMessages, setAllMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [inputText, setInputText] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("idle");
  const [voiceError, setVoiceError] = useState("");
  
  // Loading & UI states
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const successTimeoutRef = useRef(null);
  const recordingStartPendingRef = useRef(false);
  const recordingFailedRef = useRef(false);
  const isUnmountingRef = useRef(false);
  const storedUser = getStoredUser();

  // Dynamic grouping logic: takes all messages and groups them by session_id
  const groupMessagesIntoSessions = useCallback((messagesList) => {
    const grouped = {};
    
    // Sort all chronologically first
    const sorted = [...messagesList].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    sorted.forEach((msg) => {
      const sId = msg.session_id || "default";
      if (!grouped[sId]) {
        grouped[sId] = {
          id: sId,
          messages: [],
          title: "",
          date: new Date(msg.created_at),
        };
      }
      grouped[sId].messages.push(msg);
      
      // Determine title from the first user message in this session
      if (!grouped[sId].title && msg.sender === "user") {
        const cleanMsg = msg.message.trim();
        grouped[sId].title = cleanMsg.slice(0, 22) + (cleanMsg.length > 22 ? "..." : "");
      }
    });

    // Provide default titles for sessions without user messages
    Object.values(grouped).forEach((s) => {
      if (!s.title) {
        s.title = "New Conversation";
      }
    });

    return Object.values(grouped);
  }, []);

  // Organize grouped sessions by time: Today, Yesterday, Older
  const categorizedSessions = useMemo(() => {
    const categories = { today: [], yesterday: [], older: [] };
    const todayStr = new Date().toDateString();
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const sortedSessions = [...sessions].sort((a, b) => {
      const aLatest = a.messages[a.messages.length - 1]?.created_at || a.date;
      const bLatest = b.messages[b.messages.length - 1]?.created_at || b.date;
      return new Date(bLatest) - new Date(aLatest);
    });

    sortedSessions.forEach(session => {
      const latestMsg = session.messages[session.messages.length - 1];
      const latestDate = latestMsg ? new Date(latestMsg.created_at) : session.date;
      const dateStr = latestDate.toDateString();

      if (dateStr === todayStr) {
        categories.today.push(session);
      } else if (dateStr === yesterdayStr) {
        categories.yesterday.push(session);
      } else {
        categories.older.push(session);
      }
    });

    return categories;
  }, [sessions]);

  const loadHistory = useCallback(async (selectSessionId = null) => {
    setLoadingHistory(true);
    setError(null);
    try {
      const history = await getChatHistory();
      setAllMessages(history || []);
      
      const groupedSessions = groupMessagesIntoSessions(history || []);
      setSessions(groupedSessions);
      
      if (selectSessionId) {
        setActiveSessionId(selectSessionId);
      } else if (groupedSessions.length > 0 && !activeSessionId) {
        setActiveSessionId(groupedSessions[0].id);
      }
    } catch (err) {
      console.error("Unable to load chat history", err);
      setError("Failed to load chat history. Please try reloading.");
    } finally {
      setLoadingHistory(false);
    }
  }, [activeSessionId, groupMessagesIntoSessions]);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    isUnmountingRef.current = false;

    return () => {
      isUnmountingRef.current = true;

      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }

      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }

      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }

      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [allMessages, activeSessionId, sending]);

  // Autogrow textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const message = inputText.trim();
    if (
      !message ||
      sending ||
      voiceStatus === "recording" ||
      voiceStatus === "processing"
    ) {
      return;
    }

    setInputText("");
    setSending(true);
    setError(null);

    // Optimistically add user message to list to show immediate typing response
    const tempMsgId = `temp-user-${Date.now()}`;
    const targetSessionId = activeSessionId; 

    const tempUserMsg = {
      id: tempMsgId,
      sender: "user",
      message: message,
      session_id: targetSessionId,
      created_at: new Date().toISOString(),
    };
    
    setAllMessages((prev) => [...prev, tempUserMsg]);

    try {
      const response = await sendMessage(message, targetSessionId);
      
      setAllMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempMsgId);
        return [
          ...filtered,
          {
            id: `usr-${Date.now()}`,
            sender: "user",
            message: message,
            session_id: response.sessionId,
            created_at: new Date().toISOString(),
          },
          {
            id: response.id,
            sender: "ai",
            message: response.message,
            is_crisis: response.isCrisis,
            session_id: response.sessionId,
            created_at: response.created_at,
          }
        ];
      });

      const updatedHistory = await getChatHistory();
      setAllMessages(updatedHistory);
      const groupedSessions = groupMessagesIntoSessions(updatedHistory);
      setSessions(groupedSessions);
      
      if (!targetSessionId || targetSessionId !== response.sessionId) {
        setActiveSessionId(response.sessionId);
      }
    } catch (err) {
      console.error("Error sending message", err);
      setError("Failed to send message. Please check your connection.");
      setAllMessages((prev) => prev.filter((m) => m.id !== tempMsgId));
    } finally {
      setSending(false);
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
      setVoiceError("No speech was detected. Please try again.");
      return;
    }

    const audioBlob = new Blob(chunks, {
      type: chunks[0]?.type || "audio/webm",
    });

    if (audioBlob.size <= 0) {
      setVoiceStatus("error");
      setVoiceError("No speech was detected. Please try again.");
      return;
    }

    setVoiceStatus("processing");
    setVoiceError("");

    try {
      const transcript = await transcribeChatAudio(audioBlob);
      const text = transcript?.text?.trim();

      if (!text) {
        setVoiceStatus("error");
        setVoiceError("No speech was detected. Please try again.");
        return;
      }

      setInputText((prev) => appendTranscript(prev, text));
      setVoiceStatus("success");
      textareaRef.current?.focus();

      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }

      successTimeoutRef.current = window.setTimeout(() => {
        setVoiceStatus((current) => (current === "success" ? "idle" : current));
        successTimeoutRef.current = null;
      }, 2500);
    } catch (err) {
      console.error("Chat transcription failed:", err);

      const status = err.response?.status;
      const serverMessage =
        err.response?.data?.message || err.response?.data?.error || "";

      setVoiceStatus("error");

      if (status === 413) {
        setVoiceError("Recording is too large. Please record a shorter message.");
      } else if (status === 422 || /empty transcript|No speech/i.test(serverMessage)) {
        setVoiceError("No speech was detected. Please try again.");
      } else if (status === 400) {
        setVoiceError("Unable to convert your speech. Please try again.");
      } else if (!err.response) {
        setVoiceError("Unable to connect to the transcription service. Please try again.");
      } else {
        setVoiceError("Unable to convert your speech. Please try again.");
      }
    }
  };

  const handleVoiceToggle = async () => {
    if (voiceStatus === "recording") {
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }

      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    if (
      voiceStatus === "processing" ||
      sending ||
      loadingHistory ||
      recordingStartPendingRef.current
    ) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceStatus("error");
      setVoiceError(
        "Voice input is not supported in this browser. Please type your message instead."
      );
      return;
    }

    try {
      recordingStartPendingRef.current = true;
      recordingFailedRef.current = false;
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
        recordingFailedRef.current = true;
        setVoiceStatus("error");
        setVoiceError("An error occurred while recording. Please try again.");
        stopRecordingTracks();
      };

      recorder.onstop = async () => {
        if (recordingTimeoutRef.current) {
          clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }

        stopRecordingTracks();

        if (isUnmountingRef.current) return;
        if (recordingFailedRef.current) return;

        await processRecording();
      };

      mediaRecorderRef.current = recorder;

      recorder.start();
      recordingStartPendingRef.current = false;
      setVoiceStatus("recording");

      recordingTimeoutRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, MAX_RECORDING_MS);
    } catch (err) {
      recordingStartPendingRef.current = false;
      stopRecordingTracks();

      setVoiceStatus("error");
      setVoiceError(
        err?.name === "NotAllowedError" ||
          err?.name === "PermissionDeniedError"
          ? "Microphone permission was denied. Please allow microphone access or type your message instead."
          : "Unable to access your microphone. Please try again or type your message instead."
      );
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStartNewChat = () => {
    setActiveSessionId(null); 
    setMobileSidebarOpen(false);
  };

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;

    try {
      await deleteSession(sessionId);
      const updatedMessages = allMessages.filter(m => m.session_id !== sessionId);
      setAllMessages(updatedMessages);
      
      const remainingSessions = groupMessagesIntoSessions(updatedMessages);
      setSessions(remainingSessions);

      if (activeSessionId === sessionId) {
        setActiveSessionId(remainingSessions.length > 0 ? remainingSessions[0].id : null);
      }
    } catch (err) {
      console.error("Error deleting session", err);
      setError("Failed to delete conversation.");
    }
  };

  const handleClearAllHistory = async () => {
    if (!window.confirm("Are you sure you want to delete ALL chat sessions? This cannot be undone.")) return;

    setError(null);
    try {
      await clearChat();
      setAllMessages([]);
      setSessions([]);
      setActiveSessionId(null);
    } catch (err) {
      console.error("Error clearing chat history", err);
      setError("Failed to clear chat history.");
    }
  };

  const formatTime = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "";
    }
  };

  const activeMessages = allMessages.filter(m => m.session_id === activeSessionId);
  const isVoiceBusy =
    voiceStatus === "recording" ||
    voiceStatus === "processing";

  // Render a single category section inside the sidebar history list
  const renderCategory = (title, categorySessions) => {
    if (categorySessions.length === 0) return null;
    return (
      <div className="sidebar-category-section">
        <span className="sidebar-section-title">{title}</span>
        {categorySessions.map((s) => (
          <div
            key={s.id}
            className={`chat-session-item ${activeSessionId === s.id ? "chat-session-item--active" : ""}`}
            onClick={() => {
              setActiveSessionId(s.id);
              setMobileSidebarOpen(false);
            }}
          >
            <MessageSquareHeart size={14} className="chat-session-icon" />
            <span className="chat-session-title">{s.title}</span>
            <button
              type="button"
              className="chat-session-delete"
              onClick={(e) => handleDeleteSession(s.id, e)}
              aria-label="Delete conversation"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Navbar profile={storedUser} />
      <main id="chat" className="chat-page">
        <div className="container chat-layout-container">
          <div className="chat-grid-wrapper">
            
            {/* 1. SIDEBAR (Conversation History) */}
            <aside className={`chat-sidebar-wrapper ${mobileSidebarOpen ? "chat-sidebar-wrapper--open" : ""}`}>
              <div className="chat-sidebar-header">
                <button type="button" className="btn btn-ghost new-chat-btn" onClick={handleStartNewChat}>
                  <Plus size={14} />
                  <span>New Chat</span>
                </button>
              </div>

              <div className="chat-sidebar-sessions-list">
                {sessions.length === 0 ? (
                  <p className="no-conversations-text">No conversations yet</p>
                ) : (
                  <>
                    {renderCategory("Today", categorizedSessions.today)}
                    {renderCategory("Yesterday", categorizedSessions.yesterday)}
                    {renderCategory("Older", categorizedSessions.older)}
                  </>
                )}
              </div>

              {sessions.length > 0 && (
                <div className="chat-sidebar-footer">
                  <button type="button" className="sidebar-clear-all-btn" onClick={handleClearAllHistory}>
                    <Trash2 size={13} />
                    <span>Clear all chats</span>
                  </button>
                </div>
              )}
            </aside>

            {/* Mobile Sidebar Overlay */}
            {mobileSidebarOpen && (
              <div className="chat-sidebar-overlay" onClick={() => setMobileSidebarOpen(false)} />
            )}

            {/* 2. CHAT AREA */}
            <div className="dashboard-card chat-box">
              {/* Chat Header */}
              <div className="chat-box-header">
                <div className="chat-header-info">
                  {/* Mobile menu toggle */}
                  <button
                    type="button"
                    className="mobile-sidebar-toggle"
                    onClick={() => setMobileSidebarOpen(true)}
                    aria-label="Open conversation history"
                  >
                    <Menu size={18} />
                  </button>

                  <div className="ai-status-indicator">
                    <Sparkles size={14} />
                  </div>
                  <div>
                    <h2>MindEase AI</h2>
                    <p>Empathetic guidance & support space</p>
                  </div>
                </div>

                {activeSessionId && activeMessages.length > 0 && (
                  <button
                    type="button"
                    className="chat-clear-btn"
                    onClick={(e) => handleDeleteSession(activeSessionId, e)}
                    title="Delete current conversation"
                    aria-label="Delete current conversation"
                  >
                    <Trash2 size={14} />
                    <span>Delete Chat</span>
                  </button>
                )}
              </div>

              {/* Error banner */}
              {error && (
                <div className="chat-error-banner" role="alert">
                  <span>{error}</span>
                  <button type="button" onClick={() => loadHistory(activeSessionId)} className="chat-retry-btn">Retry</button>
                </div>
              )}

              {/* Messages Body */}
              <div className="chat-messages-body">
                {loadingHistory ? (
                  <div className="chat-loading-state">
                    <div className="chat-spinner" />
                    <p>Opening your safe space...</p>
                  </div>
                ) : activeMessages.length === 0 ? (
                  <div className="chat-empty-state">
                    <div className="chat-empty-icon-wrap">
                      <MessageSquareHeart size={28} />
                    </div>
                    <h3>Here to listen</h3>
                    <p className="chat-empty-intro">
                      Your conversation is private. You can write about your day, tell me what&apos;s stressing you, or just talk.
                    </p>
                    
                    {/* Initial greeting bubble */}
                    <div className="chat-message chat-message--ai chat-message--greeting">
                      <div className="message-bubble">
                        <p>Hi! I&apos;m here to listen. How are you feeling today?</p>
                        <time className="message-time">Just now</time>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="messages-list">
                    {/* Initial greeting bubble */}
                    <div className="chat-message chat-message--ai chat-message--greeting">
                      <div className="message-bubble">
                        <p>Hi! I&apos;m here to listen. How are you feeling today?</p>
                        <time className="message-time">Start of session</time>
                      </div>
                    </div>

                    {activeMessages.map((msg) => {
                      const isAi = msg.sender === "ai";
                      const isCrisis = msg.is_crisis || false;
                      return (
                        <div
                          key={msg.id}
                          className={`chat-message ${isAi ? "chat-message--ai" : "chat-message--user"} ${
                            isCrisis ? "chat-message--crisis" : ""
                          }`}
                        >
                          <div className="message-bubble">
                            {isCrisis ? (
                              /* Compact Safety Card inside bubble */
                              <div className="crisis-safety-card">
                                <div className="crisis-safety-header">
                                  <ShieldAlert size={14} className="safety-alert-icon" />
                                  <span>Support is available</span>
                                </div>
                                <p className="safety-instruction">
                                  If you&apos;re in immediate danger, contact emergency services at <strong>112</strong>.
                                </p>
                                <div className="safety-helpline-box">
                                  <span>Tele-MANAS</span>
                                  <strong>14416 / 1-800-891-4416</strong>
                                </div>
                                <p className="safety-footer-text">
                                  You can also reach someone you trust or a mental-health professional.
                                </p>
                              </div>
                            ) : (
                              <p className="message-text-content">{msg.message}</p>
                            )}
                            <time className="message-time">{formatTime(msg.created_at)}</time>
                          </div>
                        </div>
                      );
                    })}

                    {/* Sending/Typing loading bubble */}
                    {sending && (
                      <div className="chat-message chat-message--ai chat-message--typing">
                        <div className="message-bubble">
                          <div className="typing-dots">
                            <span />
                            <span />
                            <span />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Composer input block */}
              <div className="chat-input-area">
                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="chat-input-form">
                  <div className="chat-composer-container">
                    <textarea
                      ref={textareaRef}
                      placeholder={
                        sending
                          ? "MindEase is reflecting..."
                          : voiceStatus === "processing"
                            ? "Converting speech..."
                            : "Type your message here..."
                      }
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={sending || loadingHistory}
                      maxLength={500}
                      rows={1}
                      className="chat-textarea"
                      required
                    />
                    <button
                      type="button"
                      className={`chat-voice-btn chat-voice-btn--${voiceStatus}`}
                      onClick={handleVoiceToggle}
                      disabled={sending || loadingHistory || voiceStatus === "processing"}
                      aria-label={
                        voiceStatus === "recording"
                          ? "Stop recording"
                          : "Start voice input"
                      }
                      title={
                        voiceStatus === "recording"
                          ? "Stop recording"
                          : "Start voice input"
                      }
                    >
                      {voiceStatus === "recording" ? (
                        <Square size={14} />
                      ) : voiceStatus === "processing" ? (
                        <Loader2 size={14} className="chat-voice-spin" />
                      ) : voiceStatus === "success" ? (
                        <CheckCircle size={14} />
                      ) : (
                        <Mic size={14} />
                      )}
                      <span>{VOICE_STATUS_LABELS[voiceStatus]}</span>
                    </button>
                    <button
                      type="submit"
                      className="chat-submit-btn"
                      disabled={sending || isVoiceBusy || !inputText.trim() || loadingHistory}
                      aria-label="Send message"
                    >
                      <Send size={15} />
                    </button>
                  </div>
                  {voiceError && (
                    <p className="chat-voice-message chat-voice-message--error">
                      {voiceError}
                    </p>
                  )}
                  {voiceStatus === "processing" && (
                    <p className="chat-voice-message">
                      Converting speech to editable chat text...
                    </p>
                  )}
                </form>
              </div>
            </div>
            
          </div>
        </div>
      </main>
    </>
  );
}

export default ChatPage;
