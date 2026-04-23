import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/client';
import { isDemoMode } from '../app/env';

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export type Appointment = {
  id: string;
  patientId: string;
  doctorId: string;
  hospitalId: string;
  startAt: Date;
  endAt: Date;
  reason: string;
  status: AppointmentStatus;
};

const LS_KEY = 'resqmed_demo_appointments_v1';

function loadDemo(): Appointment[] {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as any[];
    return parsed.map((x) => ({
      ...x,
      startAt: new Date(x.startAt),
      endAt: new Date(x.endAt),
    }));
  } catch {
    return [];
  }
}

function saveDemo(list: Appointment[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export async function listAppointments(patientId: string): Promise<Appointment[]> {
  if (isDemoMode) {
    return loadDemo().filter((a) => a.patientId === patientId);
  }

  const q = query(collection(db, 'appointments'), where('patientId', '==', patientId), orderBy('startAt', 'desc'));
  return await new Promise((resolve, reject) => {
    const unsub = onSnapshot(
      q,
      (snap) => {
        unsub();
        resolve(
          snap.docs.map((d) => {
            const data: any = d.data();
            return {
              id: d.id,
              patientId: data.patientId,
              doctorId: data.doctorId,
              hospitalId: data.hospitalId,
              startAt: data.startAt?.toDate?.() ?? new Date(),
              endAt: data.endAt?.toDate?.() ?? new Date(),
              reason: data.reason ?? '',
              status: data.status ?? 'scheduled',
            } satisfies Appointment;
          }),
        );
      },
      (err) => {
        unsub();
        reject(err);
      },
    );
  });
}

export function listenAppointments(patientId: string, cb: (items: Appointment[]) => void) {
  if (isDemoMode) {
    cb(loadDemo().filter((a) => a.patientId === patientId));
    const t = setInterval(() => cb(loadDemo().filter((a) => a.patientId === patientId)), 1500);
    return () => clearInterval(t);
  }
  const q = query(collection(db, 'appointments'), where('patientId', '==', patientId), orderBy('startAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          patientId: data.patientId,
          doctorId: data.doctorId,
          hospitalId: data.hospitalId,
          startAt: data.startAt?.toDate?.() ?? new Date(),
          endAt: data.endAt?.toDate?.() ?? new Date(),
          reason: data.reason ?? '',
          status: data.status ?? 'scheduled',
        } satisfies Appointment;
      }),
    );
  });
}

export async function createAppointment(input: Omit<Appointment, 'id'>): Promise<Appointment> {
  if (isDemoMode) {
    const list = loadDemo();
    const created: Appointment = { ...input, id: `demo-${Date.now()}` };
    saveDemo([created, ...list]);
    return created;
  }

  const ref = await addDoc(collection(db, 'appointments'), {
    patientId: input.patientId,
    doctorId: input.doctorId,
    hospitalId: input.hospitalId,
    startAt: input.startAt,
    endAt: input.endAt,
    reason: input.reason,
    status: input.status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { ...input, id: ref.id };
}

export async function removeAppointment(appointmentId: string) {
  if (isDemoMode) {
    const list = loadDemo().filter((a) => a.id !== appointmentId);
    saveDemo(list);
    return;
  }
  await deleteDoc(doc(db, 'appointments', appointmentId));
}

