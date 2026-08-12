import Navbar from "../components/Navbar/Navbar";
import FocusTimer from "../components/dashboard/FocusTimer";
import "./FocusTimer.css";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function FocusTimerPage() {
  return (
    <>
      <Navbar profile={getStoredUser()} />
      <main className="focus-timer-page">
        <div className="container">
          <FocusTimer />
        </div>
      </main>
    </>
  );
}

export default FocusTimerPage;
