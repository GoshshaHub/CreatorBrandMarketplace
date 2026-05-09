"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../lib/auth";
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
  const { user, loading: authLoading } = useAuth();

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
  const [stripeOnboardingComplete, setStripeOnboardingComplete] =
    useState(false);
  const [stripePayoutsEnabled, setStripePayoutsEnabled] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    async function fetchProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const creatorRef = doc(db, "creators", user.uid);

        const [userSnap, creatorSnap] = await Promise.all([
          getDoc(userRef),
          getDoc(creatorRef),
        ]);

        const userData = userSnap.exists() ? userSnap.data() : {};
        const creatorData = creatorSnap.exists() ? creatorSnap.data() : {};

        const mergedDisplayName =
          userData.displayName || creatorData.displayName || "";

        const mergedHandle = userData.handle || creatorData.handle || "";
        const mergedBio = userData.bio || creatorData.bio || "";
        const mergedCategories =
          userData.categories || creatorData.categories || "";

        const mergedEmail =
          userData.email ||
          creatorData.email ||
          creatorData.contactEmail ||
          user.email ||
          "";

        const mergedStripeAccountId =
          userData.stripeAccountId || creatorData.stripeAccountId || "";

        const mergedStripeOnboardingComplete =
          userData.stripeOnboardingComplete === true ||
          creatorData.stripeOnboardingComplete === true;

        const mergedStripePayoutsEnabled =
          userData.stripePayoutsEnabled === true ||
          creatorData.stripePayoutsEnabled === true;

        setDisplayName(mergedDisplayName);
        setHandle(mergedHandle);
        setBio(mergedBio);
        setEmail(mergedEmail);
        setStripeAccountId(mergedStripeAccountId);
        setStripeOnboardingComplete(mergedStripeOnboardingComplete);
        setStripePayoutsEnabled(mergedStripePayoutsEnabled);

        setCategories(
          Array.isArray(mergedCategories)
            ? mergedCategories.join(", ")
            : mergedCategories || ""
        );
      } catch (err: any) {
        setError(err.message || "We couldn’t load your profile.");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [user?.uid, authLoading]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

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

    const stripeData = {
      stripeAccountId: stripeAccountId || null,
      stripeOnboardingComplete,
      stripePayoutsEnabled,
    };

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: displayName.trim(),
          handle: handle.trim(),
          bio: bio.trim(),
          categories: categoryArray,
          email: email.trim(),
          roles: ["creator"],
          ...stripeData,
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
          email: email.trim(),
          contactEmail: email.trim(),
          isMarketplaceVisible: true,
          ...stripeData,
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
    if (stripeOnboardingComplete && stripePayoutsEnabled) {
      setMessage("Stripe payout account is already connected.");
      return;
    }

    setConnectingStripe(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/stripe/create-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          existingAccountId: stripeAccountId || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to start Stripe onboarding.");
      }

      if (!user) {
        throw new Error("You must be logged in.");
      }

      if (data.accountId) {
        await setDoc(
          doc(db, "users", user.uid),
          {
            stripeAccountId: data.accountId,
            stripeOnboardingComplete: false,
            stripePayoutsEnabled: false,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        await setDoc(
          doc(db, "creators", user.uid),
          {
            stripeAccountId: data.accountId,
            stripeOnboardingComplete: false,
            stripePayoutsEnabled: false,
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

  const initials = useMemo(
    () => getInitials(displayName, email),
    [displayName, email]
  );

  const payoutStatusLabel =
    stripeOnboardingComplete && stripePayoutsEnabled
      ? "Connected"
      : stripeOnboardingComplete
      ? "Connected, payouts pending"
      : stripeAccountId
      ? "Onboarding started"
      : "Not connected";

  const payoutButtonLabel =
    connectingStripe
      ? "Opening Stripe..."
      : stripeAccountId
      ? "Continue Stripe Setup"
      : "Connect Payout Account";

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

          {loading || authLoading ? (
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
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(240px, 1fr))",
                    }}
                  >
                    <div>
                      <label className="app-text-soft">Display Name</label>
                      <input
                        className="app-input"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Vanessa"
                      />
                    </div>

                    <div>
                      <label className="app-text-soft">Creator Handle</label>
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
                      <label className="app-text-soft">Bio</label>
                      <textarea
                        className="app-textarea"
                        rows={5}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Briefly describe your content style."
                      />
                    </div>

                    <div>
                      <label className="app-text-soft">Categories</label>
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
                    <label className="app-text-soft">Contact Email</label>
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
                      Connect your Stripe payout account so you can receive
                      campaign payouts.
                    </p>

                    <p className="app-text-faint" style={{ margin: 0 }}>
                      Status: {payoutStatusLabel}
                    </p>

                    {stripeOnboardingComplete ? (
                      <div
                        style={{
                          border: "1px solid #16a34a",
                          background: "#f0fdf4",
                          color: "#166534",
                          borderRadius: "14px",
                          padding: "14px 16px",
                          fontWeight: 700,
                          textAlign: "center",
                        }}
                      >
                        ✓ Stripe Connected
                        <div
                          style={{
                            marginTop: "6px",
                            fontSize: "0.9rem",
                            fontWeight: 500,
                          }}
                        >
                          You are ready to receive campaign payouts.
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="app-button"
                        onClick={handleConnectStripe}
                        disabled={connectingStripe}
                      >
                        {payoutButtonLabel}
                      </button>
                    )}
                  </div>
                </div>

                {(message || error) && (
                  <div style={{ marginTop: "24px" }}>
                    {message && (
                      <p style={{ margin: 0, color: "#16a34a", fontWeight: 600 }}>
                        {message}
                      </p>
                    )}
                    {error && (
                      <p style={{ margin: 0, color: "#dc2626", fontWeight: 600 }}>
                        {error}
                      </p>
                    )}
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
                  This is the overall impression brands will get from your
                  profile.
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

                  <p className="app-text-soft" style={{ margin: 0, lineHeight: 1.6 }}>
                    {bio || "Your creator bio will appear here."}
                  </p>

                  <div>
                    <p className="app-text-faint" style={{ margin: 0, fontWeight: 600 }}>
                      Categories
                    </p>
                    <p className="app-text-soft" style={{ marginTop: "8px" }}>
                      {categories || "No categories added yet"}
                    </p>
                  </div>

                  <div>
                    <p className="app-text-faint" style={{ margin: 0, fontWeight: 600 }}>
                      Contact
                    </p>
                    <p className="app-text-soft" style={{ marginTop: "8px" }}>
                      {email || "No contact email added"}
                    </p>
                  </div>

                  <div>
                    <p className="app-text-faint" style={{ margin: 0, fontWeight: 600 }}>
                      Payout Account
                    </p>
                    <p className="app-text-soft" style={{ marginTop: "8px" }}>
                      {payoutStatusLabel}
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