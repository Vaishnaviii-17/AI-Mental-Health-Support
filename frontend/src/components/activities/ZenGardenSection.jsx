import { useState, useEffect, useRef, useCallback } from "react";
import {
  Leaf,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Waves,
  CircleDot,
  PenTool,
  Eye,
  Hand,
  CheckCircle2,
  Clock3,
  Calendar
} from "lucide-react";
import { SHARED_AUDIO_TRACKS } from "../../pages/activities/audioTracks";
import "./ZenGardenSection.css";

// Formatter helpers
function formatMinutes(seconds) {
  if (!seconds || seconds <= 0) return "0 min";
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

function formatHoursAndMinutes(seconds) {
  if (!seconds || seconds <= 0) return "0 min";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins === 0 ? `${hrs}h` : `${hrs}h ${remainingMins}m`;
}

// 4 Nature sounds specifically well-suited for Zen meditation
const ZEN_AUDIO_OPTIONS = [
  { id: "forest", label: "Forest & Water", track: SHARED_AUDIO_TRACKS.find(t => t.id === "forest") },
  { id: "stream", label: "Flowing Stream", track: SHARED_AUDIO_TRACKS.find(t => t.id === "stream") },
  { id: "rain", label: "Soft Rain", track: SHARED_AUDIO_TRACKS.find(t => t.id === "rain") },
  { id: "waves", label: "Ocean Waves", track: SHARED_AUDIO_TRACKS.find(t => t.id === "waves") }
].filter(o => Boolean(o.track));

// Growth stage details based on overall.garden.gardenLevel (0 to 4)
const STAGE_DETAILS = [
  {
    level: 0,
    name: "Seed Sanctuary",
    subtitle: "A quiet seed resting in combed white sand",
    unlockedItems: ["Smooth River Stones", "Natural Sand Rake"],
    nextGoal: "Complete 1 activity to sprout",
    iconColor: "#94a3b8"
  },
  {
    level: 1,
    name: "Green Sprout",
    subtitle: "A tender shoot rising with renewed ease",
    unlockedItems: ["River Stones", "Moss Clusters", "Sprout"],
    nextGoal: "Complete 4 more activities to grow",
    iconColor: "#4ade80"
  },
  {
    level: 2,
    name: "Young Plant",
    subtitle: "Branching leaves and stepping stone path",
    unlockedItems: ["Moss Rocks", "Stepping Stones", "Leafy Stems"],
    nextGoal: "Complete 5 more activities to blossom",
    iconColor: "#22c55e"
  },
  {
    level: 3,
    name: "Flowering Plant",
    subtitle: "Blooming petals and branching leaves in full colour",
    unlockedItems: ["Blossom Flower", "Full Branching Leaves", "Stepping Stones"],
    nextGoal: "Complete 10 more activities for full bloom",
    iconColor: "#15803d"
  },
  {
    level: 4,
    name: "Flourishing Garden",
    subtitle: "Full blossom sanctuary visited by golden butterflies",
    unlockedItems: ["Full Bloom Lotus", "Golden Butterflies", "Stone Lantern", "Falling Petals"],
    nextGoal: "Garden in full bloom! Keep nurturing your practice.",
    iconColor: "#b45309"
  }
];

export default function ZenGardenSection({ overall, loading, error, onRetry }) {
  // Current active mode: 'visual' (Sanctuary Scene) | 'interactive' (Sand Raking Canvas)
  const [activeTab, setActiveTab] = useState("visual");

  // Selected tool for sand drawing: 'rake' | 'waves' | 'spiral' | 'lines'
  const [selectedTool, setSelectedTool] = useState("rake");

  // Audio state (strictly OFF by default)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [selectedAudioId, setSelectedAudioId] = useState("forest");
  const [audioVolume, setAudioVolume] = useState(0.35);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const audioInstanceRef = useRef(null);

  // Canvas drawing state
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const ripplesRef = useRef([]);
  const animFrameIdRef = useRef(null);

  // Growth stage level (fallback to 0)
  const gardenLevel = overall?.garden?.gardenLevel ?? 0;
  const currentStageInfo = STAGE_DETAILS[Math.min(gardenLevel, 4)];

  // -------------------------------------------------------------------------
  // Audio Lifecycle & Cleanup
  // -------------------------------------------------------------------------
  const stopAudio = useCallback(() => {
    if (audioInstanceRef.current) {
      try {
        audioInstanceRef.current.pause();
        audioInstanceRef.current.currentTime = 0;
      } catch (_) {}
    }
    setIsAudioPlaying(false);
  }, []);

  const toggleSound = useCallback(() => {
    if (isAudioPlaying) {
      stopAudio();
      return;
    }

    const option = ZEN_AUDIO_OPTIONS.find(o => o.id === selectedAudioId) || ZEN_AUDIO_OPTIONS[0];
    if (!option?.track?.src) return;

    if (!audioInstanceRef.current) {
      audioInstanceRef.current = new Audio();
      audioInstanceRef.current.loop = true;
    }

    const audio = audioInstanceRef.current;
    audio.src = option.track.src;
    audio.volume = isAudioMuted ? 0 : audioVolume;
    audio.play()
      .then(() => setIsAudioPlaying(true))
      .catch(err => {
        console.warn("Zen Garden audio play prevented:", err.message);
        setIsAudioPlaying(false);
      });
  }, [isAudioPlaying, selectedAudioId, isAudioMuted, audioVolume, stopAudio]);

  const handleTrackChange = (newId) => {
    setSelectedAudioId(newId);
    if (isAudioPlaying) {
      const option = ZEN_AUDIO_OPTIONS.find(o => o.id === newId);
      if (option?.track?.src && audioInstanceRef.current) {
        audioInstanceRef.current.pause();
        audioInstanceRef.current.src = option.track.src;
        audioInstanceRef.current.volume = isAudioMuted ? 0 : audioVolume;
        audioInstanceRef.current.play().catch(() => {});
      }
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setAudioVolume(val);
    if (isAudioMuted && val > 0) setIsAudioMuted(false);
    if (audioInstanceRef.current) {
      audioInstanceRef.current.volume = isAudioMuted ? 0 : val;
    }
  };

  const toggleMute = () => {
    setIsAudioMuted(prev => {
      const next = !prev;
      if (audioInstanceRef.current) {
        audioInstanceRef.current.volume = next ? 0 : audioVolume;
      }
      return next;
    });
  };

  // Clean up audio on unmount to prevent sound leaks
  useEffect(() => {
    return () => {
      if (audioInstanceRef.current) {
        audioInstanceRef.current.pause();
        audioInstanceRef.current.src = "";
        audioInstanceRef.current = null;
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // Interactive Sand Canvas
  // -------------------------------------------------------------------------
  const drawBaseSand = useCallback((ctx, width, height) => {
    // 1. Warm sand background
    ctx.fillStyle = "#f5eee1";
    ctx.fillRect(0, 0, width, height);

    // 2. Combed baseline rake grooves (peaceful horizontal ripples)
    ctx.strokeStyle = "rgba(209, 196, 175, 0.4)";
    ctx.lineWidth = 1.5;
    for (let y = 14; y < height; y += 14) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= width; x += 20) {
        const wave = Math.sin(x * 0.02) * 2;
        ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }

    // 3. Natural smooth river cairn stones in bottom-left
    const drawStone = (cx, cy, rx, ry, col, shadowCol) => {
      ctx.save();
      ctx.shadowColor = "rgba(40, 30, 20, 0.15)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Stone highlight
      ctx.fillStyle = shadowCol;
      ctx.beginPath();
      ctx.ellipse(cx - 3, cy - 3, rx * 0.6, ry * 0.5, 0.1, 0, Math.PI * 2);
      ctx.fill();
    };

    drawStone(60, height - 55, 34, 22, "#78716c", "#a8a29e");
    drawStone(110, height - 45, 24, 16, "#57534e", "#78716c");
    drawStone(80, height - 75, 18, 12, "#a8a29e", "#d6d3d1");

    // 4. Subtle moss patch around stones
    ctx.fillStyle = "rgba(101, 163, 13, 0.35)";
    ctx.beginPath();
    ctx.arc(40, height - 45, 12, 0, Math.PI * 2);
    ctx.arc(130, height - 40, 10, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  // Initialize canvas when entering interactive mode
  useEffect(() => {
    if (activeTab !== "interactive") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI crispness
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    drawBaseSand(ctx, rect.width, rect.height);

    // Ripple rendering loop
    const renderLoop = () => {
      if (ripplesRef.current.length > 0) {
        ctx.save();
        ripplesRef.current.forEach(r => {
          r.radius += 0.8;
          r.alpha -= 0.015;
          if (r.alpha > 0) {
            ctx.strokeStyle = `rgba(180, 160, 135, ${r.alpha})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.stroke();
          }
        });
        ripplesRef.current = ripplesRef.current.filter(r => r.alpha > 0);
        ctx.restore();
      }
      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [activeTab, drawBaseSand]);

  // Pointer event handlers for drawing
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e) => {
    // Only respond to primary click / touch
    if (e.button && e.button !== 0) return;
    isDrawingRef.current = true;
    const pt = getCanvasCoords(e);
    lastPointRef.current = pt;

    // A simple tap creates a soft ripple
    ripplesRef.current.push({
      x: pt.x,
      y: pt.y,
      radius: 4,
      alpha: 0.7
    });

    // If Spiral tool is selected, draw spiral immediately on click
    if (selectedTool === "spiral") {
      drawSpiral(pt.x, pt.y);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const pt = getCanvasCoords(e);
    const prev = lastPointRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();

    if (selectedTool === "rake") {
      // 5-prong circular rake furrow
      const numProngs = 5;
      const spacing = 5;
      const dx = pt.x - prev.x;
      const dy = pt.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        const nx = -dy / dist;
        const ny = dx / dist;

        for (let i = -2; i <= 2; i++) {
          const off = i * spacing;
          ctx.strokeStyle = "rgba(180, 162, 138, 0.65)";
          ctx.lineWidth = 2.5;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(prev.x + nx * off, prev.y + ny * off);
          ctx.lineTo(pt.x + nx * off, pt.y + ny * off);
          ctx.stroke();

          // Subtle groove highlight
          ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(prev.x + nx * off - 1, prev.y + ny * off - 1);
          ctx.lineTo(pt.x + nx * off - 1, pt.y + ny * off - 1);
          ctx.stroke();
        }
      }
    } else if (selectedTool === "waves") {
      // Flowing wavy grooves
      const numLines = 3;
      const spacing = 7;
      const dx = pt.x - prev.x;
      const dy = pt.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        const nx = -dy / dist;
        const ny = dx / dist;
        for (let i = -1; i <= 1; i++) {
          const off = i * spacing;
          ctx.strokeStyle = "rgba(168, 149, 124, 0.7)";
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(prev.x + nx * off, prev.y + ny * off);
          ctx.lineTo(pt.x + nx * off, pt.y + ny * off);
          ctx.stroke();
        }
      }
    } else if (selectedTool === "lines") {
      // Gentle single meditative rake line
      ctx.strokeStyle = "rgba(175, 155, 129, 0.75)";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(prev.x - 1, prev.y - 1);
      ctx.lineTo(pt.x - 1, pt.y - 1);
      ctx.stroke();
    }

    ctx.restore();
    lastPointRef.current = pt;
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const drawSpiral = (cx, cy) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.strokeStyle = "rgba(175, 155, 129, 0.7)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const coils = 3.5;
    const maxRadius = 36;
    for (let theta = 0; theta < coils * 2 * Math.PI; theta += 0.15) {
      const r = (theta / (coils * 2 * Math.PI)) * maxRadius;
      const x = cx + r * Math.cos(theta);
      const y = cy + r * Math.sin(theta);
      if (theta === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  };

  const handleResetCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ripplesRef.current = [];
    drawBaseSand(ctx, rect.width, rect.height);
  };

  return (
    <div className="zen-garden-wrapper">
      
      {/* -------------------------------------------------------------------- */}
      {/* SECTION HEADER & VIEW TOGGLES                                        */}
      {/* -------------------------------------------------------------------- */}
      <div className="zen-garden-header-bar">
        <div className="zen-header-titles">
          <span className="eyebrow eyebrow-zen">
            <Leaf size={13} className="zen-leaf-icon" /> MindEase Sanctuary
          </span>
          <h2 className="zen-garden-heading">Zen Garden</h2>
        </div>

        {/* Mode Switcher: Sanctuary Visual vs. Interactive Sand Rake */}
        <div className="zen-mode-pills" role="tablist" aria-label="Zen Garden View Modes">
          <button
            type="button"
            className={`zen-mode-pill ${activeTab === "visual" ? "is-active" : ""}`}
            onClick={() => setActiveTab("visual")}
            role="tab"
            aria-selected={activeTab === "visual"}
          >
            <Eye size={14} />
            <span>Sanctuary View</span>
          </button>
          <button
            type="button"
            className={`zen-mode-pill ${activeTab === "interactive" ? "is-active" : ""}`}
            onClick={() => setActiveTab("interactive")}
            role="tab"
            aria-selected={activeTab === "interactive"}
          >
            <Hand size={14} />
            <span>Interactive Sand Rake</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* AMBIENT SOUND BAR (OFF by default)                                   */}
      {/* -------------------------------------------------------------------- */}
      <div className="zen-sound-bar">
        <div className="zen-sound-controls">
          <button
            type="button"
            onClick={toggleSound}
            className={`zen-sound-toggle-btn ${isAudioPlaying ? "is-playing" : ""}`}
            aria-label={isAudioPlaying ? "Stop garden sound" : "Play calming garden sound"}
            title={isAudioPlaying ? "Turn sound off" : "Play ambient nature sound"}
          >
            {isAudioPlaying ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>{isAudioPlaying ? "Sound Playing" : "Zen Sound: Off"}</span>
          </button>

          {/* Track selector dropdown */}
          <select
            className="zen-sound-select"
            value={selectedAudioId}
            onChange={(e) => handleTrackChange(e.target.value)}
            aria-label="Select Zen Garden ambient track"
          >
            {ZEN_AUDIO_OPTIONS.map(opt => (
              <option key={opt.id} value={opt.id}>
                {opt.track?.emoji} {opt.label}
              </option>
            ))}
          </select>

          {/* Volume slider (only visible when sound enabled) */}
          {isAudioPlaying && (
            <div className="zen-volume-group">
              <button
                type="button"
                onClick={toggleMute}
                className="zen-vol-icon-btn"
                aria-label={isAudioMuted ? "Unmute audio" : "Mute audio"}
              >
                {isAudioMuted || audioVolume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isAudioMuted ? 0 : audioVolume}
                onChange={handleVolumeChange}
                className="zen-vol-range"
                aria-label="Garden sound volume"
                title={`Volume: ${Math.round((isAudioMuted ? 0 : audioVolume) * 100)}%`}
              />
            </div>
          )}
        </div>

        <span className="zen-sound-tip">
          🎧 Optional background nature sound · OFF by default
        </span>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* MAIN CARD CONTAINER                                                  */}
      {/* -------------------------------------------------------------------- */}
      <div className="dashboard-card zen-garden-card">
        
        {loading ? (
          <div className="zen-loading-state">
            <Leaf size={28} className="zen-pulse-icon" />
            <p>Cultivating your Zen Garden...</p>
          </div>
        ) : error ? (
          <div className="zen-error-state">
            <p>Unable to load garden progress at this moment.</p>
            <button type="button" onClick={onRetry} className="btn btn-ghost btn-retry">
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* ============================================================== */}
            {/* VIEW A: SANCTUARY SCENE (PART B)                               */}
            {/* ============================================================== */}
            {activeTab === "visual" && (
              <div className="zen-sanctuary-layout">
                
                {/* Visual Scene Canvas / SVG with Sand, Stones, Pond, and Plant */}
                <div className="zen-scene-col">
                  <div className="zen-scene-canvas-container">
                    
                    {/* SVG Garden Illustration */}
                    <svg
                      viewBox="0 0 320 240"
                      className="zen-garden-scene-svg"
                      role="img"
                      aria-label={`Zen Garden stage: ${currentStageInfo.name}. ${currentStageInfo.subtitle}`}
                    >
                      <defs>
                        {/* Sand rake texture pattern */}
                        <pattern id="sandGrooves" width="20" height="12" patternUnits="userSpaceOnUse">
                          <path d="M 0,6 Q 10,2 20,6" fill="none" stroke="#d5c8b2" strokeWidth="1.2" opacity="0.6" />
                        </pattern>

                        {/* Soft water gradient */}
                        <radialGradient id="waterGrad" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.8" />
                          <stop offset="70%" stopColor="#60a5fa" stopOpacity="0.6" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4" />
                        </radialGradient>
                      </defs>

                      {/* 1. Base Zen Sand Box */}
                      <rect x="10" y="10" width="300" height="220" rx="18" fill="#f8f3ea" stroke="#dcd3c1" strokeWidth="2" />
                      <rect x="18" y="18" width="284" height="204" rx="12" fill="url(#sandGrooves)" />

                      {/* Concentric raked sand rings around center */}
                      <ellipse cx="160" cy="155" rx="70" ry="32" fill="none" stroke="#cfc1a9" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.7" />
                      <ellipse cx="160" cy="155" rx="90" ry="42" fill="none" stroke="#cfc1a9" strokeWidth="1.2" strokeDasharray="5,4" opacity="0.5" />

                      {/* 2. Stepping Stones (Unlocked at Level 2+) */}
                      {gardenLevel >= 2 && (
                        <g className="zen-stepping-stones" opacity="0.95">
                          <ellipse cx="65" cy="180" rx="16" ry="10" fill="#78716c" />
                          <ellipse cx="63" cy="178" rx="12" ry="7" fill="#a8a29e" />

                          <ellipse cx="95" cy="160" rx="14" ry="9" fill="#57534e" />
                          <ellipse cx="93" cy="158" rx="10" ry="6" fill="#78716c" />

                          <ellipse cx="120" cy="140" rx="13" ry="8" fill="#78716c" />
                          <ellipse cx="118" cy="138" rx="9" ry="5" fill="#a8a29e" />
                        </g>
                      )}

                      {/* 3. Smooth River Cairn Stones (Level 0+) */}
                      <g className="zen-cairn-stones">
                        <ellipse cx="250" cy="175" rx="26" ry="16" fill="#57534e" />
                        <ellipse cx="248" cy="173" rx="20" ry="12" fill="#78716c" />

                        <ellipse cx="252" cy="156" rx="18" ry="11" fill="#78716c" />
                        <ellipse cx="250" cy="154" rx="14" ry="8" fill="#a8a29e" />

                        <ellipse cx="251" cy="142" rx="12" ry="7" fill="#a8a29e" />
                        <ellipse cx="250" cy="141" rx="8" ry="4" fill="#d6d3d1" />
                      </g>

                      {/* Moss Clusters (Unlocked at Level 1+) */}
                      {gardenLevel >= 1 && (
                        <g className="zen-moss-patches">
                          <ellipse cx="230" cy="182" rx="10" ry="6" fill="#65a30d" opacity="0.75" />
                          <ellipse cx="272" cy="178" rx="9" ry="5" fill="#4d7c0f" opacity="0.8" />
                          <ellipse cx="242" cy="190" rx="8" ry="4" fill="#84cc16" opacity="0.7" />
                        </g>
                      )}

                      {/* 4. Living Plant in Center (Evolves with Level) */}
                      {/* --- Level 0: Seed --- */}
                      {gardenLevel === 0 && (
                        <g className="zen-plant-stage-0">
                          {/* Rich soil mound */}
                          <ellipse cx="160" cy="155" rx="32" ry="14" fill="#713f12" opacity="0.4" />
                          <ellipse cx="160" cy="153" rx="24" ry="10" fill="#5c330e" />
                          {/* Golden Seed */}
                          <ellipse cx="160" cy="150" rx="8" ry="5" fill="#ca8a04" />
                          <ellipse cx="160" cy="149" rx="4" ry="2.5" fill="#fef08a" />
                          <text x="160" y="132" textAnchor="middle" fontSize="10" fill="#854d0e" fontWeight="700">
                            Seed Resting
                          </text>
                        </g>
                      )}

                      {/* --- Level 1: Green Sprout --- */}
                      {gardenLevel === 1 && (
                        <g className="zen-plant-stage-1">
                          <ellipse cx="160" cy="155" rx="28" ry="11" fill="#5c330e" />
                          {/* Curved stem */}
                          <path d="M 160,152 Q 157,125 160,105" stroke="#4ade80" strokeWidth="4.5" strokeLinecap="round" fill="none" />
                          {/* Two fresh oval leaves */}
                          <path d="M 160,105 Q 175,98 172,112 Q 160,112 160,105" fill="#22c55e" />
                          <path d="M 160,105 Q 145,96 148,110 Q 160,110 160,105" fill="#22c55e" />
                        </g>
                      )}

                      {/* --- Level 2: Young Plant --- */}
                      {gardenLevel === 2 && (
                        <g className="zen-plant-stage-2">
                          <ellipse cx="160" cy="155" rx="32" ry="12" fill="#5c330e" />
                          {/* Main Stem */}
                          <path d="M 160,152 Q 155,115 160,82" stroke="#22c55e" strokeWidth="5.5" strokeLinecap="round" fill="none" />
                          {/* Branching leaves */}
                          <path d="M 158,128 Q 138,120 142,135 Q 158,135 158,128" fill="#16a34a" />
                          <path d="M 160,118 Q 182,110 178,126 Q 160,126 160,118" fill="#16a34a" />
                          <path d="M 159,98 Q 140,88 144,104 Q 159,104 159,98" fill="#22c55e" />
                          <path d="M 160,82 Q 176,70 172,86 Q 160,86 160,82" fill="#22c55e" />
                        </g>
                      )}

                      {/* --- Level 3: Flowering Plant --- */}
                      {gardenLevel === 3 && (
                        <g className="zen-plant-stage-3">
                          <ellipse cx="160" cy="155" rx="36" ry="13" fill="#5c330e" />
                          {/* Stems */}
                          <path d="M 160,152 Q 154,100 160,65" stroke="#16a34a" strokeWidth="6" strokeLinecap="round" fill="none" />
                          {/* Side leaves */}
                          <path d="M 158,128 Q 132,120 138,138 Q 158,136 158,128" fill="#15803d" />
                          <path d="M 161,118 Q 188,110 182,128 Q 161,126 161,118" fill="#15803d" />
                          <path d="M 159,94 Q 130,82 136,102 Q 159,100 159,94" fill="#16a34a" />
                          <path d="M 160,78 Q 190,66 184,86 Q 160,84 160,78" fill="#16a34a" />

                          {/* Blossom flower at top */}
                          <ellipse cx="160" cy="52" rx="6" ry="11" fill="#fbcfe8" transform="rotate(0, 160, 65)" />
                          <ellipse cx="160" cy="52" rx="6" ry="11" fill="#fbcfe8" transform="rotate(45, 160, 65)" />
                          <ellipse cx="160" cy="52" rx="6" ry="11" fill="#fbcfe8" transform="rotate(90, 160, 65)" />
                          <ellipse cx="160" cy="52" rx="6" ry="11" fill="#fbcfe8" transform="rotate(135, 160, 65)" />
                          <circle cx="160" cy="65" r="7" fill="#fbbf24" />
                        </g>
                      )}

                      {/* --- Level 4: Flourishing Zen Sanctuary --- */}
                      {gardenLevel >= 4 && (
                        <g className="zen-plant-stage-4">
                          <ellipse cx="160" cy="155" rx="42" ry="14" fill="#5c330e" />
                          {/* Elegant Tree Stem */}
                          <path d="M 160,152 Q 152,90 160,55" stroke="#15803d" strokeWidth="7" strokeLinecap="round" fill="none" />
                          <path d="M 158,105 Q 130,85 115,100" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" fill="none" />
                          <path d="M 162,95 Q 195,78 205,92" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" fill="none" />

                          {/* Full Bloom Petals */}
                          <ellipse cx="160" cy="40" rx="7" ry="13" fill="#ffffff" stroke="#fbcfe8" transform="rotate(0, 160, 55)" />
                          <ellipse cx="160" cy="40" rx="7" ry="13" fill="#ffffff" stroke="#fbcfe8" transform="rotate(30, 160, 55)" />
                          <ellipse cx="160" cy="40" rx="7" ry="13" fill="#ffffff" stroke="#fbcfe8" transform="rotate(60, 160, 55)" />
                          <ellipse cx="160" cy="40" rx="7" ry="13" fill="#ffffff" stroke="#fbcfe8" transform="rotate(90, 160, 55)" />
                          <ellipse cx="160" cy="40" rx="7" ry="13" fill="#ffffff" stroke="#fbcfe8" transform="rotate(120, 160, 55)" />
                          <ellipse cx="160" cy="40" rx="7" ry="13" fill="#ffffff" stroke="#fbcfe8" transform="rotate(150, 160, 55)" />
                          <circle cx="160" cy="55" r="8" fill="#f59e0b" />

                          {/* Floating falling blossom petals */}
                          <ellipse cx="130" cy="120" rx="4" ry="2" fill="#fbcfe8" transform="rotate(25, 130, 120)" />
                          <ellipse cx="190" cy="135" rx="4" ry="2" fill="#fbcfe8" transform="rotate(-30, 190, 135)" />
                          <ellipse cx="175" cy="170" rx="3.5" ry="1.8" fill="#fbcfe8" transform="rotate(15, 175, 170)" />

                          {/* Golden Visiting Butterfly (Level 4 feature) */}
                          <g className="zen-golden-butterfly" transform="translate(195, 45)">
                            <ellipse cx="0" cy="0" rx="6" ry="9" fill="#f59e0b" transform="rotate(35)" opacity="0.9" />
                            <ellipse cx="8" cy="2" rx="4" ry="7" fill="#fbbf24" transform="rotate(-35)" opacity="0.9" />
                            <circle cx="3" cy="2" r="1.5" fill="#78350f" />
                          </g>

                          {/* Stone Lantern (Level 4 feature) */}
                          <g className="zen-stone-lantern" transform="translate(235, 80)">
                            <rect x="0" y="24" width="18" height="6" rx="2" fill="#57534e" />
                            <rect x="6" y="10" width="6" height="14" fill="#78716c" />
                            <polygon points="-2,10 20,10 16,3 2,3" fill="#44403c" />
                            <circle cx="9" cy="7" r="2.5" fill="#fef08a" opacity="0.9" />
                          </g>
                        </g>
                      )}

                    </svg>

                  </div>
                </div>

                {/* Garden Details & Progression Column */}
                <div className="zen-details-col">
                  
                  {/* Stage badge */}
                  <div className="zen-stage-badge-row">
                    <span className="zen-stage-badge" style={{ borderColor: currentStageInfo.iconColor }}>
                      <Leaf size={13} style={{ color: currentStageInfo.iconColor }} />
                      <strong>Stage {gardenLevel}: {currentStageInfo.name}</strong>
                    </span>
                  </div>

                  <h3 className="zen-stage-title">{currentStageInfo.name}</h3>
                  <p className="zen-stage-subtitle">{currentStageInfo.subtitle}</p>

                  {/* Activity completion progress bar */}
                  <div className="zen-progress-section">
                    <div className="zen-progress-labels">
                      <span>{overall?.garden?.completedActivities || 0} activities completed</span>
                      <strong>{overall?.garden?.progressToNextLevel || 0}% to next level</strong>
                    </div>

                    <div className="zen-progress-track">
                      <div
                        className="zen-progress-bar-fill"
                        style={{
                          width: `${overall?.garden?.progressToNextLevel || 0}%`,
                          background: currentStageInfo.iconColor
                        }}
                      />
                    </div>

                    <p className="zen-progress-next-tip">
                      🌱 {currentStageInfo.nextGoal}
                    </p>
                  </div>

                  {/* Mindful Minutes Summary Grid */}
                  <div className="zen-metrics-grid">
                    <div className="zen-metric-box">
                      <span className="zen-metric-lbl">
                        <Clock3 size={12} /> Today's Mindful Time
                      </span>
                      <strong className="zen-metric-val">
                        {formatMinutes(overall?.todayMindfulSeconds)}
                      </strong>
                    </div>
                    <div className="zen-metric-box">
                      <span className="zen-metric-lbl">
                        <Calendar size={12} /> This Week
                      </span>
                      <strong className="zen-metric-val">
                        {formatHoursAndMinutes(overall?.weekMindfulSeconds)}
                      </strong>
                    </div>
                  </div>

                  {/* Unlocked Features List */}
                  <div className="zen-unlocked-features-box">
                    <span className="unlocked-header-lbl">Unlocked Garden Elements:</span>
                    <div className="unlocked-pills-wrap">
                      {currentStageInfo.unlockedItems.map((item, idx) => (
                        <span key={idx} className="unlocked-pill">
                          <CheckCircle2 size={11} className="unlocked-check-icon" /> {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Gentle Feedback Summary if present */}
                  {overall?.feedback?.ratingCount > 0 && (
                    <div className="zen-feedback-summary">
                      <span className="zen-feedback-summary-lbl">Activity Experience: </span>
                      <strong className="zen-feedback-summary-val">{overall.feedback.averageRating} / 5</strong>
                      <span className="zen-feedback-summary-cnt"> ({overall.feedback.ratingCount} {overall.feedback.ratingCount === 1 ? "reflection" : "reflections"})</span>
                    </div>
                  )}

                </div>

              </div>
            )}

            {/* ============================================================== */}
            {/* VIEW B: INTERACTIVE SAND RAKE (PART C)                         */}
            {/* ============================================================== */}
            {activeTab === "interactive" && (
              <div className="zen-interactive-layout">
                
                {/* Tool Selection Toolbar */}
                <div className="zen-tools-toolbar" role="toolbar" aria-label="Sand Rake Tools">
                  <div className="zen-tools-group">
                    <span className="toolbar-lbl">Rake Pattern:</span>
                    
                    <button
                      type="button"
                      className={`zen-tool-btn ${selectedTool === "rake" ? "is-active" : ""}`}
                      onClick={() => setSelectedTool("rake")}
                      title="Circular Rake (Combed multi-prong grooves)"
                      aria-label="Circular Rake tool"
                    >
                      <CircleDot size={14} />
                      <span>Circular Rake</span>
                    </button>

                    <button
                      type="button"
                      className={`zen-tool-btn ${selectedTool === "waves" ? "is-active" : ""}`}
                      onClick={() => setSelectedTool("waves")}
                      title="Flowing Waves (Parallel wave furrows)"
                      aria-label="Flowing Waves tool"
                    >
                      <Waves size={14} />
                      <span>Flowing Waves</span>
                    </button>

                    <button
                      type="button"
                      className={`zen-tool-btn ${selectedTool === "spiral" ? "is-active" : ""}`}
                      onClick={() => setSelectedTool("spiral")}
                      title="Spiral (Click to place a calming concentric spiral)"
                      aria-label="Spiral stamp tool"
                    >
                      <Sparkles size={14} />
                      <span>Spiral</span>
                    </button>

                    <button
                      type="button"
                      className={`zen-tool-btn ${selectedTool === "lines" ? "is-active" : ""}`}
                      onClick={() => setSelectedTool("lines")}
                      title="Gentle Lines (Single soft meditative stroke)"
                      aria-label="Gentle Lines tool"
                    >
                      <PenTool size={14} />
                      <span>Gentle Lines</span>
                    </button>
                  </div>

                  {/* Reset canvas button */}
                  <button
                    type="button"
                    onClick={handleResetCanvas}
                    className="btn btn-ghost btn-reset-sand"
                    aria-label="Rake sand smooth (Reset canvas)"
                    title="Rake sand smooth"
                  >
                    <RotateCcw size={13} />
                    <span>Reset Sand</span>
                  </button>
                </div>

                {/* Canvas Drawing Surface */}
                <div className="zen-canvas-wrapper">
                  <canvas
                    ref={canvasRef}
                    className="zen-sand-canvas"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    aria-label="Interactive Zen Garden sand canvas. Drag mouse or touch to draw calming rake patterns."
                  />
                  <div className="canvas-guidance-overlay" aria-hidden="true">
                    <span>✨ Drag mouse or finger to rake peaceful patterns · Tap for ripples</span>
                  </div>
                </div>

              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
