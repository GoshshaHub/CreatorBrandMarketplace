"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";

export default function AccountRouterPage() {
  const router = useRouter();
  const hasRedirectedRef = useRef(false);
  const [message, setMessage] = useState("Checking your account...");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (hasRedirectedRef.current) return;

      if (!user) {
        hasRedirectedRef.current = true;
        router.replace("/login");
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setMessage(
          "Your login exists, but your Goshsha profile has not been completed yet."
        );
        return;
      }

        const data = userSnap.data();
        const roles = Array.isArray(data.roles) ? data.roles : [];
        const isAdmin = data.isAdmin === true;

        hasRedirectedRef.current = true;

        // IMPORTANT: creator FIRST
        if (roles.includes("creator")) {
        router.replace("/creator/dashboard");
        return;
        }

        if (roles.includes("brand")) {
        router.replace("/brand/dashboard");
        return;
        }

        if (isAdmin) {
        router.replace("/admin/review");
        return;
        }

        setMessage("No valid role was found for this account.");
      } catch {
        setMessage("We couldn’t route your account right now.");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <main className="app-page">
      <div className="app-shell" style={{ maxWidth: "640px" }}>
        <div className="app-card app-card-padding" style={{ marginTop: "40px" }}>
          <h1 className="app-title">Redirecting</h1>
          <p className="app-subtitle">{message}</p>

          {message !== "Checking your account..." && (
            <div style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Link
                href="/signup?role=creator"
                className="app-button-secondary"
                style={{
                  backgroundColor: "#0f172a",
                  color: "#ffffff",
                  textDecoration: "none",
                }}
              >
                Complete Creator Profile
              </Link>

              <button
                type="button"
                onClick={async () => {
                  await auth.signOut();
                  router.replace("/login");
                }}
                className="app-button-secondary"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}