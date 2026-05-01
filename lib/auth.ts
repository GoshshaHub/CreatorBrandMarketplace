"use client";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
} from "firebase/auth";

import { useEffect, useState } from "react";
import { auth } from "./firebase";

/* =========================
   AUTH ACTIONS
========================= */

export async function loginUser(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signupUser(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function sendResetPasswordEmail(email: string) {
  return sendPasswordResetEmail(auth, email);
}

/* =========================
   AUTH HOOK
========================= */

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