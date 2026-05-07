import { useState, useEffect, useRef } from 'react';
import { supabase, BillAttachment } from '../lib/supabase';
import { Paperclip, Upload, Trash2, FileText, Image, Eye, Download, X, Loader2 } from 'lucide-react';

const BUCKET = 'bill-attachments';
const ACCEPTED = '.pdf,.jpg,.jpeg,.png';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

interface Props {
  billId: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdf(mime: string) { return mime === 'application/pdf'; }
function isImage(mime: string) { return mime.startsWith('image/'); }

export default function BillAttachments({ billId }: Props) {
  const [attachments, setAttachments] = useState<BillAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string>('');
  const [previewName, setPreviewName] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchAttachments(); }, [billId]);

  async function fetchAttachments() {
    const { data } = await supabase
      .from('bill_attachments')
      .select('*')
      .eq('bill_id', billId)
      .order('created_at');
    setAttachments(data || []);
    setLoading(false);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErrors([]);
    const errs: string[] = [];
    const valid: File[] = [];

    for (const file of Array.from(files)) {
      if (!['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        errs.push(`"${file.name}": tipo não suportado (use PDF, JPG ou PNG).`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        errs.push(`"${file.name}": tamanho máximo é 10 MB.`);
        continue;
      }
      valid.push(file);
    }

    if (errs.length) setErrors(errs);
    if (!valid.length) return;

    setUploading(true);
    for (const file of valid) {
      const ext = file.name.split('.').pop();
      const storagePath = `${billId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        setErrors(e => [...e, `"${file.name}": erro no upload — ${uploadError.message}`]);
        continue;
      }

      await supabase.from('bill_attachments').insert({
        bill_id: billId,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
      });
    }
    setUploading(false);
    fetchAttachments();
    if (inputRef.current) inputRef.current.value = '';
  }

  async function getSignedUrl(att: BillAttachment): Promise<string | null> {
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(att.storage_path, 60 * 5); // 5 min
    return data?.signedUrl ?? null;
  }

  async function handlePreview(att: BillAttachment) {
    const url = await getSignedUrl(att);
    if (!url) return;
    setPreviewUrl(url);
    setPreviewMime(att.mime_type);
    setPreviewName(att.file_name);
  }

  async function handleDownload(att: BillAttachment) {
    const url = await getSignedUrl(att);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = att.file_name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleDelete(att: BillAttachment) {
    await supabase.storage.from(BUCKET).remove([att.storage_path]);
    await supabase.from('bill_attachments').delete().eq('id', att.id);
    setDeleteConfirm(null);
    fetchAttachments();
  }

  return (
    <>
      <div className="border border-slate-200 rounded-xl bg-slate-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Paperclip size={16} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Anexos</span>
            {attachments.length > 0 && (
              <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{attachments.length}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? 'Enviando...' : 'Anexar arquivo'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            className="sr-only"
            onChange={e => handleFiles(e.target.files)}
          />
        </div>

        {errors.length > 0 && (
          <div className="mb-3 space-y-1">
            {errors.map((err, i) => (
              <p key={i} className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{err}</p>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-xs text-slate-400 text-center py-2">Carregando...</p>
        ) : attachments.length === 0 ? (
          <div
            className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={20} className="text-slate-300 mx-auto mb-1" />
            <p className="text-xs text-slate-400">Clique ou arraste arquivos PDF, JPG ou PNG</p>
            <p className="text-xs text-slate-300 mt-0.5">Máximo 10 MB por arquivo</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {attachments.map(att => (
              <li key={att.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2.5 group">
                <div className="flex-shrink-0">
                  {isPdf(att.mime_type)
                    ? <FileText size={18} className="text-red-500" />
                    : <Image size={18} className="text-blue-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{att.file_name}</p>
                  <p className="text-xs text-slate-400">{formatBytes(att.size_bytes)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handlePreview(att)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Visualizar"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(att)}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Baixar"
                  >
                    <Download size={14} />
                  </button>
                  {deleteConfirm === att.id ? (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => handleDelete(att)} className="px-2 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors">Excluir</button>
                      <button type="button" onClick={() => setDeleteConfirm(null)} className="px-2 py-1 border border-slate-300 text-slate-600 text-xs rounded-lg hover:bg-slate-50 transition-colors">Não</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(att.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 flex-shrink-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{previewName}</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={previewUrl}
                  download={previewName}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <Download size={12} /> Baixar
                </a>
                <button onClick={() => setPreviewUrl(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-100 p-2">
              {isPdf(previewMime) ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full min-h-[500px] rounded-lg"
                  title={previewName}
                />
              ) : isImage(previewMime) ? (
                <img
                  src={previewUrl}
                  alt={previewName}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow"
                />
              ) : (
                <p className="text-slate-500">Não é possível visualizar este tipo de arquivo.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
