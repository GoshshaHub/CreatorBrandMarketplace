"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { loginUser, sendResetPasswordEmail } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const hasSessionRedirectedRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (hasSessionRedirectedRef.current) return;

      if (!user) {
        setCheckingSession(false);
        return;
      }

      hasSessionRedirectedRef.current = true;
      router.replace("/account");
    });

    return () => unsubscribe();
  }, [router]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await loginUser(email, password);
      router.replace("/account");
    } catch (err: any) {
      setError(err.message || "Unable to log in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Enter your email first to reset your password.");
      return;
    }

    try {
      await sendResetPasswordEmail(email.trim());
      setMessage("Password reset email sent.");
    } catch (err: any) {
      setError(err.message || "Unable to send reset email.");
    }
  }

  if (checkingSession) {
    return (
      <main className="app-page">
        <div className="app-shell" style={{ maxWidth: "520px" }}>
          <div className="app-card app-card-padding" style={{ marginTop: "40px" }}>
            <p className="app-subtitle">Checking session...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page">
      <div className="app-shell" style={{ maxWidth: "520px" }}>
        <div className="app-card app-card-padding" style={{ marginTop: "40px" }}>
          <h1 className="app-title">Log In</h1>
          <p className="app-subtitle">
            Access your Goshsha IRL Campaign Network account.
          </p>

          <form onSubmit={handleLogin} style={{ marginTop: "24px" }}>
            <div style={{ display: "grid", gap: "16px" }}>
              <div>
                <label
                  className="app-text-soft"
                  style={{ display: "block", marginBottom: "8px", fontWeight: 500 }}
                >
                  Email
                </label>
                <input
                  type="email"
                  className="app-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label
                  className="app-text-soft"
                  style={{ display: "block", marginBottom: "8px", fontWeight: 500 }}
                >
                  Password
                </label>
                <input
                  type="password"
                  className="app-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {error && (
              <p style={{ marginTop: "16px", color: "#dc2626" }}>{error}</p>
            )}

            {message && (
              <p style={{ marginTop: "16px", color: "#16a34a" }}>{message}</p>
            )}

            <div
              style={{
                marginTop: "24px",
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <button type="submit" disabled={loading} className="app-button">
                {loading ? "Logging In..." : "Log In"}
              </button>

              <button
                type="button"
                onClick={handleResetPassword}
                className="app-button-secondary"
              >
                Reset Password
              </button>
            </div>
          </form>

          <div style={{ marginTop: "24px" }}>
            <p className="app-text-soft" style={{ margin: 0 }}>
              Need an account?{" "}
              <Link href="/signup" style={{ textDecoration: "underline" }}>
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}