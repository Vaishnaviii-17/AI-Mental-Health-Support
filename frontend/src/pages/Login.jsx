import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";
import AuthCard from "../components/AuthCard/AuthCard";
import "../styles/forms.css";
import "./Login.css";

function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", remember: false });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Frontend-only for now — wire this up to authService once the backend route is ready.
  };

  return (
    <AuthCard
      panelTitle="Good to see you again."
      panelDesc="Sign in to pick up right where you left off."
    >
      <form onSubmit={handleSubmit} noValidate>
        <h1 className="auth-form-title">Log in to MindEase</h1>
        <p className="auth-form-subtitle">Enter your details to continue.</p>

        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="e.g. CalmRiver483"
            value={form.username}
            onChange={handleChange}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="password-wrap">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="login-row">
          <label className="login-checkbox">
            <input
              type="checkbox"
              name="remember"
              checked={form.remember}
              onChange={handleChange}
            />
            Remember me
          </label>
          <a href="#forgot-password" className="login-forgot">
            Forgot Password?
          </a>
        </div>

        <button type="submit" className="btn btn-primary form-submit">
          <LogIn size={18} aria-hidden="true" /> Login
        </button>

        <div className="form-divider" role="separator">
          <span>or</span>
        </div>

        <p className="form-footer">
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="form-link">
            Create one
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}

export default Login;
