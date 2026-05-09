"use client";

import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";

type HeaderUser = {
  uid: string;
  email: string;
  displayName: string;
  roles: string[];
  isAdmin: boolean;
};

function getInitials(name: string, email: string) {
  const source = (name || email || "U").trim();
  if (!source) return "U";

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<HeaderUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        const data: any = snap.exists() ? snap.data() : {};

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || data.email || "",
          displayName: data.displayName || firebaseUser.displayName || "",
          roles: Array.isArray(data.roles) ? data.roles : [],
          isAdmin: data.isAdmin === true,
        });
      } catch {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          displayName: firebaseUser.displayName || "",
          roles: [],
          isAdmin: false,
        });
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  async function handleLogout() {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function getNavItems() {
    const isAuthPage =
      pathname === "/" || pathname === "/login" || pathname === "/signup";

    if (!user) {
      if (isAuthPage) {
        return [{ href: "/", label: "Home" }];
      }

      return [
        { href: "/", label: "Home" },
        { href: "/login", label: "Log In" },
        { href: "/signup", label: "Sign Up" },
      ];
    }

    if (user.isAdmin) {
      return [{ href: "/admin/review", label: "Admin Review" }];
    }

    if (user.roles.includes("brand")) {
      return [
        { href: "/brand/dashboard", label: "Dashboard" },
        { href: "/brand/creators", label: "IRL Campaign Creators Network" },
      ];
    }

    if (user.roles.includes("creator")) {
      return [
        { href: "/creator/dashboard", label: "Dashboard" },
        { href: "/creator/profile", label: "Profile" },
      ];
    }

    return [{ href: "/account", label: "My Account" }];
  }

  const navItems = getNavItems();
  const initials = getInitials(user?.displayName || "", user?.email || "");

  return (
    <header
      style={{
        width: "100%",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            flexWrap: "wrap",
          }}
        >
        <Link
          href={user ? "/account" : "/"}  
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "1.05rem",
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: "-0.02em",
          }}
        >
          <img
            src="/goshsha-logo.png"
            alt="Goshsha"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              objectFit: "cover",
              background: "white",
              padding: "3px",
              border: "1px solid var(--border)",
            }}
          />
          <span>Goshsha IRL Campaign Network</span>
        </Link>

          {!loading && (
            <nav style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "12px",
                    border: `1px solid ${
                      isActive(item.href)
                        ? "var(--primary)"
                        : "var(--secondary-border)"
                    }`,
                    background: isActive(item.href)
                      ? "var(--primary)"
                      : "transparent",
                    color: isActive(item.href)
                      ? "var(--primary-text)"
                      : "var(--text-soft)",
                    fontWeight: 500,
                    fontSize: "0.95rem",
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {!loading && user && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "999px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--surface-muted)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                fontWeight: 700,
                fontSize: "0.9rem",
              }}
            >
              {initials}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.2,
              }}
            >
              <span
                style={{
                  color: "var(--text)",
                  fontWeight: 600,
                  fontSize: "0.92rem",
                }}
              >
                {user.displayName || user.email || "Account"}
              </span>
              <span
                style={{
                  color: "var(--text-faint)",
                  fontSize: "0.8rem",
                }}
              >
                {user.isAdmin
                  ? "Admin"
                  : user.roles.includes("brand")
                  ? "Brand"
                  : user.roles.includes("creator")
                  ? "Creator"
                  : "User"}
              </span>
            </div>

            <button className="app-button-secondary" onClick={handleLogout}>
              Log Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}