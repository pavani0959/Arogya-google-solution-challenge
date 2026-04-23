import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/client';
import { isFirebaseConfigured } from '../app/env';

const DEMO_KEY = 'resqmed_demo_user_v1';

// ─── Phone-based auth helpers (Primary) ────────────────────────────────────

/**
 * Mock OTP login with phone number.
 * In demo mode: stores a mock user in localStorage.
 * OTP is not validated (any 4-digit code is accepted in demo).
 */
export async function loginWithPhone(phone: string, _otp: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  // Map phone to a deterministic demo email so Firebase auth still works if configured
  const email = `phone_${cleanPhone}@arogya.demo`;
  const password = `phone_${cleanPhone}_secret`;

  if (!isFirebaseConfigured) {
    const uid = `user-${cleanPhone}`;
    const stored = localStorage.getItem(DEMO_KEY);
    const existing = stored ? JSON.parse(stored) : null;
    localStorage.setItem(DEMO_KEY, JSON.stringify({
      uid,
      phone,
      email,
      displayName: existing?.displayName ?? `User ${cleanPhone.slice(-4)}`,
    }));
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch {
    // User might not exist yet — create on-the-fly
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: `User ${cleanPhone.slice(-4)}` });
    await setDoc(doc(db, 'users', cred.user.uid), {
      role: 'patient', phone, email, createdAt: serverTimestamp(),
    });
  }
}

/**
 * Mock OTP signup with phone number and profile info.
 */
export async function signupWithPhone(input: {
  phone: string;
  name: string;
  bloodGroup?: string;
  emergencyContacts: { name: string; phone: string }[];
}) {
  const cleanPhone = input.phone.replace(/\D/g, '');
  const email = `phone_${cleanPhone}@arogya.demo`;
  const password = `phone_${cleanPhone}_secret`;

  if (!isFirebaseConfigured) {
    const uid = `user-${cleanPhone}`;
    localStorage.setItem(DEMO_KEY, JSON.stringify({
      uid, phone: input.phone, email, displayName: input.name,
      bloodGroup: input.bloodGroup ?? '',
      emergencyContacts: input.emergencyContacts,
    }));
    // Simulate notifying emergency contacts
    console.info(
      `[DEMO] Notified contacts for ${input.name}:`,
      input.emergencyContacts.map(c => `${c.name} (${c.phone})`)
    );
    return;
  }

  let uid: string;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
    await updateProfile(cred.user, { displayName: input.name });
  } catch {
    // Already registered — just update profile
    const cred = await signInWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
    await updateProfile(cred.user, { displayName: input.name });
  }

  await setDoc(doc(db, 'users', uid), {
    role: 'patient', phone: input.phone, name: input.name,
    bloodGroup: input.bloodGroup ?? '', email, createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'patients', uid), {
    name: input.name, bloodGroup: input.bloodGroup ?? '',
    emergencyContacts: input.emergencyContacts,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

// ─── Legacy email/password helpers (kept for doctor/hospital portals) ──────

export async function signup(input: { name: string; email: string; password: string }) {
  if (!isFirebaseConfigured) {
    const uid = `demo-${Date.now()}`;
    localStorage.setItem(DEMO_KEY, JSON.stringify({ uid, email: input.email, displayName: input.name }));
    return;
  }
  const cred = await createUserWithEmailAndPassword(auth, input.email, input.password);
  await updateProfile(cred.user, { displayName: input.name });
  await setDoc(doc(db, 'users', cred.user.uid), {
    role: 'patient', name: input.name, email: input.email, createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'patients', cred.user.uid), {
    name: input.name, emergencyContacts: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export async function login(input: { email: string; password: string }) {
  if (!isFirebaseConfigured) {
    const uid = `demo-${Date.now()}`;
    localStorage.setItem(DEMO_KEY, JSON.stringify({ uid, email: input.email, displayName: input.email.split('@')[0] }));
    return;
  }
  await signInWithEmailAndPassword(auth, input.email, input.password);
}

export async function logout() {
  if (!isFirebaseConfigured) { localStorage.removeItem(DEMO_KEY); return; }
  await signOut(auth);
}
