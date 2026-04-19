import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export async function createNotification(params: {
  userId: string;
  role: "creator" | "brand" | "admin";
  type: string;
  title: string;
  message: string;
  campaignId: string;
}) {
  const { userId, role, type, title, message, campaignId } = params;

  return addDoc(collection(db, "notifications"), {
    userId,
    role,
    type,
    title,
    message,
    campaignId,
    isRead: false,
    createdAt: serverTimestamp(),
  });
}

export async function markNotificationRead(notificationId: string) {
  const ref = doc(db, "notifications", notificationId);

  await updateDoc(ref, {
    isRead: true,
  });
}