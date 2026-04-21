"use client";

import Link from "next/link";
import { useState } from "react";
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    if (role === "creator") {
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
      const categories =
        role === "creator"
          ? categoriesInput
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : [];

      const credential = await signupUser(email, password, displayName.trim());
      const uid = credential.user.uid;

      await setDoc(
        doc(db, "users", uid),
        {
          email: email.trim().toLowerCase(),
          displayName: displayName.trim(),
          roles: [role],
          isActive: true,
          photoURL: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (role === "creator") {
        await setDoc(
          doc(db, "creators", uid),
          {
            userId: uid,
            email: email.trim().toLowerCase(),
            contactEmail: email.trim().toLowerCase(),
            displayName: displayName.trim(),
            handle: handle.trim(),
            bio: bio.trim(),
            categories,
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
      } else {
        await setDoc(
          doc(db, "brands", uid),
          {
            userId: uid,
            email: email.trim().toLowerCase(),
            contactEmail: email.trim().toLowerCase(),
            brandName: displayName.trim(),
            displayName: displayName.trim(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        router.push("/brand/dashboard");
      }
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
        className="w-full max-w-md rounded-2xl border p-6 shadow-sm space-y-4"
      >
        <h1 className="text-2xl font-semibold">Sign up</h1>

        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />

        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <select
          className="w-full border rounded-lg px-3 py-2"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
        >
          <option value="creator">Creator</option>
          <option value="brand">Brand</option>
        </select>

        {role === "creator" && (
          <>
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Creator handle (TikTok or Instagram)"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
            />

            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Categories (comma separated, e.g. dupes, skincare)"
              value={categoriesInput}
              onChange={(e) => setCategoriesInput(e.target.value)}
              required
            />

            <textarea
              className="w-full border rounded-lg px-3 py-2"
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
          className="w-full rounded-lg bg-black text-white py-2"
        >
          {loading ? "Creating account..." : "Create account"}
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