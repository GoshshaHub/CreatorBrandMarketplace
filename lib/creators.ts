import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { auth, db } from "./firebase";

export async function getCreatorProfile(uid: string) {
  const ref = doc(db, "creators", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data(),
  };
}

export async function updateCreatorProfile(params: {
  uid: string;
  displayName: string;
  handle: string;
  bio: string;
  categories: string[];
  contactEmail: string;
  isMarketplaceVisible: boolean;
  photoURL?: string;
  socialLinks: {
    tiktok?: string;
    instagram?: string;
    youtube?: string;
  };
}) {
  const {
    uid,
    displayName,
    handle,
    bio,
    categories,
    contactEmail,
    isMarketplaceVisible,
    photoURL = "",
    socialLinks,
  } = params;

  await setDoc(
    doc(db, "creators", uid),
    {
      userId: uid,
      displayName,
      handle,
      bio,
      categories,
      contactEmail,
      isMarketplaceVisible,
      photoURL: photoURL || null,
      socialLinks: {
        tiktok: socialLinks.tiktok || "",
        instagram: socialLinks.instagram || "",
        youtube: socialLinks.youtube || "",
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "users", uid),
    {
      displayName,
      email: contactEmail,
      photoURL: photoURL || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (auth.currentUser && auth.currentUser.uid === uid) {
    await updateProfile(auth.currentUser, {
      displayName,
      photoURL: photoURL || null,
    });
  }
}