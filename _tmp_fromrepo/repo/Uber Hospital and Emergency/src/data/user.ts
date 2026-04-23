import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/client';
import { isDemoMode } from '../app/env';

export interface UserProfile {
  uid: string;
  name?: string;
  phone?: string;
  bloodGroup?: string;
  fcmToken?: string;
  points?: number;
  helpedCount?: number;
  location?: { lat: number; lon: number };
  contacts: { name: string; phone: string }[];
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (isDemoMode) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) {
    return snap.data() as UserProfile;
  }
  return null;
}

export async function updateUserProfile(uid: string, patch: Partial<UserProfile>) {
  if (isDemoMode) return;
  await setDoc(doc(db, 'users', uid), patch, { merge: true });
}

export async function rewardHelperPoints(uid: string, pointsToAward: number) {
  if (isDemoMode) return;
  const { increment } = await import('firebase/firestore');
  await setDoc(doc(db, 'users', uid), {
    points: increment(pointsToAward),
    helpedCount: increment(1)
  }, { merge: true });
}

export async function requestAndSaveFcmToken(uid: string) {
  if (isDemoMode) return;
  try {
    const { getToken } = await import('firebase/messaging');
    const { messaging } = await import('../firebase/client');
    if (!messaging) return;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      });
      if (token) {
        await updateUserProfile(uid, { fcmToken: token });
      }
    }
  } catch (e) {
    console.log('FCM setup failed/ignored:', e);
  }
}
