"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { loginUser, sendResetPasswordEmail } from "../../lib/auth";

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
      <main className="min-h-screen bg-[#fbfcff] px-4 py-10 text-[#0c1433] dark:bg-[#070817] dark:text-white">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl dark:border-white/10 dark:bg-white/[0.06]">
          <p className="text-sm text-slate-600 dark:text-white/70">
            Checking session...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfcff] text-[#0b1234] dark:bg-[#070817] dark:text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-14rem] top-[-18rem] h-[34rem] w-[34rem] rounded-full bg-fuchsia-300/35 blur-3xl dark:bg-fuchsia-600/20" />
        <div className="absolute right-[-16rem] top-[6rem] h-[36rem] w-[36rem] rounded-full bg-orange-200/35 blur-3xl dark:bg-cyan-500/16" />
        <div className="absolute bottom-[-18rem] left-[22%] h-[34rem] w-[34rem] rounded-full bg-cyan-100/70 blur-3xl dark:bg-amber-400/8" />
        <div className="absolute inset-y-0 right-0 hidden w-[28rem] bg-[radial-gradient(circle,_rgba(236,72,153,0.20)_1px,_transparent_1px)] [background-size:18px_18px] opacity-40 sm:block dark:opacity-20" />
      </div>

      <section className="relative mx-auto grid min-h-screen max-w-7xl gap-8 px-5 py-5 sm:px-8 lg:grid-cols-[1.12fr_0.88fr] lg:px-10 lg:py-6">
        <div className="flex flex-col justify-between gap-8">
          <header className="flex items-center justify-between gap-4 border-b border-slate-200/70 pb-5 dark:border-white/10">
        <div className="max-w-6xl">
          <p className="text-3xl font-black leading-tight tracking-tight text-[#0B1142] sm:text-4xl">
            The Real IRL influence that activates directly from products, where it matters
          </p>

          <p className="mt-3 text-base font-semibold text-[#0B1142]/70 sm:text-xl">
            Not just content creation. Real-world shopper activation.
          </p>
        </div>

            <Link
              href="/signup"
              className="rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 px-5 py-3 text-sm font-black text-white shadow-lg shadow-pink-500/25 transition hover:translate-y-[-1px] hover:shadow-xl"
            >
              Join Network
            </Link>
          </header>

          <div className="max-w-4xl pt-4 lg:pt-6">
            <div className="mb-6 inline-flex rounded-full border border-orange-200 bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-orange-600 shadow-sm dark:border-orange-300/20 dark:bg-white/8 dark:text-orange-200">
              Real influence. Real results. Real fast.
            </div>

            <h1 className="max-w-4xl text-5xl font-black leading-[0.96] tracking-[-0.06em] text-[#0b1234] sm:text-6xl lg:text-7xl">
              Launch IRL creator campaigns that{" "}
              <span className="bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 bg-clip-text text-transparent">
                influence at the shelf
              </span>{" "}
              — not lost in feed.
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-700 sm:text-xl dark:text-white/72">
              In today&apos;s social-media-driven world, strategic fast execution can mean
              millions. Goshsha helps brands activate creator influence
              instantly at the aisle, where shoppers are already deciding what
              to buy.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Link
                href="/signup?role=brand"
                className="group rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 px-7 py-5 text-center text-base font-black text-white shadow-xl shadow-pink-500/20 transition hover:translate-y-[-2px] hover:shadow-2xl"
              >
                <span className="flex items-center justify-center gap-3">
                  I&apos;m a Brand{" "}
                  <span className="text-2xl leading-none transition group-hover:translate-x-1">
                    →
                  </span>
                </span>
                <span className="mt-1 block text-xs font-semibold text-white/90">
                  Launch Campaigns
                </span>
              </Link>

              <Link
                href="/signup?role=creator"
                className="group rounded-2xl bg-gradient-to-r from-violet-100 via-fuchsia-100 to-orange-100 px-7 py-5 text-center text-base font-black text-violet-700 shadow-lg shadow-violet-500/10 ring-1 ring-violet-200/70 transition hover:translate-y-[-2px] hover:shadow-xl dark:from-white/12 dark:via-fuchsia-500/15 dark:to-orange-500/15 dark:text-white dark:ring-white/10"
              >
                <span className="flex items-center justify-center gap-3">
                  I&apos;m a Creator{" "}
                  <span className="text-2xl leading-none transition group-hover:translate-x-1">
                    →
                  </span>
                </span>
                <span className="mt-1 block text-xs font-semibold text-violet-500 dark:text-white/80">
                  Join the Network
                </span>
              </Link>
            </div>

            <div className="mt-8 grid overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm backdrop-blur sm:grid-cols-4 dark:border-white/10 dark:bg-white/[0.06]">
              {quickStats.map((stat, index) => (
                <div
                  key={stat.label}
                  className={`flex items-center gap-3 p-4 ${
                    index > 0
                      ? "border-t border-slate-200 sm:border-l sm:border-t-0 dark:border-white/10"
                      : ""
                  }`}
                >
                  <span className="text-2xl text-pink-500">{stat.icon}</span>
                  <div>
                    <p className="text-xs font-black text-[#0b1234] dark:text-white">
                      {stat.label}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-white/60">
                      {stat.sublabel}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <section className="rounded-[2rem] border border-slate-200 bg-white/92 p-5 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-6 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/20">
            <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-fuchsia-500 dark:text-fuchsia-200/80">
                  The powerful difference
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                  Other platforms manage influence. Goshsha deploys it.
                </h2>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10">
              <div className="grid grid-cols-2 bg-slate-50 text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:bg-white/10 dark:text-white/70">
                <div className="border-r border-slate-200 p-4 dark:border-white/10">
                  Agency / Feed Model
                </div>
                <div className="p-4">Goshsha IRL Campaign Network</div>
              </div>

              {comparisonRows.map((row) => (
                <div
                  key={row.old}
                  className="grid grid-cols-2 border-t border-slate-200 text-sm leading-6 dark:border-white/10"
                >
                  <div className="border-r border-slate-200 bg-white p-4 text-slate-500 dark:border-white/10 dark:bg-black/10 dark:text-white/58">
                    {row.old}
                  </div>
                  <div className="bg-gradient-to-r from-emerald-50 to-orange-50 p-4 font-semibold text-[#0b1234] dark:from-cyan-300/[0.06] dark:to-emerald-300/[0.06] dark:text-white">
                    {row.goshsha}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[2rem] border border-slate-200 bg-white/92 p-5 shadow-xl shadow-slate-200/70 backdrop-blur-xl sm:p-7 dark:border-white/12 dark:bg-white/[0.08] dark:shadow-black/40">
            <div className="mb-7">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-pink-500 dark:text-cyan-100/75">
                Account Access
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight">
                Welcome back
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-white/65">
                Log in to your Goshsha IRL Campaign Network dashboard.
              </p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-[#0b1234] dark:text-white/75">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[#0b1234] outline-none transition placeholder:text-slate-400 focus:border-pink-400 focus:ring-4 focus:ring-pink-400/10 dark:border-white/10 dark:bg-black/25 dark:text-white dark:placeholder:text-white/28 dark:focus:border-cyan-300/60 dark:focus:ring-cyan-300/10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-[#0b1234] dark:text-white/75">
                    Password
                  </label>
                  <input
                    type="password"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[#0b1234] outline-none transition placeholder:text-slate-400 focus:border-pink-400 focus:ring-4 focus:ring-pink-400/10 dark:border-white/10 dark:bg-black/25 dark:text-white dark:placeholder:text-white/28 dark:focus:border-cyan-300/60 dark:focus:ring-cyan-300/10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetPassword}
                className="mt-4 text-sm font-semibold text-violet-600 underline-offset-4 hover:underline dark:text-cyan-100"
              >
                Forgot password?
              </button>

              {error && (
                <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-100">
                  {error}
                </p>
              )}

              {message && (
                <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 px-5 py-4 text-sm font-black text-white shadow-lg shadow-pink-500/20 transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Logging In..." : "Log In"}
              </button>
            </form>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-white/10 dark:bg-black/18">
              <p className="text-sm text-slate-600 dark:text-white/70">
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="font-black text-pink-600 underline decoration-pink-300 underline-offset-4 dark:text-cyan-100 dark:decoration-cyan-100/40"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[2rem] border border-pink-100 bg-gradient-to-br from-pink-50 via-white to-orange-50 p-6 shadow-lg shadow-pink-100/50 backdrop-blur dark:border-white/10 dark:from-fuchsia-500/15 dark:to-cyan-500/10 dark:shadow-black/20">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-500 dark:text-white/60">
              Why now
            </p>
            <h3 className="mt-3 text-2xl font-black tracking-tight">
              Viral moments don&apos;t wait for agency timelines.
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-white/68">
              Culture moves in hours. Traditional influencer operations often
              move in weeks. Goshsha compresses the path from campaign idea to
              creator activation to real-world shelf influence.
            </p>
          </div>
        </aside>
      </section>

      <section className="relative mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-10">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-200 bg-white/92 p-7 shadow-xl shadow-slate-200/60 backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/20">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-pink-500 dark:text-cyan-100/70">
              For Brands
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Turn retail shelves into agile creator-powered media.
            </h2>
            <p className="mt-4 leading-7 text-slate-600 dark:text-white/66">
              Launch faster, learn faster, and influence shoppers while they are
              standing in front of the product.
            </p>
            <div className="mt-6 grid gap-3">
              {brandBenefits.map((benefit) => (
                <div
                  key={benefit}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700 dark:border-white/10 dark:bg-black/15 dark:text-white/82"
                >
                  {benefit}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white/92 p-7 shadow-xl shadow-slate-200/60 backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/20">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-500 dark:text-fuchsia-100/70">
              For Creators
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Your influence should not disappear in the feed.
            </h2>
            <p className="mt-4 leading-7 text-slate-600 dark:text-white/66">
              Goshsha lets your content keep working inside real shopping
              moments, where your recommendations can shape what people buy.
            </p>
            <div className="mt-6 grid gap-3">
              {creatorBenefits.map((benefit) => (
                <div
                  key={benefit}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700 dark:border-white/10 dark:bg-black/15 dark:text-white/82"
                >
                  {benefit}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[2rem] border border-slate-200 bg-white/92 p-7 text-center shadow-xl shadow-slate-200/60 backdrop-blur sm:p-10 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/20">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-500 dark:text-amber-100/70">
            The new retail equation
          </p>
          <h2 className="mx-auto mt-4 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
            Real-world shelf influence + instant campaign execution = a faster
            path to revenue.
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg dark:text-white/66">
            Goshsha is not another influencer marketplace. It is an on-demand
            IRL retail activation engine for brands and creators who know that
            speed, timing, and purchase intent can change everything.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup?role=brand"
              className="rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 px-7 py-4 text-sm font-white text-black shadow-lg shadow-pink-500/25 transition hover:translate-y-[-1px]"
            >
              Start a Brand Campaign
            </Link>
            <Link
              href="/signup?role=creator"
              className="rounded-2xl border border-violet-200 bg-violet-50 px-7 py-4 text-sm font-black text-violet-700 transition hover:bg-violet-100 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            >
              Become an IRL Creator
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

