import { motion } from "framer-motion";
import { CalendarDays, Sparkles, SunMedium } from "lucide-react";

function WelcomeCard({ username }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  return (
    <section className="dashboard-welcome" aria-labelledby="dashboard-welcome-title">
      <div className="dashboard-welcome__content">
        <span className="eyebrow eyebrow--light">{greeting}</span>
        <h1 id="dashboard-welcome-title">Hello, {username}.</h1>
        <p className="dashboard-welcome__message">Small steps create meaningful progress.</p>
        <p className="dashboard-welcome__date"><CalendarDays size={16} aria-hidden="true" /> {today}</p>
      </div>
      <div className="dashboard-welcome__visual" role="img" aria-label="A calm sun rising over soft hills">
        <div className="dashboard-welcome__sun"><SunMedium size={48} strokeWidth={1.2} aria-hidden="true" /></div>
        <div className="dashboard-welcome__hill dashboard-welcome__hill--back" />
        <div className="dashboard-welcome__hill dashboard-welcome__hill--front" />
        <motion.span className="dashboard-welcome__sparkle" animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity }}><Sparkles size={19} aria-hidden="true" /></motion.span>
      </div>
    </section>
  );
}

export default WelcomeCard;
