import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { createRecord, listenRecords, resolveFileUrls, type MedicalRecord, type RecordType } from '../../data/records';
import { FileText, Upload, File, FolderOpen, Eye, CheckCircle2 } from 'lucide-react';

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
    <div className="flex flex-col items-center max-w-lg mx-auto w-full pb-12 space-y-4">
      {/* Header */}
      <div className="w-full rounded-3xl border border-white/8 bg-[#13141a] p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl opacity-50" />
        <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">
          <FolderOpen className="h-3.5 w-3.5" /> Secure Records
        </div>
        <div className="text-3xl font-black tracking-tight text-white mb-2">Health Vault</div>
        <p className="text-xs text-white/40 font-medium">
          Upload prescriptions, lab reports, and imaging securely.
        </p>
      </div>

      {/* Upload Box */}
      <div className="w-full rounded-3xl border border-white/5 bg-[#13141a] p-5 shadow-lg">
        <div className="flex items-center gap-2 text-[10px] font-black text-white/80 uppercase tracking-widest mb-4">
          <Upload className="h-3.5 w-3.5 text-blue-400" /> Upload a Record
        </div>

        {!user && ready && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-xs text-white/50">
            Log in (or enable demo mode) to upload.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-300">
            {error}
          </div>
        )}

        {user && (
          <div className="space-y-4">
            <div className="grid gap-3 grid-cols-2">
              <label className="space-y-1">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Type</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as RecordType)}
                  className="w-full h-11 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20 transition"
                >
                  <option value="Prescription">Prescription</option>
                  <option value="LabReport">Lab report</option>
                  <option value="XRay">X-Ray</option>
                  <option value="Imaging">Imaging</option>
                  <option value="Consultation">Consultation</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Title *</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-11 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20 transition"
                  placeholder="e.g. CBC Report"
                />
              </label>
            </div>

            <label className="space-y-1 block">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Notes</span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-11 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20 transition"
                placeholder="Optional description"
              />
            </label>

            <label className="block border border-dashed border-white/10 rounded-2xl p-4 text-center bg-white/[0.01] hover:bg-white/[0.03] transition relative cursor-pointer">
              <input
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-2">
                <Upload className={`h-6 w-6 ${files.length > 0 ? 'text-blue-400' : 'text-white/20'}`} />
                <div className="text-xs font-semibold text-white/70">
                  {files.length > 0 ? `${files.length} file(s) selected` : 'Tap to select files'}
                </div>
              </div>
            </label>

            <button
              type="button"
              disabled={!canUpload || busy}
              onClick={upload}
              className="w-full h-12 rounded-full bg-blue-500 text-sm font-black text-white shadow-[0_0_25px_rgba(59,130,246,0.35)] transition hover:bg-blue-400 hover:shadow-[0_0_35px_rgba(59,130,246,0.5)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {busy ? 'Uploading…' : 'Upload Record'}
            </button>
          </div>
        )}
      </div>

      {/* Records List */}
      <div className="w-full rounded-3xl border border-white/5 bg-[#13141a] p-5 shadow-lg">
        <div className="flex items-center gap-2 text-[10px] font-black text-white/80 uppercase tracking-widest mb-4">
          <FileText className="h-3.5 w-3.5 text-blue-400" /> Your Records
        </div>
        
        {loading ? (
          <div className="text-xs text-white/40 text-center py-6">Loading records…</div>
        ) : items.length === 0 ? (
          <div className="text-xs text-white/40 text-center py-6">No records uploaded yet.</div>
        ) : (
          <div className="space-y-3">
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
    <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-blue-500/10 p-2 text-blue-400">
            <File className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white/90">{record.title}</div>
            <div className="text-[10px] uppercase font-bold text-white/30 tracking-wider">
              {record.type} • {record.recordDate.toLocaleString()}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          className={`rounded-full px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition ${
            open ? 'bg-white/10 text-white' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
          }`}
        >
          {open ? 'Close' : 'View'}
        </button>
      </div>

      {open && (
        <div className="mt-4 border-t border-white/5 pt-4">
          {record.notes && <div className="mb-3 text-xs text-white/60 bg-white/5 p-3 rounded-xl">Notes: {record.notes}</div>}
          {busy ? (
            <div className="text-xs text-white/40 flex items-center gap-2">
              <span className="animate-spin rounded-full h-3 w-3 border-2 border-white/20 border-t-white"></span>
              Resolving secure links…
            </div>
          ) : (
            <div className="space-y-2">
              {view.files.map((f) => (
                <div key={f.path} className="flex items-center justify-between rounded-xl bg-black/20 p-3">
                  <span className="truncate text-xs text-white/80 font-medium max-w-[200px]">{f.name}</span>
                  {f.url ? (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold text-white hover:bg-white/20 transition"
                    >
                      <Eye className="h-3 w-3" /> Open
                    </a>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full"><CheckCircle2 className="h-3 w-3" /> Demo File</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
