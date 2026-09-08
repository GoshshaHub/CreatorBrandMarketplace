"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "../lib/firebase";

type AllowedRole = "creator" | "brand" | "admin";

type Props = {
  allowedRole: AllowedRole;
  children: React.ReactNode;
};

type AccessState = "loading" | "allowed" | "unauthenticated" | "forbidden" | "error";

export default function ProtectedRoute({ allowedRole, children }: Props) {
  const router = useRouter();
  const [accessState, setAccessState] = useState<AccessState>("loading");
  const [message, setMessage] = useState("");
  const [fallbackPath, setFallbackPath] = useState("/login");

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribeProfile?.();
      unsubscribeProfile = null;

      if (!user) {
        setAccessState("unauthenticated");
        router.replace("/login");
        return;
      }

      setAccessState("loading");
      unsubscribeProfile = onSnapshot(
        doc(db, "users", user.uid),
        (userSnap) => {
        if (!userSnap.exists()) {
          setAccessState("loading");
          setMessage("Your profile is being initialized...");
          return;
        }

        const data = userSnap.data();
        const roles = Array.isArray(data.roles) ? data.roles : [];
        const isAdmin = data.isAdmin === true;

        let resolvedFallback = "/login";

        if (roles.includes("creator")) {
          resolvedFallback = "/creator/dashboard";
        } else if (roles.includes("brand")) {
          resolvedFallback = "/brand/dashboard";
        } else if (isAdmin) {
          resolvedFallback = "/admin/review";
        }

        setFallbackPath(resolvedFallback);

        if (allowedRole === "admin") {
          if (isAdmin) {
            setAccessState("allowed");
            return;
          }

          setAccessState("forbidden");
          setMessage("This page is only available to admin users.");
          return;
        }

        if (roles.includes(allowedRole)) {
          setAccessState("allowed");
          return;
        }

        setAccessState("forbidden");
        setMessage(`This page is not available for your account role.`);
        },
        (err) => {
          setAccessState("error");
          setMessage(err.message || "We couldn’t verify your access.");
        }
      );
    });

    return () => {
      unsubscribe();
      unsubscribeProfile?.();
    };
  }, [allowedRole, router]);

  if (accessState === "loading") {
    return (
      <div className="app-page">
        <div className="app-shell">
          <p className="app-subtitle">Checking access...</p>
        </div>
      </div>
    );
  }

  if (accessState === "allowed") {
    return <>{children}</>;
  }

  if (accessState === "unauthenticated") {
    return null;
  }

  return (
    <div className="app-page">
      <div className="app-shell" style={{ maxWidth: "680px" }}>
        <div className="app-card app-card-padding" style={{ marginTop: "40px" }}>
          <h1 className="app-title">Access Restricted</h1>
          <p className="app-subtitle" style={{ marginTop: "12px" }}>
            {message || "You do not have access to this page."}
          </p>

          <div style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link href={fallbackPath} className="app-button">
              Go to My Dashboard
            </Link>
            <Link href="/login" className="app-button-secondary">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
