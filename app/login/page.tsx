"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { loginUser, sendResetPasswordEmail } from "../../lib/auth";

/* --- DATA --- */
const comparisonRows = [
  {
    old: "Weeks of agency coordination",
    goshsha: "Launch creator-powered retail campaigns in minutes",
  },
  {
    old: "Content trapped in social feeds",
    goshsha: "Creator influence activated at the real-world product shelf",
  },
  {
    old: "Passive scrolling and awareness metrics",
    goshsha: "Shopper engagement during active purchase intent",
  },
  {
    old: "Campaigns move slower than culture",
    goshsha: "Agile execution built for social-speed trends",
  },
  {
    old: "Creators post, then the moment disappears",
    goshsha: "Creator content keeps working when shoppers scan products IRL",
  },
  {
    old: "Retail shelves stay static",
    goshsha: "The shelf becomes programmable, measurable, and creator-powered",
  },
];

const quickStats = [
  { label: "Minutes", sublabel: "to Launch", icon: "⏱" },
  { label: "IRL Influence", sublabel: "at the Shelf", icon: "⌘" },
  { label: "Active Purchase", sublabel: "Intent", icon: "♡" },
  { label: "Measurable In-Store Data", sublabel: "Impact", icon: "▣" },
];

const brandBenefits = [
  "Launch campaigns without waiting weeks for agencies or third-party coordination.",
  "Respond to viral trends while the buying moment is still alive.",
  "Activate creator content at the aisle, where shoppers are deciding.",
  "Turn retail traffic you already have into measurable shopper engagement.",
];

const creatorBenefits = [
  "Get discovered beyond social feeds and algorithms.",
  "Let your content influence real shoppers during product scans.",
  "Partner with brands looking for fast, agile IRL campaigns.",
  "Build proof that your influence reaches actual buying moments.",
];

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
      <main className="min-h-screen bg-[#fbfcff] px-4 py-10 text-[#0c1433]">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl">
          <p className="text-sm text-slate-600">Checking session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#fde7ff_0%,#ffffff_38%,#ecfeff_100%)] text-[#0B1142]">
      
      {/* Glow Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-14rem] top-[-18rem] h-[34rem] w-[34rem] rounded-full bg-fuchsia-300/35 blur-3xl" />
        <div className="absolute right-[-16rem] top-[6rem] h-[36rem] w-[36rem] rounded-full bg-orange-200/35 blur-3xl" />
        <div className="absolute bottom-[-18rem] left-[22%] h-[34rem] w-[34rem] rounded-full bg-cyan-100/70 blur-3xl" />
      </div>

      {/* Layout */}
      <section className="relative mx-auto grid min-h-screen max-w-7xl gap-8 px-5 py-5 lg:grid-cols-[1.12fr_0.88fr] lg:px-10">

        {/* LEFT */}
        <div className="flex flex-col justify-between gap-8">

          {/* HEADER */}
          <header className="flex items-center justify-between border-b border-slate-200 pb-5">
            <div>
              <p className="text-3xl font-black">
                The Real IRL influence that activates directly from products, where it matters
              </p>
              <p className="mt-3 text-lg text-slate-600">
                Not just content creation. Real-world shopper activation.
              </p>
            </div>

            <Link
              href="/signup"
              className="rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 px-5 py-3 font-bold text-white shadow-lg"
            >
              Join Network
            </Link>
          </header>

          {/* HERO */}
          <div>
            <div className="mb-6 inline-flex rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-bold text-orange-600">
              Real influence. Real results. Real fast.
            </div>

            <h1 className="text-6xl font-black leading-[1] tracking-tight">
              Launch IRL creator campaigns that{" "}
              <span className="bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 bg-clip-text text-transparent">
                influence at the shelf
              </span>{" "}
              — not lost in feed.
            </h1>

            <p className="mt-6 text-lg text-slate-700 max-w-2xl">
              In today's social-media-driven world, fast execution can mean millions.
              Goshsha helps brands activate creator influence instantly at the aisle,
              where shoppers are already deciding what to buy.
            </p>
          </div>

          {/* COMPARISON TABLE — UNCHANGED */}
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-black mb-4">
              Other platforms manage influence. Goshsha deploys it.
            </h2>

            <div className="overflow-hidden rounded-3xl border border-slate-200">
              <div className="grid grid-cols-2 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <div className="p-4 border-r">Agency / Feed Model</div>
                <div className="p-4">Goshsha IRL Campaign Network</div>
              </div>

              {comparisonRows.map((row) => (
                <div key={row.old} className="grid grid-cols-2 border-t">
                  <div className="p-4 text-slate-500 border-r">{row.old}</div>
                  <div className="p-4 font-semibold bg-gradient-to-r from-emerald-50 to-orange-50">
                    {row.goshsha}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT LOGIN */}
        <aside>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-black mb-4">Welcome back</h2>

            <form onSubmit={handleLogin}>
              <input
                type="email"
                placeholder="Email"
                className="w-full mb-3 p-3 border rounded-xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                type="password"
                placeholder="Password"
                className="w-full mb-3 p-3 border rounded-xl"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button className="w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white py-3 rounded-xl font-bold">
                Log In
              </button>
            </form>
          </div>
        </aside>
      </section>
    </main>
  );
}