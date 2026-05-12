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
      <main className="min-h-screen bg-[#060712] px-4 py-10 text-white">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 shadow-2xl backdrop-blur">
          <p className="text-sm text-white/70">Checking session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#060712] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute left-[-12rem] top-[-12rem] h-[32rem] w-[32rem] rounded-full bg-fuchsia-600/25 blur-3xl" />
        <div className="absolute right-[-10rem] top-[8rem] h-[34rem] w-[34rem] rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-[-16rem] left-[30%] h-[36rem] w-[36rem] rounded-full bg-amber-400/10 blur-3xl" />
      </div>

      <section className="relative mx-auto grid min-h-screen max-w-7xl gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[1.12fr_0.88fr] lg:px-10 lg:py-10">
        <div className="flex flex-col justify-between gap-10">
          <header className="flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-black tracking-tight sm:text-2xl">Goshsha</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200/80">
                IRL Campaign Network
              </p>
            </div>

            <Link
              href="/signup"
              className="rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-black/20 transition hover:bg-white/15"
            >
              Join Network
            </Link>
          </header>

          <div className="max-w-4xl">
            <div className="mb-6 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-100">
              Built for brands operating at the speed of culture
            </div>

            <h1 className="text-5xl font-black tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl xl:text-8xl">
              Launch IRL creator campaigns in minutes — not months.
            </h1>

            <p className="mt-7 max-w-3xl text-lg leading-8 text-white/72 sm:text-xl">
              In today&apos;s social-media-driven world, fast execution can mean
              millions. Goshsha helps brands activate creator influence instantly
              at the aisle, where shoppers are already deciding what to buy.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup?role=brand"
                className="rounded-full bg-white px-6 py-3 text-sm font-black text-[#070817] shadow-2xl shadow-cyan-500/20 transition hover:scale-[1.02]"
              >
                Launch as a Brand
              </Link>
              <Link
                href="/signup?role=creator"
                className="rounded-full border border-white/15 bg-white/10 px-6 py-3 text-sm font-black text-white transition hover:bg-white/15"
              >
                Join as a Creator
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
                <p className="text-3xl font-black">IRL</p>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  Influence activated at the real-world buying moment.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
                <p className="text-3xl font-black">Fast</p>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  Campaigns that move with trends, not agency timelines.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
                <p className="text-3xl font-black">Measurable</p>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  Turn shelf attention into shopper engagement data.
                </p>
              </div>
            </div>
          </div>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-6">
            <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-fuchsia-200/80">
                  The dangerous difference
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                  Other platforms manage influence. Goshsha deploys it.
                </h2>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10">
              <div className="grid grid-cols-2 bg-white/10 text-xs font-black uppercase tracking-[0.18em] text-white/70">
                <div className="border-r border-white/10 p-4">Agency / Feed Model</div>
                <div className="p-4">Goshsha IRL Campaign Network</div>
              </div>

              {comparisonRows.map((row) => (
                <div
                  key={row.old}
                  className="grid grid-cols-2 border-t border-white/10 text-sm leading-6"
                >
                  <div className="border-r border-white/10 bg-black/10 p-4 text-white/58">
                    {row.old}
                  </div>
                  <div className="bg-cyan-300/[0.06] p-4 font-semibold text-white">
                    {row.goshsha}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-[2rem] border border-white/12 bg-white/[0.08] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7">
            <div className="mb-7">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/75">
                Account Access
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight">Log in</h2>
              <p className="mt-3 text-sm leading-6 text-white/65">
                Access your Goshsha IRL Campaign Network dashboard.
              </p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-white/75">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-white/75">
                    Password
                  </label>
                  <input
                    type="password"
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              {error && (
                <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </p>
              )}

              {message && (
                <p className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  {message}
                </p>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#070817] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Logging In..." : "Log In"}
                </button>

                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="rounded-2xl border border-white/12 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  Reset Password
                </button>
              </div>
            </form>

            <div className="mt-6 rounded-3xl border border-white/10 bg-black/18 p-5">
              <p className="text-sm text-white/70">
                Need an account?{" "}
                <Link href="/signup" className="font-black text-cyan-100 underline decoration-cyan-100/40 underline-offset-4">
                  Sign up for access
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[2rem] border border-white/10 bg-gradient-to-br from-fuchsia-500/15 to-cyan-500/10 p-6 shadow-2xl shadow-black/20 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-white/60">
              Why now
            </p>
            <h3 className="mt-3 text-2xl font-black tracking-tight">
              Viral moments don&apos;t wait for agency timelines.
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/68">
              Culture moves in hours. Traditional influencer operations often
              move in weeks. Goshsha compresses the path from campaign idea to
              creator activation to real-world shelf influence.
            </p>
          </div>
        </aside>
      </section>

      <section className="relative mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-10">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-7 shadow-2xl shadow-black/20 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/70">
              For Brands
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Turn retail shelves into agile creator-powered media.
            </h2>
            <p className="mt-4 leading-7 text-white/66">
              Launch faster, learn faster, and influence shoppers while they are
              standing in front of the product.
            </p>
            <div className="mt-6 grid gap-3">
              {brandBenefits.map((benefit) => (
                <div key={benefit} className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm font-semibold leading-6 text-white/82">
                  {benefit}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-7 shadow-2xl shadow-black/20 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-100/70">
              For Creators
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Your influence should not disappear in the feed.
            </h2>
            <p className="mt-4 leading-7 text-white/66">
              Goshsha lets your content keep working inside real shopping
              moments, where your recommendations can shape what people buy.
            </p>
            <div className="mt-6 grid gap-3">
              {creatorBenefits.map((benefit) => (
                <div key={benefit} className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm font-semibold leading-6 text-white/82">
                  {benefit}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.06] p-7 text-center shadow-2xl shadow-black/20 backdrop-blur sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-100/70">
            The new retail equation
          </p>
          <h2 className="mx-auto mt-4 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
            Real-world shelf influence + instant campaign execution = a faster path to revenue.
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-white/66 sm:text-lg">
            Goshsha is not another influencer marketplace. It is an on-demand IRL
            retail activation engine for brands and creators who know that speed,
            timing, and purchase intent can change everything.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup?role=brand"
              className="rounded-full bg-white px-6 py-3 text-sm font-black text-[#070817] transition hover:scale-[1.02]"
            >
              Start a Brand Campaign
            </Link>
            <Link
              href="/signup?role=creator"
              className="rounded-full border border-white/15 bg-white/10 px-6 py-3 text-sm font-black text-white transition hover:bg-white/15"
            >
              Become an IRL Creator
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
