import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { isDemoMode } from '../app/env';

export type SosSeverity = 'minor' | 'major' | 'critical';
export type SosStatus = 'countdown' | 'active' | 'resolved' | 'cancelled' | 'expired';

export type SosRequestDoc = {
  id: string;
  victimId: string;
  status: SosStatus;
  severity: SosSeverity;
  source: 'hardware' | 'mobile';
  countdown: number;
  location: { lat: number; lon: number } | null;
  hasValidLocation?: boolean;
  isApproximate?: boolean;
  radiusKm: number;
  primaryHelperId?: string;
  // ── Part 3: helper assignment tracking ────────────────────────────────────
  helpersAssigned?: string[];   // UIDs notified
  helpersAccepted?: string[];   // UIDs who clicked "Help Now"
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

// ── Part 1: check for existing active SOS before creating a new one ────────
export async function getActiveSosForUser(victimId: string): Promise<SosRequestDoc | null> {
  if (isDemoMode) return null;
  const q = query(
    collection(db, 'sosRequests'),
    where('victimId', '==', victimId),
    where('status', '==', 'active'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data: any = d.data();
  return {
    id: d.id,
    victimId: data.victimId,
    status: data.status,
    severity: data.severity,
    source: data.source || 'mobile',
    countdown: data.countdown ?? 0,
    location: data.location ?? null,
    hasValidLocation: data.hasValidLocation ?? false,
    isApproximate: data.isApproximate ?? false,
    radiusKm: data.radiusKm ?? 5,
    primaryHelperId: data.primaryHelperId,
    helpersAssigned: data.helpersAssigned ?? [],
    helpersAccepted: data.helpersAccepted ?? [],
  };
}

// ── createSosRequest: idempotent via pre-check ────────────────────────────
export async function createSosRequest(input: Omit<SosRequestDoc, 'id' | 'primaryHelperId'>) {
  if (isDemoMode) return { ...input, id: `demo-${Date.now()}` } as SosRequestDoc;

  // ── Part 1: duplicate-prevention ─────────────────────────────────────────
  const existing = await getActiveSosForUser(input.victimId);
  if (existing) {
    console.warn('[SOS] ⚠ Existing active SOS found — reusing:', existing.id);
    return existing;
  }

  const ref = await addDoc(collection(db, 'sosRequests'), {
    victimId: input.victimId,
    status: input.status,
    severity: input.severity,
    source: input.source || 'mobile',
    countdown: input.countdown ?? 0,
    location: input.location,
    hasValidLocation: input.hasValidLocation ?? false,
    isApproximate: input.isApproximate ?? false,
    radiusKm: input.radiusKm,
    helpersAssigned: [],
    helpersAccepted: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { ...input, id: ref.id } as SosRequestDoc;
}

// ── updateSosRequest: generic patch ──────────────────────────────────────
export async function updateSosRequest(id: string, patch: Record<string, unknown>) {
  if (isDemoMode) return;
  await updateDoc(doc(db, 'sosRequests', id), { ...patch, updatedAt: serverTimestamp() });
}

// ── listenCurrentSosRequest ────────────────────────────────────────────────
export function listenCurrentSosRequest(victimId: string, cb: (item: SosRequestDoc | null) => void) {
  if (isDemoMode) { cb(null); return () => {}; }

  console.log('[SOS Listener] Starting for victimId:', victimId);

  const q = query(
    collection(db, 'sosRequests'),
    where('victimId', '==', victimId),
    limit(5)
  );

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) { cb(null); return; }
      const active = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((d) => d.status === 'countdown' || d.status === 'active')
        .sort((a, b) => {
          const ta = a.createdAt?.seconds ?? (a.createdAt / 1000) ?? 0;
          const tb = b.createdAt?.seconds ?? (b.createdAt / 1000) ?? 0;
          return tb - ta;
        });

      if (!active.length) { cb(null); return; }
      const data = active[0];
      console.log('[SOS Listener] Active SOS found:', data.id, data.status);
      cb({
        id: data.id,
        victimId: data.victimId,
        status: data.status,
        severity: data.severity,
        source: data.source,
        countdown: data.countdown,
        location: data.location,
        hasValidLocation: data.hasValidLocation,
        isApproximate: data.isApproximate ?? false,
        radiusKm: data.radiusKm ?? 5,
        primaryHelperId: data.primaryHelperId,
        helpersAssigned: data.helpersAssigned ?? [],
        helpersAccepted: data.helpersAccepted ?? [],
      });
    },
    (err) => {
      console.error('[SOS Listener] onSnapshot error:', err.code, err.message);
      cb(null);
    }
  );
}

// ── listenActiveSosRequests ────────────────────────────────────────────────
// Single where() clause → no composite index needed.
// Part 5: frontend filter adds 30-min expiry guard.
// Part 7: _createdMs exposed for staleness check.
export function listenActiveSosRequests(cb: (items: SosRequestDoc[]) => void) {
  if (isDemoMode) {
    cb([]);
    return () => {};
  }

  const q = query(
    collection(db, 'sosRequests'),
    where('status', '==', 'active')
  );

  return onSnapshot(
    q,
    (snap) => {
      console.log(`[HELPER RAW DOCS]: ${snap.docs.length}`);
      const now = Date.now();
      const THIRTY_MIN = 30 * 60 * 1000;

      const results = snap.docs
        .map((d) => {
          const data: any = d.data();
          const createdMs: number = data.createdAt?.seconds
            ? data.createdAt.seconds * 1000
            : (data.createdAt ?? 0);
          return {
            id: d.id,
            victimId: data.victimId,
            status: data.status as SosStatus,
            severity: data.severity as SosSeverity,
            source: (data.source || 'mobile') as 'hardware' | 'mobile',
            countdown: data.countdown ?? 0,
            location: data.location ?? null,
            hasValidLocation: data.hasValidLocation ?? false,
            isApproximate: data.isApproximate ?? false,
            radiusKm: data.radiusKm ?? 5,
            primaryHelperId: data.primaryHelperId,
            helpersAssigned: data.helpersAssigned ?? [],
            helpersAccepted: data.helpersAccepted ?? [],
            _createdMs: createdMs,
          } satisfies SosRequestDoc & { _createdMs: number };
        })
        // ── Part 5 / Part 7: discard docs older than 30 minutes ───────────
        .filter((r) => !r._createdMs || now - r._createdMs < THIRTY_MIN)
        .sort((a, b) => b._createdMs - a._createdMs);

      cb(results);
    },
    (err) => {
      console.error('[Active SOS Listener] onSnapshot error:', err.code, err.message);
      cb([]);
    }
  );
}

// ── listenAssignmentsForRequest ────────────────────────────────────────────
export function listenAssignmentsForRequest(
  requestId: string,
  cb: (items: SosAssignmentDoc[]) => void,
  victimId?: string
) {
  if (isDemoMode) {
    cb([]);
    return () => {};
  }

  console.log('[Assignments Listener] requestId:', requestId, 'victimId:', victimId);

  const q = victimId
    ? query(collection(db, 'sosAssignments'), where('victimId', '==', victimId))
    : query(collection(db, 'sosAssignments'), where('requestId', '==', requestId));

  return onSnapshot(
    q,
    (snap) => {
      console.log('[Assignments Listener] docs received:', snap.docs.length);
      const results = snap.docs
        .map((d) => {
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
            _acceptedMs: data.acceptedAt?.seconds
              ? data.acceptedAt.seconds * 1000
              : (data.acceptedAt ?? 0),
          } satisfies SosAssignmentDoc & { _acceptedMs: number };
        })
        .filter((d) => d.requestId === requestId)
        .sort((a, b) => a._acceptedMs - b._acceptedMs);
      cb(results);
    },
    (err) => {
      console.error('[Assignments Listener] onSnapshot error:', err.code, err.message);
      cb([]);
    }
  );
}

// ── acceptSosRequest ───────────────────────────────────────────────────────
// Part 3: also writes helperId into helpersAccepted array on the SOS doc.
export async function acceptSosRequest(input: {
  requestId: string;
  victimId: string;
  helperId: string;
}) {
  if (isDemoMode) return `demo-${Date.now()}`;

  // Write to the assignments sub-collection
  const ref = await addDoc(collection(db, 'sosAssignments'), {
    requestId: input.requestId,
    victimId: input.victimId,
    helperId: input.helperId,
    status: 'accepted',
    acceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    distanceTrend: 'unknown',
  });

  // ── Part 3: mirror helper into helpersAccepted on the SOS doc ────────────
  await updateDoc(doc(db, 'sosRequests', input.requestId), {
    helpersAccepted: arrayUnion(input.helperId),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

// ── removeHelperFromSos ─────────────────────────────────────────────────────
// Part 4: called when helper is now >5 km from victim's updated location.
export async function removeHelperFromSos(requestId: string, helperId: string) {
  if (isDemoMode) return;
  await updateDoc(doc(db, 'sosRequests', requestId), {
    helpersAccepted: arrayRemove(helperId),
    updatedAt: serverTimestamp(),
  });
}

// ── updateAssignment ──────────────────────────────────────────────────────
export async function updateAssignment(id: string, patch: Partial<SosAssignmentDoc>) {
  if (isDemoMode) return;
  const { id: _id, ...rest } = patch as any;
  await updateDoc(doc(db, 'sosAssignments', id), { ...rest, updatedAt: serverTimestamp() });
}

// ── tryAssignPrimaryHelper ────────────────────────────────────────────────
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

// ── markSosExpired ────────────────────────────────────────────────────────
// Part 5: call this from a Cloud Function scheduler or admin script.
// Frontend uses the 30-min listener filter instead.
export async function markSosExpired(id: string) {
  if (isDemoMode) return;
  await updateDoc(doc(db, 'sosRequests', id), {
    status: 'expired',
    updatedAt: serverTimestamp(),
  });
}
