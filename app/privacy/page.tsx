export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#fbfcff] px-5 py-12 text-[#0b1234] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Last Updated: June 2026
        </p>

        <div className="mt-10 space-y-10 text-[15px] leading-7 text-slate-700">
          
          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              1. Overview
            </h2>
            <p className="mt-3">
              Goshsha ("we", "our", or "us") provides a platform that connects
              brands and creators while enabling real-world product interaction
              through scanning and content activation. This Privacy Policy
              explains how we collect, use, and protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              2. Information We Collect
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Name, email, and account credentials</li>
              <li>Profile information (brand or creator details)</li>
              <li>Campaign data (pricing, submissions, timelines)</li>
              <li>Scan activity and product interaction data</li>
              <li>Device and usage analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              3. How We Use Your Information
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Operate the Goshsha platform and marketplace</li>
              <li>Enable product scanning and content discovery</li>
              <li>Facilitate brand-creator campaigns</li>
              <li>Process payments and payouts</li>
              <li>Improve product experience and analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              4. Sharing of Information
            </h2>
            <p className="mt-3">
              We do not sell your personal data. We may share information with:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Brands and creators within the platform</li>
              <li>Payment providers (e.g., Stripe)</li>
              <li>Infrastructure providers (e.g., Firebase)</li>
              <li>Legal authorities when required</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              5. Creator Content
            </h2>
            <p className="mt-3">
              Content submitted by creators may be displayed in the app and
              associated with real-world products. Content linked from external
              platforms remains subject to those platforms' privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              6. Data Retention
            </h2>
            <p className="mt-3">
              We retain data as long as necessary to operate the platform,
              fulfill legal obligations, and improve our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              7. Security
            </h2>
            <p className="mt-3">
              We implement reasonable security measures, but no system is
              completely secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              8. Your Rights
            </h2>
            <p className="mt-3">
              You may request access, correction, or deletion of your data by
              contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              9. Contact
            </h2>
            <p className="mt-3">
              Email: support@goshsha.com
              <br />
              Address: 430 S Anaheim Hills Road, Suite G, Anaheim, CA, USA
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}