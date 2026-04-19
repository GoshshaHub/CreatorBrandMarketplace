import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  UserCredential,
} from "firebase/auth";
import { auth } from "./firebase";

export async function signupUser(
  email: string,
  password: string,
  displayName: string
): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  if (displayName.trim()) {
    await updateProfile(credential.user, {
      displayName: displayName.trim(),
    });
  }

  return credential;
}

export async function loginUser(
  email: string,
  password: string
): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function sendResetPasswordEmail(email: string) {
  return sendPasswordResetEmail(auth, email);
}