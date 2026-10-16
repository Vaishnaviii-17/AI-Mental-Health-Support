/**
 * Predefined, evidence-informed guided meditation sessions for MindEase.
 * Non-clinical wellness exercises designed for safety, comfort, and accessibility.
 */

export const MEDITATION_SESSIONS = [
  {
    id: "calm-my-mind",
    title: "Calm My Mind",
    subtitle: "A gentle pause to settle thoughts and find ease",
    durationSeconds: 180, // 3 minutes
    durationLabel: "3 min",
    category: "Relaxation",
    targetMoodKeys: ["anxiety", "anxious", "overwhelmed", "overwhelm", "nervous", "worried", "fear"],
    recommendationReason: "Recommended for calming anxious or overwhelmed moments",
    steps: [
      {
        title: "Settling In",
        instruction: "Find a comfortable seated or reclining position. Let your hands rest softly in your lap, and allow your shoulders to drop gently away from your ears.",
        durationSeconds: 30
      },
      {
        title: "Noticing Your Surroundings",
        instruction: "Gently notice the space around you. Feel where your body makes contact with the chair or floor, supporting you steadily in this moment.",
        durationSeconds: 35
      },
      {
        title: "Gentle, Natural Breathing",
        instruction: "Allow your breathing to find its own effortless rhythm. There is no need to force deep breaths or hold your breath. Simply let each breath come and go comfortably.",
        durationSeconds: 40
      },
      {
        title: "Softening Sensations",
        instruction: "Notice any physical sensations without judgment—warmth, coolness, or tension. With each gentle exhale, invite your body to soften a little more.",
        durationSeconds: 40
      },
      {
        title: "Gentle Check-In",
        instruction: "Take a quiet moment to check in with yourself. Notice how you feel right now with curiosity and kindness. Whatever you are feeling is completely valid.",
        durationSeconds: 35
      }
    ]
  },
  {
    id: "grounding-exercise",
    title: "Grounding Exercise",
    subtitle: "5-4-3 sensory practice to anchor in the present",
    durationSeconds: 120, // 2 minutes
    durationLabel: "2 min",
    category: "Grounding",
    targetMoodKeys: ["anxiety", "anxious", "panic", "overwhelmed", "stressed", "restless"],
    recommendationReason: "Recommended for grounding and reconnecting during tense or anxious moments",
    steps: [
      {
        title: "5 Things You Can See",
        instruction: "Look around your surroundings. Notice 5 distinct things you can see—perhaps a texture, a shadow on the wall, a color, or an object nearby.",
        durationSeconds: 30
      },
      {
        title: "4 Things You Can Feel",
        instruction: "Bring attention to physical touch. Notice 4 things you can feel—the texture of your clothes, the temperature of the air, or the floor beneath your feet.",
        durationSeconds: 30
      },
      {
        title: "3 Things You Can Hear",
        instruction: "Soften your gaze or close your eyes. Listen carefully for 3 sounds—near or far. A faint breeze, a clock ticking, or quiet ambient sounds.",
        durationSeconds: 30
      },
      {
        title: "Anchored in the Present",
        instruction: "Feel the stability of right now. You are safe here in this moment. Take one calm, natural breath before continuing your day.",
        durationSeconds: 30
      }
    ]
  },
  {
    id: "stop-overthinking",
    title: "Stop Overthinking",
    subtitle: "Untangle racing thoughts with gentle counting",
    durationSeconds: 180, // 3 minutes
    durationLabel: "3 min",
    category: "Focus & Clarity",
    targetMoodKeys: ["racing thoughts", "overthinking", "busy mind", "confused", "distracted", "scattered"],
    recommendationReason: "Recommended for gently slowing down racing thoughts",
    steps: [
      {
        title: "Observing Thoughts",
        instruction: "Notice thoughts passing through your mind like clouds in a wide sky. You don't need to push them away or argue with them. Simply acknowledge them as thoughts.",
        durationSeconds: 40
      },
      {
        title: "Gentle Counting (1 to 10)",
        instruction: "With each natural breath, silently count from 1 to 10. '1... 2... 3...'. If your mind wanders at any point, gently begin again at 1 without any self-criticism.",
        durationSeconds: 50
      },
      {
        title: "Letting Go of Mental Noise",
        instruction: "Whenever an urge to analyze arises, silently say 'not right now' and return your attention to the feeling of breathing in and breathing out.",
        durationSeconds: 45
      },
      {
        title: "One Manageable Step",
        instruction: "Bring to mind just one small, realistic thing to focus on next when this session ends. Only one manageable step. You don't have to solve everything today.",
        durationSeconds: 45
      }
    ]
  },
  {
    id: "body-relaxation",
    title: "Body Relaxation",
    subtitle: "Progressive softening from jaw to feet",
    durationSeconds: 240, // 4 minutes
    durationLabel: "4 min",
    category: "Physical Ease",
    targetMoodKeys: ["stress", "stressed", "tense", "tension", "exhausted", "headache", "fatigued"],
    recommendationReason: "Recommended for releasing stored physical tension and tightness",
    steps: [
      {
        title: "Releasing Face & Jaw",
        instruction: "Bring attention to your forehead, eyes, and jaw. Allow your teeth to gently part, unclench your jaw, and let your facial muscles soften into ease.",
        durationSeconds: 50
      },
      {
        title: "Dropping the Shoulders",
        instruction: "Notice your neck and shoulders. On your next comfortable exhale, let your shoulders drop down and back, releasing the weight you may be carrying.",
        durationSeconds: 50
      },
      {
        title: "Softening Hands & Arms",
        instruction: "Notice your hands and fingers. Let your palms uncurl and rest openly. Feel any warmth, tingling, or stillness in your fingertips.",
        durationSeconds: 50
      },
      {
        title: "Grounding Legs & Feet",
        instruction: "Shift awareness down through your hips, thighs, knees, and feet. Let your lower body feel heavy, relaxed, and fully supported by gravity.",
        durationSeconds: 45
      },
      {
        title: "Full-Body Rest",
        instruction: "Feel the calm throughout your whole body. If any area still feels tight, simply send it a compassionate breath without forcing anything to change.",
        durationSeconds: 45
      }
    ]
  },
  {
    id: "positive-reset",
    title: "Positive Reset",
    subtitle: "A compassionate check-in to recharge your day",
    durationSeconds: 120, // 2 minutes
    durationLabel: "2 min",
    category: "Self-Compassion",
    targetMoodKeys: ["sad", "low", "down", "depressed", "tired", "lonely", "discouraged", "unmotivated"],
    recommendationReason: "Recommended for a gentle self-compassion reset when energy feels low",
    steps: [
      {
        title: "Kindness to Yourself",
        instruction: "Pause and acknowledge yourself for taking this moment. Showing up for yourself, even when energy is low, is an act of real courage and care.",
        durationSeconds: 30
      },
      {
        title: "One Small Thing You Handled",
        instruction: "Think of one small thing you managed today—waking up, responding to a message, drinking water, or simply enduring a tough moment. Give yourself credit.",
        durationSeconds: 30
      },
      {
        title: "One Realistic Next Step",
        instruction: "Choose one gentle, realistic step for the next hour—stretching, sipping tea, or resting your eyes. Avoid any expectations of perfection.",
        durationSeconds: 30
      },
      {
        title: "Carrying Softness Forward",
        instruction: "Take this gentle pace with you into whatever comes next. Remember: you are allowed to move slowly and take things one breath at a time.",
        durationSeconds: 30
      }
    ]
  }
];

/**
 * Returns a recommended session based on available user mood data.
 * Safe, optional, and non-diagnostic.
 */
export function getRecommendedSession(todayMood) {
  if (!todayMood) return null;

  const emotion = (todayMood.emotion || "").toLowerCase();
  const note = (todayMood.note || "").toLowerCase();
  const combined = `${emotion} ${note}`;

  for (const session of MEDITATION_SESSIONS) {
    for (const key of session.targetMoodKeys) {
      if (combined.includes(key)) {
        return session;
      }
    }
  }

  // Fallback by mood score if emotion text didn't match:
  const score = Number(todayMood.score || todayMood.mood_score || 0);
  if (score > 0 && score <= 2) {
    // Low mood
    return MEDITATION_SESSIONS.find(s => s.id === "positive-reset");
  } else if (score === 3) {
    // Neutral / overwhelmed
    return MEDITATION_SESSIONS.find(s => s.id === "calm-my-mind");
  }

  return null;
}
