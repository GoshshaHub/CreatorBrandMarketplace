"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../../lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import ProtectedRoute from "../../../components/ProtectedRoute";

function getInitials(name: string, email: string) {
  const source = (name || email || "U").trim();
  if (!source) return "U";

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export default function CreatorProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [categories, setCategories] = useState("");
  const [email, setEmail] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [stripeAccountId, setStripeAccountId] = useState("");
  const [stripeOnboardingComplete, setStripeOnboardingComplete] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          setDisplayName(userData.displayName || "");
          setHandle(userData.handle || "");
          setBio(userData.bio || "");
          setCategories(
            Array.isArray(userData.categories)
              ? userData.categories.join(", ")
              : userData.categories || ""
          );
          setEmail(userData.email || user.email || "");
          setStripeAccountId(userData.stripeAccountId || "");
          setStripeOnboardingComplete(userData.stripeOnboardingComplete === true);
        } else {
          setEmail(user.email || "");
        }

        const creatorRef = doc(db, "creators", user.uid);
        const creatorSnap = await getDoc(creatorRef);

        if (creatorSnap.exists()) {
          const creatorData = creatorSnap.data();

          if (!displayName) setDisplayName(creatorData.displayName || "");
          if (!handle) setHandle(creatorData.handle || "");
          if (!bio) setBio(creatorData.bio || "");
          if (!categories) {
            setCategories(
              Array.isArray(creatorData.categories)
                ? creatorData.categories.join(", ")
                : creatorData.categories || ""
            );
          }
          if (!email) setEmail(creatorData.contactEmail || user.email || "");
          if (!stripeAccountId) setStripeAccountId(creatorData.stripeAccountId || "");
          if (!stripeOnboardingComplete) {
            setStripeOnboardingComplete(creatorData.stripeOnboardingComplete === true);
          }
        }
      } catch (err: any) {
        setError(err.message || "We couldn’t load your profile.");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in.");
      setSaving(false);
      return;
    }

    if (!displayName.trim()) {
      setError("Display name is required.");
      setSaving(false);
      return;
    }

    if (!handle.trim()) {
      setError("Creator handle is required.");
      setSaving(false);
      return;
    }

    if (!email.trim()) {
      setError("Contact email is required.");
      setSaving(false);
      return;
    }

    const categoryArray = categories
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: displayName.trim(),
          handle: handle.trim(),
          bio: bio.trim(),
          categories: categoryArray,
          email: email.trim(),
          stripeAccountId: stripeAccountId || null,
          stripeOnboardingComplete,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "creators", user.uid),
        {
          userId: user.uid,
          displayName: displayName.trim(),
          handle: handle.trim(),
          bio: bio.trim(),
          categories: categoryArray,
          contactEmail: email.trim(),
          stripeAccountId: stripeAccountId || null,
          stripeOnboardingComplete,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMessage("Profile updated successfully.");
    } catch (err: any) {
      setError(err.message || "We couldn’t save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConnectStripe() {
    setConnectingStripe(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/stripe/create-account", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to start Stripe onboarding.");
      }

      const user = auth.currentUser;
      if (!user) {
        throw new Error("You must be logged in.");
      }

      if (data.accountId) {
        await setDoc(
          doc(db, "users", user.uid),
          {
            stripeAccountId: data.accountId,
            stripeOnboardingComplete: false,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        await setDoc(
          doc(db, "creators", user.uid),
          {
            stripeAccountId: data.accountId,
            stripeOnboardingComplete: false,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        setStripeAccountId(data.accountId);
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("Stripe onboarding URL was not returned.");
    } catch (err: any) {
      setError(err.message || "We couldn’t connect your payout account.");
      setConnectingStripe(false);
    }
  }

  const initials = useMemo(() => getInitials(displayName, email), [displayName, email]);

  return (
    <ProtectedRoute allowedRole="creator">
      <main className="app-page">
        <div className="app-shell">
          <div className="app-header">
            <div>
              <h1 className="app-title">Creator Profile</h1>
              <p className="app-subtitle">
                Present your profile clearly so brands understand your style,
                niche, and fit at a glance.
              </p>
            </div>

            <Link href="/creator/dashboard" className="app-button-secondary">
              Back to Dashboard
            </Link>
          </div>

          {loading ? (
            <p className="app-subtitle" style={{ marginTop: "24px" }}>
              Loading your profile...
            </p>
          ) : (
            <div
              style={{
                marginTop: "32px",
                display: "grid",
                gap: "24px",
                gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
                alignItems: "start",
              }}
            >
              <form onSubmit={handleSave} className="app-card app-card-padding">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h2
                      className="app-text"
                      style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}
                    >
                      Public Profile
                    </h2>
                    <p
                      className="app-text-soft"
                      style={{ marginTop: "8px", marginBottom: 0 }}
                    >
                      These details help brands decide whether to invite you.
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: "28px" }}>
                  <h3
                    className="app-text"
                    style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}
                  >
                    Basic Information
                  </h3>

                  <div
                    style={{
                      marginTop: "16px",
                      display: "grid",
                      gap: "16px",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    }}
                  >
                    <div>
                      <label
                        className="app-text-soft"
                        style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
                      >
                        Display Name
                      </label>
                      <input
                        className="app-input"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Athena Yap"
                      />
                    </div>

                    <div>
                      <label
                        className="app-text-soft"
                        style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
                      >
                        Creator Handle
                      </label>
                      <input
                        className="app-input"
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        placeholder="@yourhandle"
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "28px" }}>
                  <h3
                    className="app-text"
                    style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}
                  >
                    About Your Content
                  </h3>

                  <div style={{ marginTop: "16px", display: "grid", gap: "16px" }}>
                    <div>
                      <label
                        className="app-text-soft"
                        style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
                      >
                        Bio
                      </label>
                      <textarea
                        className="app-textarea"
                        rows={5}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Briefly describe the type of content you create, your audience, and what brands should know about your style."
                      />
                    </div>

                    <div>
                      <label
                        className="app-text-soft"
                        style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
                      >
                        Categories
                      </label>
                      <input
                        className="app-input"
                        value={categories}
                        onChange={(e) => setCategories(e.target.value)}
                        placeholder="beauty, skincare, fragrance, lifestyle"
                      />
                      <p
                        className="app-text-faint"
                        style={{ marginTop: "8px", marginBottom: 0 }}
                      >
                        Separate categories with commas.
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "28px" }}>
                  <h3
                    className="app-text"
                    style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}
                  >
                    Contact
                  </h3>

                  <div style={{ marginTop: "16px" }}>
                    <label
                      className="app-text-soft"
                      style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
                    >
                      Contact Email
                    </label>
                    <input
                      className="app-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div style={{ marginTop: "28px" }}>
                  <h3
                    className="app-text"
                    style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}
                  >
                    Payout Setup
                  </h3>

                  <div
                    className="app-muted-card"
                    style={{
                      marginTop: "16px",
                      padding: "18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <p className="app-text-soft" style={{ margin: 0 }}>
                      Connect your Stripe payout account so you can receive campaign payouts.
                    </p>

                    <p className="app-text-faint" style={{ margin: 0 }}>
                      Status:{" "}
                      {stripeOnboardingComplete
                        ? "Connected"
                        : stripeAccountId
                        ? "Onboarding started"
                        : "Not connected"}
                    </p>

                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="app-button"
                        onClick={handleConnectStripe}
                        disabled={connectingStripe}
                      >
                        {connectingStripe
                          ? "Opening Stripe..."
                          : stripeAccountId
                          ? "Continue Stripe Setup"
                          : "Connect Payout Account"}
                      </button>
                    </div>
                  </div>
                </div>

                {(message || error) && (
                  <div style={{ marginTop: "24px" }}>
                    {message ? (
                      <p style={{ margin: 0, color: "#16a34a", fontWeight: 600 }}>
                        {message}
                      </p>
                    ) : null}
                    {error ? (
                      <p style={{ margin: 0, color: "#dc2626", fontWeight: 600 }}>
                        {error}
                      </p>
                    ) : null}
                  </div>
                )}

                <div
                  style={{
                    marginTop: "28px",
                    paddingTop: "20px",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <button type="submit" className="app-button" disabled={saving}>
                    {saving ? "Saving..." : "Save Profile"}
                  </button>

                  <Link href="/creator/dashboard" className="app-button-secondary">
                    Cancel
                  </Link>
                </div>
              </form>

              <aside
                className="app-card app-card-padding"
                style={{ position: "sticky", top: "96px" }}
              >
                <h2
                  className="app-text"
                  style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}
                >
                  Profile Preview
                </h2>
                <p
                  className="app-text-soft"
                  style={{ marginTop: "8px", marginBottom: "20px" }}
                >
                  This is the overall impression brands will get from your profile.
                </p>

                <div
                  className="app-muted-card"
                  style={{
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "999px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      fontWeight: 700,
                      fontSize: "1.1rem",
                      color: "var(--text)",
                    }}
                  >
                    {initials}
                  </div>

                  <div>
                    <p
                      className="app-text"
                      style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem" }}
                    >
                      {displayName || "Your Name"}
                    </p>
                    <p
                      className="app-text-soft"
                      style={{ marginTop: "6px", marginBottom: 0 }}
                    >
                      {handle || "@yourhandle"}
                    </p>
                  </div>

                  <div>
                    <p
                      className="app-text-soft"
                      style={{ margin: 0, lineHeight: 1.6 }}
                    >
                      {bio || "Your creator bio will appear here."}
                    </p>
                  </div>

                  <div>
                    <p
                      className="app-text-faint"
                      style={{ margin: 0, fontWeight: 600 }}
                    >
                      Categories
                    </p>
                    <div
                      style={{
                        marginTop: "10px",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      {(categories || "")
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean)
                        .slice(0, 6)
                        .map((item) => (
                          <span key={item} className="app-pill">
                            {item}
                          </span>
                        ))}

                      {!categories.trim() ? (
                        <span className="app-text-faint">No categories added yet</span>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <p
                      className="app-text-faint"
                      style={{ margin: 0, fontWeight: 600 }}
                    >
                      Contact
                    </p>
                    <p
                      className="app-text-soft"
                      style={{ marginTop: "8px", marginBottom: 0 }}
                    >
                      {email || "No contact email added"}
                    </p>
                  </div>

                  <div>
                    <p
                      className="app-text-faint"
                      style={{ margin: 0, fontWeight: 600 }}
                    >
                      Payout Account
                    </p>
                    <p
                      className="app-text-soft"
                      style={{ marginTop: "8px", marginBottom: 0 }}
                    >
                      {stripeOnboardingComplete
                        ? "Stripe connected"
                        : stripeAccountId
                        ? "Setup in progress"
                        : "Not connected"}
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}