import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import AuthChoice from "./pages/AuthChoice";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import JournalPage from "./pages/Journal";
import ChatPage from "./pages/Chat";
import ProfilePage from "./pages/Profile";
import AnalyticsPage from "./pages/Analytics";
import FocusTimerPage from "./pages/FocusTimer";
import ActivitiesPage from "./pages/Activities";
import BreathingBubble from "./pages/activities/BreathingBubble";
import PopStress from "./pages/activities/PopStress";
import MemoryMatch from "./pages/activities/MemoryMatch";
import ProtectedRoute from "./components/ProtectedRoute";
import "./styles/global.css";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth" element={<AuthChoice />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      
      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/journal"
        element={
          <ProtectedRoute>
            <JournalPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/focus-timer"
        element={
          <ProtectedRoute>
            <FocusTimerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activities"
        element={
          <ProtectedRoute>
            <ActivitiesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activities/breathing"
        element={
          <ProtectedRoute>
            <BreathingBubble />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activities/pop-stress"
        element={
          <ProtectedRoute>
            <PopStress />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activities/memory-match"
        element={
          <ProtectedRoute>
            <MemoryMatch />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
