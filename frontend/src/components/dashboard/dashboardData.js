export const MOCK_DASHBOARD_DATA = {
  latestMood: {
    emoji: "😊",
    emotion: "Happy",
    confidence: 94,
    detectedAt: "Today • 8:40 AM",
    insight: "You're feeling calmer than yesterday."
  },
  moodHistory: [
    { label: "Thu", score: 3 },
    { label: "Fri", score: 4 },
    { label: "Sat", score: 3 },
    { label: "Sun", score: 4 },
    { label: "Mon", score: 5 },
    { label: "Tue", score: 4 },
    { label: "Today", score: 4 },
  ],
  journals: [
    {
      id: "morning-light",
      title: "A little more room to breathe",
      date: "Today",
      mood: "🙂",
      preview:
        "I noticed a quieter start to the morning. Taking things slowly made the day feel more manageable.",
    },
    {
      id: "gentle-weekend",
      title: "Things I want to carry forward",
      date: "Yesterday",
      mood: "🌤️",
      preview:
        "A walk, a good conversation, and an early night. Small choices can make such a meaningful difference.",
    },
  ],
  recommendation: {
    title: "A three-minute breathing reset",
    description:
      "A gentle pause to settle your body and make a little space for the rest of your day.",
    duration: "3 min",
    type: "Breathing exercise",
  },
  quote: {
    text: "Almost everything will work again if you unplug it for a few minutes, including you.",
    author: "Anne Lamott",
  },
  summary: [
    {
      icon: "mood",
      value: 12,
      label: "Mood Check-ins",
      detail: "This Week",
    },
    {
      icon: "journal",
      value: 8,
      label: "Journal Entries",
      detail: "All Time",
    },
    {
      icon: "chat",
      value: 20,
      label: "AI Sessions",
      detail: "This Month",
    },
    {
      icon: "streak",
      value: 5,
      label: "Day Streak",
      detail: "Keep Going!",
    },
  ],
  profile: { username: "Mindful Friend", memberSince: "August 2026" },
};
