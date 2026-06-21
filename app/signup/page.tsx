"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { signupUser } from "../../lib/auth";
import { db } from "../../lib/firebase";

type UserRole = "creator" | "brand";

export default function SignupPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("creator");

  const [handle, setHandle] = useState("");
  const [categoriesInput, setCategoriesInput] = useState("");
  const [bio, setBio] = useState("");

  const [claimCreatorId, setClaimCreatorId] = useState("");
  const [claimMode, setClaimMode] = useState(false);
  const [inviteCreatorId, setInviteCreatorId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get("role");
    const claimId = params.get("claimCreatorId") || "";
    const inviteId = params.get("creatorId") || "";

    if (roleParam === "brand") setRole("brand");
    if (roleParam === "creator") setRole("creator");
    if (inviteId) {
      setRole("brand");
      setInviteCreatorId(inviteId);
    }

    if (claimId) {
      setRole("creator");
      setClaimCreatorId(claimId);
      setClaimMode(true);
    }
  }, []);

  function friendlyError(err: any) {
    const code = err?.code || "";

    if (code === "auth/email-already-in-use") {
      return "An account with that email already exists. Try logging in instead.";
    }
    if (code === "auth/weak-password") {
      return "Password is too weak. Try a stronger one.";
    }
    if (code === "auth/invalid-email") {
      return "Please enter a valid email address.";
    }

    return err?.message || "Signup failed";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }

    if (role === "creator" && !claimMode) {
      if (!handle.trim()) {
        setError("Creator handle is required.");
        return;
      }

      if (!categoriesInput.trim()) {
        setError("Please enter at least one category.");
        return;
      }
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const categories =
        role === "creator"
          ? categoriesInput
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : [];

      const credential = await signupUser(
        normalizedEmail,
        password,
        displayName.trim()
      );

      const uid = credential.user.uid;

      await setDoc(
        doc(db, "users", uid),
        {
          email: normalizedEmail,
          displayName: displayName.trim(),
          roles: [role],
          isActive: claimMode ? false : true,
          subscriptionStatus: role === "brand" ? "none" : null,
          photoURL: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (role === "creator") {
        if (claimMode) {
          const res = await fetch("/api/creator/request-claim", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              uid,
              email: normalizedEmail,
              claimCreatorId,
            }),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(
              data?.error ||
                "Unable to start claim verification. Please contact support."
            );
          }

          router.push("/creator/claim-pending");
          return;
        }

        await setDoc(
          doc(db, "creators", uid),
          {
            userId: uid,
            email: normalizedEmail,
            contactEmail: normalizedEmail,
            displayName: displayName.trim(),
            handle: handle.trim(),
            bio: bio.trim(),
            categories,
            creatorStatus: "verified",
            isMarketplaceVisible: true,
            campaignsCompleted: 0,
            totalCampaignViews: 0,
            topProductSlug: null,
            socialLinks: {
              instagram: "",
              tiktok: "",
              youtube: "",
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        router.push("/creator/dashboard");
        return;
      }

      await setDoc(
        doc(db, "brands", uid),
        {
          userId: uid,
          email: normalizedEmail,
          contactEmail: normalizedEmail,
          brandName: displayName.trim(),
          displayName: displayName.trim(),
          isActive: true,
          subscriptionStatus: "none",
          hasLaunchedFirstIRL: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (inviteCreatorId) {
        router.push(`/brand/new-campaign?creatorId=${inviteCreatorId}`);
        return;
      }

      router.push("/brand/dashboard");
    } catch (err: any) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border p-6 shadow-sm space-y-4 bg-white text-slate-900"
      >
        <h1 className="text-2xl font-semibold">
          {claimMode ? "Claim creator profile" : "Sign up"}
        </h1>

        {claimMode && (
          <div className="rounded-xl border border-pink-200 bg-pink-50 p-4 text-sm text-slate-700">
            Create your creator account using the email connected to this listed
            profile. We’ll send a verification link before activating the claim.
          </div>
        )}

        <input
          className="w-full border rounded-lg px-3 py-2 bg-white text-slate-900"
          placeholder="Display name / Brand name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />

        <input
          className="w-full border rounded-lg px-3 py-2 bg-white text-slate-900"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          className="w-full border rounded-lg px-3 py-2 bg-white text-slate-900"
          placeholder="Create Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {!claimMode && (
          <select
            className="w-full border rounded-lg px-3 py-2 bg-white text-slate-900"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="creator">Creator</option>
            <option value="brand">Brand</option>
          </select>
        )}

        {role === "brand" && (
          <div className="rounded-xl border border-pink-200 bg-pink-50 p-4 text-sm text-slate-700">
            Start your free first IRL campaign now. A 14-day trial with credit
            card is only required when you invite creators or unlock the IRL
            Campaign Network.
          </div>
        )}

        {role === "creator" && !claimMode && (
          <>
            <input
              className="w-full border rounded-lg px-3 py-2 bg-white text-slate-900"
              placeholder="Creator handle (TikTok or Instagram)"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
            />

            <input
              className="w-full border rounded-lg px-3 py-2 bg-white text-slate-900"
              placeholder="Categories (comma separated, e.g. dupes, skincare)"
              value={categoriesInput}
              onChange={(e) => setCategoriesInput(e.target.value)}
              required
            />

            <textarea
              className="w-full border rounded-lg px-3 py-2 bg-white text-slate-900"
              placeholder="Bio (optional)"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
            />
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black text-white py-2 disabled:opacity-60"
        >
          {loading
            ? "Creating account..."
            : claimMode
            ? "Create account and verify claim"
            : "Create account"}
        </button>

        <p className="text-sm text-center text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}