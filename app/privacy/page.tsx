export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#fbfcff] px-5 py-12 text-[#0b1234] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Privacy Policy
        </h1>

        <p className="mt-3 text-sm text-slate-500">
          Last Updated: May 2026
        </p>

        <div className="mt-10 space-y-10 text-[15px] leading-7 text-slate-700">
          <section>
            <h2 className="text-xl font-black text-[#0b1234]">Overview</h2>
            <p className="mt-3">
              Welcome to Goshsha (“Goshsha,” “we,” “our,” or “us”). This
              Privacy Policy explains how we collect, use, disclose, and protect
              your information when you use the Goshsha mobile application, the
              Goshsha IRL Campaign Network, associated websites including
              irl.goshsha.com, and related services, features, and integrations.
            </p>
            <p className="mt-3">
              By using Goshsha, you agree to the terms of this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              1. Information We Collect
            </h2>

            <h3 className="mt-5 font-black text-[#0b1234]">
              1.1 Information You Provide
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Name, email address, and account credentials</li>
              <li>Profile details, including creator handle, brand name, bio, and social links</li>
              <li>Payment and payout details through third-party providers such as Stripe</li>
              <li>Campaign-related information, including briefs, pricing, timelines, and submissions</li>
              <li>Communications between creators and brands</li>
            </ul>

            <h3 className="mt-5 font-black text-[#0b1234]">
              1.2 Automatically Collected Information
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Device information, including device type, operating system, and browser</li>
              <li>IP address and approximate location</li>
              <li>App usage data, including features used, interactions, and session duration</li>
              <li>Scan activity, including products scanned, timestamps, and interactions with AR or content</li>
              <li>Engagement data, including views, clicks, shares, and conversions</li>
            </ul>
            <p className="mt-3">
              This information is core to how Goshsha works, especially for
              real-world product interaction, IRL campaign activation, and
              influence tracking.
            </p>

            <h3 className="mt-5 font-black text-[#0b1234]">
              1.3 Content and Media
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Creator-submitted content, links, embedded media, and campaign deliverables</li>
              <li>AR-related content tied to products, including videos, overlays, and metadata</li>
              <li>Public social media content linked by creators, including TikTok, Instagram, and YouTube content</li>
            </ul>

            <h3 className="mt-5 font-black text-[#0b1234]">
              1.4 Third-Party Data
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Social media platforms, if you connect accounts or submit links</li>
              <li>Payment processors such as Stripe</li>
              <li>Analytics providers such as Firebase and Apple App Analytics</li>
              <li>Affiliate and eCommerce partners</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              2. How We Use Your Information
            </h2>

            <h3 className="mt-5 font-black text-[#0b1234]">
              2.1 Provide Core Functionality
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Enable product scanning and content discovery</li>
              <li>Match brands with creators</li>
              <li>Facilitate campaign creation, funding, submission, approval, and completion</li>
              <li>Enable IRL activation of creator content at the point of product interaction</li>
            </ul>

            <h3 className="mt-5 font-black text-[#0b1234]">
              2.2 Improve the Platform
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Analyze scan behavior and engagement trends</li>
              <li>Optimize product matching and content relevance</li>
              <li>Improve user experience, performance, and platform reliability</li>
            </ul>

            <h3 className="mt-5 font-black text-[#0b1234]">
              2.3 Payments and Transactions
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Process campaign funding and creator payouts</li>
              <li>Manage platform fees</li>
              <li>Prevent fraud, abuse, payment misuse, and unauthorized activity</li>
            </ul>

            <h3 className="mt-5 font-black text-[#0b1234]">
              2.4 Communications
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Send notifications about campaign invites, funding, submissions, approvals, and payouts</li>
              <li>Provide account updates and support</li>
              <li>Send onboarding, operational, and service-related emails</li>
            </ul>

            <h3 className="mt-5 font-black text-[#0b1234]">
              2.5 Analytics and Measurement
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Measure campaign effectiveness</li>
              <li>Track engagement, including views, clicks, conversions, and scan-related actions</li>
              <li>Provide insights to brands and creators</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              3. How We Share Information
            </h2>
            <p className="mt-3">
              We do not sell your personal data.
            </p>

            <h3 className="mt-5 font-black text-[#0b1234]">
              3.1 Between Users
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Brands may see creator profiles, creator metrics, campaign submissions, and related information.</li>
              <li>Creators may see brand campaign details, campaign requirements, and contact information.</li>
            </ul>

            <h3 className="mt-5 font-black text-[#0b1234]">
              3.2 Service Providers
            </h3>
            <p className="mt-3">
              We may share information with trusted providers that help us
              operate the platform, including:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Stripe for payments and payouts</li>
              <li>Firebase, Google Cloud, or similar cloud infrastructure providers</li>
              <li>Email providers such as Postmark or similar services</li>
              <li>Analytics, security, hosting, and operational service providers</li>
            </ul>

            <h3 className="mt-5 font-black text-[#0b1234]">
              3.3 Legal Requirements
            </h3>
            <p className="mt-3">
              We may disclose information if required to comply with laws,
              respond to legal requests, enforce our terms, prevent fraud or
              abuse, or protect Goshsha, users, partners, or the public.
            </p>

            <h3 className="mt-5 font-black text-[#0b1234]">
              3.4 Business Transfers
            </h3>
            <p className="mt-3">
              If Goshsha is involved in a merger, acquisition, financing,
              restructuring, sale of assets, or similar transaction, your
              information may be transferred as part of that transaction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              4. Creator Content and Public Visibility
            </h2>
            <p className="mt-3">
              Content submitted by creators may be displayed within the Goshsha
              app, associated with specific products in retail environments, and
              visible to users who scan those products.
            </p>
            <p className="mt-3">
              If content is linked from public platforms such as TikTok,
              Instagram, or YouTube, that content remains subject to the privacy
              settings, terms, and policies of those platforms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              5. Data Retention
            </h2>
            <p className="mt-3">
              We retain your data for as long as your account is active, as
              needed to provide platform functionality, and as required for
              legal, financial, tax, security, fraud prevention, dispute
              resolution, and operational purposes.
            </p>
            <p className="mt-3">
              You may request deletion of your account and data as described
              below. Some information may be retained where required by law or
              where needed for legitimate business, compliance, security, or
              dispute-resolution purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              6. Data Security
            </h2>
            <p className="mt-3">
              We implement reasonable safeguards designed to protect your
              information, including secure cloud infrastructure, encrypted data
              transmission, access controls, and authentication measures.
            </p>
            <p className="mt-3">
              However, no method of transmission, storage, or electronic system
              is completely secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              7. Your Privacy Rights
            </h2>
            <p className="mt-3">
              Depending on your location, you may have rights to access your
              data, correct inaccurate data, request deletion, restrict or
              object to certain processing, or request data portability.
            </p>
            <p className="mt-3">
              For California residents, including under the CCPA/CPRA where
              applicable, you may have rights to request disclosure of personal
              information collected, request deletion of personal information,
              and opt out of certain data sharing where applicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              8. Account Deletion
            </h2>
            <p className="mt-3">
              You may request deletion of your account by contacting us at{" "}
              <strong>support@goshsha.com</strong>.
            </p>
            <p className="mt-3">
              We will delete or anonymize your data unless retention is required
              or permitted for legal, financial, security, fraud prevention,
              operational, or dispute-resolution reasons.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              9. Children’s Privacy
            </h2>
            <p className="mt-3">
              Goshsha is not intended for users under 13, or the applicable
              minimum age in your jurisdiction. We do not knowingly collect
              personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              10. International Data Transfers
            </h2>
            <p className="mt-3">
              If you access Goshsha from outside the United States, your
              information may be transferred to, stored in, and processed in the
              United States or other countries where our service providers
              operate.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              11. Changes to This Policy
            </h2>
            <p className="mt-3">
              We may update this Privacy Policy periodically. Changes will be
              posted on this page with an updated “Last Updated” date. Your
              continued use of Goshsha after changes are posted means you accept
              the updated Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#0b1234]">
              12. Contact Us
            </h2>
            <p className="mt-3">
              If you have questions about this Privacy Policy, contact us at:
              <br />
              <br />
              <strong>Goshsha, Matt Dot LLC</strong>
              <br />
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