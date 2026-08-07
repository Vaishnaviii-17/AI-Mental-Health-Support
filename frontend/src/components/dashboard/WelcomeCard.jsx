import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Sparkles,
  SunMedium,
  Sunrise,
  MoonStar,
} from "lucide-react";

const AFFIRMATIONS = [
  "Take care of your mental health today.",
  "Every small step counts.",
  "Be kind to yourself today.",
  "Progress matters more than perfection.",
  "Your feelings are valid.",
  "One deep breath can change everything.",
  "Celebrate every little victory.",
  "You're doing better than you think.",
  "Rest is productive too.",
  "Today is another chance to grow.",
];

function WelcomeCard({ username }) {
  const hour = new Date().getHours();

  const { greeting, GreetingIcon } =
    hour < 12
      ? { greeting: "Good Morning", GreetingIcon: Sunrise }
      : hour < 18
      ? { greeting: "Good Afternoon", GreetingIcon: SunMedium }
      : { greeting: "Good Evening", GreetingIcon: MoonStar };

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const affirmation = useMemo(() => {
    const day = new Date().getDate();
    return AFFIRMATIONS[day % AFFIRMATIONS.length];
  }, []);

  return (
    <section
      className="dashboard-welcome"
      aria-labelledby="dashboard-welcome-title"
    >
      <div className="dashboard-welcome__content">
        <span className="eyebrow eyebrow--light">
          <GreetingIcon size={14} />
          {greeting}
        </span>

        <h1 id="dashboard-welcome-title">
          Welcome back,
          <br />
          {username} !
        </h1>

        <p className="dashboard-welcome__message">{affirmation}</p>

        <p className="dashboard-welcome__date">
          <CalendarDays size={16} />
          {today}
        </p>
      </div>

      <div
        className="dashboard-welcome__visual"
        role="img"
        aria-label="A calm sun rising over soft hills"
      >
        <motion.div
          className="dashboard-welcome__sun"
          animate={{ rotate: [0, 5, 0, -5, 0] }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <SunMedium size={48} strokeWidth={1.2} />
        </motion.div>

        <div className="dashboard-welcome__hill dashboard-welcome__hill--back" />
        <div className="dashboard-welcome__hill dashboard-welcome__hill--front" />

        <motion.span
          className="dashboard-welcome__sparkle"
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Sparkles size={19} />
        </motion.span>
      </div>
    </section>
  );
}

export default WelcomeCard;