export const MOCK_DASHBOARD_DATA = {
  latestMood: { emoji: "🙂", name: "Content", score: 4, loggedAt: "Today, 8:40 AM" },
  moodHistory: [
    { label: "Thu", score: 3 }, { label: "Fri", score: 4 }, { label: "Sat", score: 3 },
    { label: "Sun", score: 4 }, { label: "Mon", score: 5 }, { label: "Tue", score: 4 },
    { label: "Today", score: 4 },
  ],
  journals: [
    { id: "morning-light", title: "A little more room to breathe", date: "Today", mood: "🙂", preview: "I noticed a quieter start to the morning. Taking things slowly made the day feel more manageable." },
    { id: "gentle-weekend", title: "Things I want to carry forward", date: "Yesterday", mood: "🌤️", preview: "A walk, a good conversation, and an early night. Small choices can make such a meaningful difference." },
  ],
  recommendation: { title: "A three-minute breathing reset", description: "A gentle pause to settle your body and make a little space for the rest of your day.", duration: "3 min", type: "Breathing exercise" },
  quote: { text: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott" },
  progress: [
    { label: "Mood streak", value: "6 days", detail: "A gentle rhythm" },
    { label: "Journal entries", value: "18", detail: "Thoughts held safely" },
    { label: "Activities completed", value: "9", detail: "Small moments of care" },
    { label: "Mindfulness minutes", value: "84", detail: "This month" },
  ],
  profile: { username: "Mindful Friend", memberSince: "August 2026" },
};
