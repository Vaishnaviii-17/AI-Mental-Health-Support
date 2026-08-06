import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, UserPlus, Wand2, Check } from "lucide-react";
import AuthCard from "../components/AuthCard/AuthCard";
import { signup } from "../services/authService";
import { generateUsername } from "../utils/usernameGenerator";
import { generatePassword } from "../utils/passwordGenerator";
import "../styles/forms.css";
import "./Signup.css";

function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setJustGenerated(false);
  };

  const handleGenerate = () => {
    const username = generateUsername();
    const password = generatePassword(14);
    setForm({ username, password, confirmPassword: password });
    setShowPassword(true);
    setShowConfirm(true);
    setJustGenerated(true);
  };

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await signup({
        username: form.username,
        password: form.password,
      });

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));


      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Login failed.");
    }
  };

  return (
    <AuthCard
      panelTitle="Start your MindEase journey."
      panelDesc="Create an account in seconds — anonymous, private, and entirely yours."
    >
      <form onSubmit={handleSubmit} noValidate>
        <h1 className="auth-form-title">Create your account</h1>
        <p className="auth-form-subtitle">
          Choose your own details, or generate them instantly below.
        </p>

        <div className="field">
          <label htmlFor="signup-username">Username</label>
          <input
            id="signup-username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="e.g. SilentLeaf81"
            value={form.username}
            onChange={handleChange}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="signup-password">Password</label>
          <div className="password-wrap">
            <input
              id="signup-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create a password"
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

        <div className="field">
          <label htmlFor="signup-confirm">Confirm Password</label>
          <div className="password-wrap">
            <input
              id="signup-confirm"
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowConfirm((prev) => !prev)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary form-submit">
          <UserPlus size={18} aria-hidden="true" /> Create Account
        </button>

        <div className="form-divider" role="separator">
          <span>or</span>
        </div>

        <button
          type="button"
          className="btn btn-ghost generate-btn"
          onClick={handleGenerate}
        >
          {justGenerated ? (
            <>
              <Check size={18} aria-hidden="true" /> Generated — edit if you like
            </>
          ) : (
            <>
              <Wand2 size={18} aria-hidden="true" /> Generate Credentials
            </>
          )}
        </button>

        <p className="form-footer signup-footer">
          Already have an account?{" "}
          <Link to="/login" className="form-link">
            Log in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}

export default Signup;
