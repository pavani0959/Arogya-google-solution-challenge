import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { isDemoMode } from '../app/env';

export type SosSeverity = 'minor' | 'major' | 'critical';
export type SosStatus = 'countdown' | 'active' | 'resolved' | 'cancelled';

export type SosRequestDoc = {
  id: string;
  victimId: string;
  status: SosStatus;
  severity: SosSeverity;
  source: 'hardware' | 'mobile'; // New: Where the trigger originated
  countdown: number;             // New: Server-side countdown clock (ends at 0)
  location: { lat: number; lon: number } | null;
  hasValidLocation?: boolean;    // New: Indicates if it has a valid location for helper routing
  radiusKm: number;
  primaryHelperId?: string;
};

export type SosAssignmentDoc = {
  id: string;
  requestId: string;
  victimId: string;
  helperId: string;
  status: 'accepted' | 'enroute' | 'reached' | 'secondary' | 'cancelled';
  lastLocation?: { lat: number; lon: number };
  distanceMeters?: number;
  distanceTrend?: 'closing' | 'stalled' | 'unknown';
};

export async function createSosRequest(input: Omit<SosRequestDoc, 'id' | 'primaryHelperId'>) {
  if (isDemoMode) return { ...input, id: `demo-${Date.now()}` } as SosRequestDoc;
  const ref = await addDoc(collection(db, 'sosRequests'), {
    victimId: input.victimId,
    status: input.status,
    severity: input.severity,
    source: input.source || 'mobile',
    countdown: input.countdown ?? 8,
    location: input.location,
    hasValidLocation: input.hasValidLocation ?? false,
    radiusKm: input.radiusKm,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { ...input, id: ref.id } as SosRequestDoc;
}

export async function updateSosRequest(id: string, patch: Partial<Omit<SosRequestDoc, 'id' | 'victimId'>>) {
  if (isDemoMode) return;
  await updateDoc(doc(db, 'sosRequests', id), { ...patch, updatedAt: serverTimestamp() });
}

export function listenCurrentSosRequest(victimId: string, cb: (item: SosRequestDoc | null) => void) {
  if (isDemoMode) { cb(null); return () => {}; }
  const q = query(
    collection(db, 'sosRequests'), 
    where('victimId', '==', victimId),
    where('status', 'in', ['countdown', 'active']),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) { cb(null); return; }
    const d = snap.docs[0];
    if (!d) { cb(null); return; }
    const data: any = d.data();
    cb({
      id: d.id,
      victimId: data.victimId,
      status: data.status,
      severity: data.severity,
      source: data.source,
      countdown: data.countdown,
      location: data.location,
      hasValidLocation: data.hasValidLocation,
      radiusKm: data.radiusKm ?? 1.2,
      primaryHelperId: data.primaryHelperId,
    });
  });
}

export function listenActiveSosRequests(cb: (items: SosRequestDoc[]) => void) {
  if (isDemoMode) {
    cb([]);
    return () => {};
  }
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
  const q = query(
    collection(db, 'sosRequests'), 
    where('status', '==', 'active'),
    where('hasValidLocation', '==', true),
    where('createdAt', '>=', tenMinsAgo),
    orderBy('createdAt', 'desc'), 
    limit(30)
  );
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          victimId: data.victimId,
          status: data.status,
          severity: data.severity,
          source: data.source || 'mobile',
          countdown: data.countdown ?? 0,
          location: data.location,
          hasValidLocation: data.hasValidLocation,
          radiusKm: data.radiusKm ?? 1.2,
          primaryHelperId: data.primaryHelperId,
        } satisfies SosRequestDoc;
      }),
    );
  });
}

export function listenAssignmentsForRequest(requestId: string, cb: (items: SosAssignmentDoc[]) => void) {
  if (isDemoMode) {
    cb([]);
    return () => {};
  }
  const q = query(collection(db, 'sosAssignments'), where('requestId', '==', requestId), orderBy('acceptedAt', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          requestId: data.requestId,
          victimId: data.victimId,
          helperId: data.helperId,
          status: data.status,
          lastLocation: data.lastLocation,
          distanceMeters: data.distanceMeters,
          distanceTrend: data.distanceTrend,
        } satisfies SosAssignmentDoc;
      }),
    );
  });
}

export async function acceptSosRequest(input: { requestId: string; victimId: string; helperId: string }) {
  if (isDemoMode) return { id: `demo-${Date.now()}` } as any;
  const ref = await addDoc(collection(db, 'sosAssignments'), {
    requestId: input.requestId,
    victimId: input.victimId,
    helperId: input.helperId,
    status: 'accepted',
    acceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    distanceTrend: 'unknown',
  });
  return ref.id;
}

export async function updateAssignment(id: string, patch: Partial<SosAssignmentDoc>) {
  if (isDemoMode) return;
  const { id: _id, ...rest } = patch as any;
  await updateDoc(doc(db, 'sosAssignments', id), { ...rest, updatedAt: serverTimestamp() });
}

export async function tryAssignPrimaryHelper(requestId: string, helperId: string) {
  if (isDemoMode) return;
  await runTransaction(db, async (tx) => {
    const reqRef = doc(db, 'sosRequests', requestId);
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) return;
    const data: any = reqSnap.data();
    if (data.primaryHelperId) return;
    tx.update(reqRef, { primaryHelperId: helperId, updatedAt: serverTimestamp() });
  });
}

