"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import ProtectedRoute from "../../../../components/ProtectedRoute";

const platformOptions = [
  "TikTok",
  "Instagram",
  "YouTube",
  "Facebook",
  "Pinterest",
  "Snapchat",
  "X",
  "Blog",
];

const followerRangeOptions = [
  "Less than 1K",
  "1K-5K",
  "5K-10K",
  "Over 10K",
];

export default function AddListedCreatorPage() {
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [categories, setCategories] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [followerRange, setFollowerRange] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function togglePlatform(platform: string) {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const categoryArray = categories
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      await addDoc(collection(db, "creators"), {
        displayName: displayName.trim(),
        handle: handle.trim(),
        email: email.trim().toLowerCase(),
        contactEmail: email.trim().toLowerCase(),
        bio: bio.trim(),
        categories: categoryArray,
        platforms,
        followerRange,
        profileUrl: profileUrl.trim(),
        profilePhotoUrl: profilePhotoUrl.trim(),
        creatorStatus: "listed",
        isMarketplaceVisible: true,
        campaignsCompleted: 0,
        totalCampaignViews: 0,
        topProductSlug: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMessage("Listed creator added successfully.");
      setDisplayName("");
      setHandle("");
      setEmail("");
      setBio("");
      setCategories("");
      setPlatforms([]);
      setFollowerRange("");
      setProfileUrl("");
      setProfilePhotoUrl("");
    } catch (err: any) {
      setError(err?.message || "Unable to add listed creator.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedRoute allowedRole="admin">
      <main className="min-h-screen bg-white text-slate-900">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <h1 className="text-3xl font-black">Add Listed Creator</h1>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-2xl border p-6">
            <input className="w-full rounded-xl border px-4 py-3" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            <input className="w-full rounded-xl border px-4 py-3" placeholder="@handle" value={handle} onChange={(e) => setHandle(e.target.value)} required />
            <input className="w-full rounded-xl border px-4 py-3" type="email" placeholder="Verification email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="w-full rounded-xl border px-4 py-3" placeholder="Profile URL" value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)} />
            <input className="w-full rounded-xl border px-4 py-3" placeholder="Profile photo URL" value={profilePhotoUrl} onChange={(e) => setProfilePhotoUrl(e.target.value)} />

            <textarea className="w-full rounded-xl border px-4 py-3" rows={4} placeholder="Bio" value={bio} onChange={(e) => setBio(e.target.value)} />

            <input className="w-full rounded-xl border px-4 py-3" placeholder="Categories, comma separated" value={categories} onChange={(e) => setCategories(e.target.value)} />

            <div>
              <p className="font-bold">Platforms</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {platformOptions.map((platform) => (
                  <label key={platform} className="flex gap-2">
                    <input type="checkbox" checked={platforms.includes(platform)} onChange={() => togglePlatform(platform)} />
                    {platform}
                  </label>
                ))}
              </div>
            </div>

            <select className="w-full rounded-xl border px-4 py-3" value={followerRange} onChange={(e) => setFollowerRange(e.target.value)} required>
              <option value="">Select follower range</option>
              {followerRangeOptions.map((range) => (
                <option key={range} value={range}>{range}</option>
              ))}
            </select>

            {message && <p className="text-green-700 font-semibold">{message}</p>}
            {error && <p className="text-red-600 font-semibold">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl px-5 py-3 font-bold"
              style={{ backgroundColor: "#0f172a", color: "#ffffff" }}
            >
              {saving ? "Saving..." : "Add Listed Creator"}
            </button>
          </form>
        </div>
      </main>
    </ProtectedRoute>
  );
}