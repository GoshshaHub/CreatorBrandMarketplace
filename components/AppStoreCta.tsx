const GOSHSHA_APP_STORE_URL =
  "https://apps.apple.com/us/app/goshsha/id1521800052";

type AppStoreCtaProps = {
  description: string;
  className?: string;
};

export default function AppStoreCta({
  description,
  className = "",
}: AppStoreCtaProps) {
  return (
    <aside
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
        {description}
      </p>

      <a
        href={GOSHSHA_APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download Goshsha on the App Store (opens in a new tab)"
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-center text-sm font-bold !text-white shadow-sm transition hover:-translate-y-px hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2"
      >
        Download Goshsha on the App Store
      </a>
    </aside>
  );
}
