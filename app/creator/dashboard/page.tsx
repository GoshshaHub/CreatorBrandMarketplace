"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../lib/auth";

type Campaign = {
  id: string;
  campaignTitle?: string;
  title?: string;
  brandName?: string;
  productName?: string;
  campaignBrief?: string;
  deliveryStartDate?: string;
  deliveryEndDate?: string;
  agreedPrice?: number;
  payoutAmount?: number;
  status?: string;
  fundingStatus?: string;
  submittedUrl?: string;
  brandEmail?: string;
  contactEmail?: string;
};

type Notification = {
  id: string;
  userId?: string;
  role?: string;
  type?: string;
  title?: string;
  message?: string;
  campaignId?: string;
  read?: boolean;
  createdAt?: any;
};

export default function CreatorDashboardPage() {
  const { user } = useAuth();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      if (!user?.uid) return;

      try {
        const campaignQuery = query(
          collection(db, "campaigns"),
          where("creatorId", "==", user.uid)
        );

        const campaignSnapshot = await getDocs(campaignQuery);

        const campaignList = campaignSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Campaign[];

        setCampaigns(campaignList);

        const notificationQuery = query(
          collection(db, "notifications"),
          where("userId", "==", user.uid)
        );

        const notificationSnapshot = await getDocs(notificationQuery);

        const notificationList = notificationSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Notification[];

        notificationList.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

        setNotifications(notificationList);
      } catch (error) {
        console.error("Error loading creator dashboard:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [user?.uid]);

  async function markNotificationRead(notificationId: string) {
    try {
      await updateDoc(doc(db, "notifications", notificationId), {
        read: true,
      });

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }

  const newInvites = campaigns.filter(
    (c) => c.status === "invited" || c.status === "new" || c.status === "accepted"
  ).length;

  const awaitingFunding = campaigns.filter(
    (c) =>
      c.fundingStatus === "awaiting" ||
      c.fundingStatus === "awaiting_funding"
  ).length;

  const readyToCreate = campaigns.filter(
    (c) => c.fundingStatus === "funded" && c.status !== "submitted"
  ).length;

  const liveCampaigns = campaigns.filter(
    (c) => c.status === "live" || c.status === "completed"
  ).length;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">
              Creator Dashboard
            </h1>
            <p className="mt-2 text-base text-slate-600">
              Stay on top of invites, funding, and campaign deadlines.
            </p>
          </div>

          <Link
            href="/creator/profile"
            className="inline-flex w-fit rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
          >
            Edit Profile
          </Link>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">New Invites</p>
            <p className="mt-4 text-5xl font-bold text-slate-900">
              {newInvites}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Awaiting Funding</p>
            <p className="mt-4 text-5xl font-bold text-slate-900">
              {awaitingFunding}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Ready to Create</p>
            <p className="mt-4 text-5xl font-bold text-slate-900">
              {readyToCreate}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Live Campaigns</p>
            <p className="mt-4 text-5xl font-bold text-slate-900">
              {liveCampaigns}
            </p>
          </div>
        </div>

        <section className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900">Updates</h2>

            {unreadCount > 0 && (
              <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
                {unreadCount} unread
              </span>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
              No updates yet.
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">
                        {notification.title || "Update"}
                      </h3>

                      <p className="mt-2 text-slate-700">
                        {notification.message || "You have a new update."}
                      </p>

                      {notification.campaignId && (
                        <Link
                          href={`/creator/campaign/${notification.campaignId}`}
                          className="mt-4 inline-flex rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
                        >
                          View Campaign
                        </Link>
                      )}
                    </div>

                    {!notification.read && (
                      <button
                        onClick={() => markNotificationRead(notification.id)}
                        className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
                      >
                        Mark as Read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-bold text-slate-900">
            Your Campaigns
          </h2>

          {loading ? (
            <p className="text-slate-600">Loading campaigns...</p>
          ) : campaigns.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
              No campaigns yet.
            </div>
          ) : (
            <div className="space-y-5">
              {campaigns.map((campaign) => {
                const title =
                  campaign.campaignTitle ||
                  campaign.title ||
                  "Untitled Campaign";

                const payout =
                  campaign.agreedPrice ?? campaign.payoutAmount ?? 0;

                const contactEmail =
                  campaign.brandEmail || campaign.contactEmail || "";

                return (
                  <div
                    key={campaign.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <Link
                      href={`/creator/campaign/${campaign.id}`}
                      className="text-2xl font-bold text-slate-900 underline underline-offset-4 hover:text-slate-700"
                    >
                      {title}
                    </Link>

                    <div className="mt-5 space-y-2 text-slate-700">
                      <p>
                        <span className="font-semibold text-slate-900">
                          Brand:
                        </span>{" "}
                        {campaign.brandName || "Not listed"}
                      </p>

                      <p>
                        <span className="font-semibold text-slate-900">
                          Product:
                        </span>{" "}
                        {campaign.productName || "Not listed"}
                      </p>

                      <p>
                        <span className="font-semibold text-slate-900">
                          Delivery Window:
                        </span>{" "}
                        {campaign.deliveryStartDate || "TBD"} →{" "}
                        {campaign.deliveryEndDate || "TBD"}
                      </p>

                      <p>
                        <span className="font-semibold text-slate-900">
                          Payout:
                        </span>{" "}
                        ${payout}
                      </p>
                    </div>

                    <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
                      {campaign.status || "Pending"}
                    </div>

                    <p className="mt-4 text-slate-700">
                      <span className="font-semibold text-slate-900">
                        Funding:
                      </span>{" "}
                      {campaign.fundingStatus || "Not funded yet"}
                    </p>

                    {campaign.campaignBrief && (
                      <p className="mt-5 leading-7 text-slate-700">
                        {campaign.campaignBrief}
                      </p>
                    )}

                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link
                        href={`/creator/campaign/${campaign.id}`}
                        className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
                      >
                        View Campaign
                      </Link>

                      {contactEmail && (
                        <a
                          href={`mailto:${contactEmail}`}
                          className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
                        >
                          Contact Brand
                        </a>
                      )}
                    </div>

                    {campaign.submittedUrl && (
                      <p className="mt-5 break-words text-slate-700">
                        <span className="font-semibold text-slate-900">
                          Submitted Link:
                        </span>{" "}
                        <a
                          href={campaign.submittedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-900 underline underline-offset-4"
                        >
                          {campaign.submittedUrl}
                        </a>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}