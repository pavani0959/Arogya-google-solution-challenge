import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { createRecord, listenRecords, resolveFileUrls, type MedicalRecord, type RecordType } from '../../data/records';

export const VaultPage = () => {
  const { user, ready } = useAuth();
  const [items, setItems] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<RecordType>('LabReport');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    setError(null);
    if (!ready) return;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = listenRecords(user.uid, (data) => {
      setItems(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user, ready]);

  const canUpload = Boolean(user) && title.trim().length > 0 && files.length > 0;

  const upload = async () => {
    if (!user) return;
    if (!canUpload) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createRecord({
        patientId: user.uid,
        type,
        title: title.trim(),
        notes: notes.trim() || undefined,
        recordDate: new Date(),
        files,
      });
      setItems((prev) => [created, ...prev]);
      setTitle('');
      setNotes('');
      setFiles([]);
    } catch (e: any) {
      setError(e?.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-xl font-black">Health Vault</div>
        <p className="mt-2 text-sm text-white/70">
          Upload prescriptions, lab reports, and imaging. Files go to Firebase Storage and metadata to Firestore (demo mode uses local storage).
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-black">Upload a record</div>
        {!user && ready && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white/70">
            Log in (or enable demo mode) to upload.
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 md:col-span-1">
            <span className="text-xs font-semibold text-white/70">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as RecordType)}
              className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm outline-none"
            >
              <option value="Prescription">Prescription</option>
              <option value="LabReport">Lab report</option>
              <option value="XRay">X-Ray</option>
              <option value="Imaging">Imaging</option>
              <option value="Consultation">Consultation</option>
            </select>
          </label>

          <label className="grid gap-1 md:col-span-2">
            <span className="text-xs font-semibold text-white/70">Title *</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm outline-none focus:ring-2 focus:ring-violet-400/40"
              placeholder="e.g. CBC Report, Dr. Prescription, MRI Brain"
            />
          </label>
        </div>

        <label className="mt-3 grid gap-1">
          <span className="text-xs font-semibold text-white/70">Notes</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm outline-none focus:ring-2 focus:ring-violet-400/40"
            placeholder="Optional: brief description"
          />
        </label>

        <label className="mt-3 grid gap-1">
          <span className="text-xs font-semibold text-white/70">Files *</span>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="block w-full text-sm text-white/70 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/15"
          />
          {files.length > 0 && <div className="text-xs text-white/60">{files.length} file(s) selected</div>}
        </label>

        <button
          type="button"
          disabled={!canUpload || busy}
          onClick={upload}
          className="mt-4 h-11 rounded-2xl bg-white px-5 text-sm font-black text-slate-950 hover:bg-white/90 disabled:opacity-60"
        >
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-black">Your records</div>
        {loading ? (
          <div className="mt-3 text-sm text-white/60">Loading…</div>
        ) : items.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white/70">
            No records yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {items.map((r) => (
              <RecordRow key={r.id} record={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const RecordRow = ({ record }: { record: MedicalRecord }) => {
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState<MedicalRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (resolved) return;
    setBusy(true);
    try {
      const withUrls = await resolveFileUrls(record);
      setResolved(withUrls);
    } finally {
      setBusy(false);
    }
  };

  const view = resolved || record;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black">
            {record.type} • {record.title}
          </div>
          <div className="mt-1 text-xs text-white/60">{record.recordDate.toLocaleString()}</div>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
        >
          {open ? 'Hide' : 'View'}
        </button>
      </div>

      {open && (
        <div className="mt-3 border-t border-white/10 pt-3 text-sm text-white/70">
          {record.notes && <div className="mb-2 text-xs text-white/70">Notes: {record.notes}</div>}
          {busy ? (
            <div className="text-xs text-white/60">Preparing file links…</div>
          ) : (
            <ul className="space-y-2">
              {view.files.map((f) => (
                <li key={f.path} className="flex items-center justify-between gap-3">
                  <span className="truncate text-xs text-white/80">{f.name}</span>
                  {f.url ? (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/15"
                    >
                      Open
                    </a>
                  ) : (
                    <span className="text-xs text-white/50">demo</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

