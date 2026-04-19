"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          router.push("/login");
          return;
        }

        const data = userSnap.data();
        const roles = Array.isArray(data.roles) ? data.roles : [];
        const isAdmin = data.isAdmin === true;

        if (isAdmin) {
          router.push("/admin/review");
          return;
        }

        if (roles.includes("brand")) {
          router.push("/brand/dashboard");
          return;
        }

        if (roles.includes("creator")) {
          router.push("/creator/dashboard");
          return;
        }

        router.push("/login");
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <main className="app-page">
        <div className="app-shell">
          <p className="app-subtitle">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page">
      <div className="app-shell" style={{ maxWidth: "720px" }}>
        <div className="app-card app-card-padding" style={{ marginTop: "40px" }}>
          <h1 className="app-title">Goshsha Marketplace</h1>
          <p className="app-subtitle">
            Creator and brand collaboration platform for live campaigns.
          </p>

          <div style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link href="/login" className="app-button">
              Log In
            </Link>
            <Link href="/signup" className="app-button-secondary">
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}