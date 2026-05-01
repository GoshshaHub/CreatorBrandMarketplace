"use client";

import { useEffect, useState } from "react";
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase";

export async function loginUser(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signupUser(
  email: string,
  password: string,
  displayName?: string
) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  if (displayName && displayName.trim().length > 0) {
    await updateProfile(credential.user, {
      displayName: displayName.trim(),
    });
  }

  return credential;
}

export async function sendResetPasswordEmail(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}