import { useState, useEffect, useRef } from 'react';
import { supabase, formatCurrency, formatDate, todayLocal, getCurrentMonth, formatMonth } from '../../lib/supabase';
import { Plus, X, Check, ChevronLeft, ChevronRight, Paperclip, Eye, AlertTriangle, Clock, Trash2, CreditCard as Edit2, Copy, Download, FileText } from 'lucide-react';

type PaymentStatus = 'pendente' | 'pago';

interface Payment {
  id: string;
  user_id: string;
  due_date: string;
  item: string;
  description: string;
  bank_info: string;
  observation: string;
  amount: number;
  status: PaymentStatus;
  paid_at: string | null;
  reference_month: string;
  created_at: string;
  updated_at: string;
  _attachments?: Attachment[];
}

interface Attachment {
  id: string;
  payment_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

const EMPTY_FORM = {
  due_date: '',
  item: '',
  description: '',
  bank_info: '',
  observation: '',
  amount: '',
};

function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

export default function RosimarPayments() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [attachmentPaymentId, setAttachmentPaymentId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replicating, setReplicating] = useState(false);
  const today = todayLocal();

  useEffect(() => {
    loadPayments();
  }, [month]);

  async function loadPayments() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('rosimar_payments')
      .select('*')
      .eq('user_id', user.id)
      .eq('reference_month', month)
      .order('due_date', { ascending: true });

    setPayments(data || []);
    setLoading(false);
  }

  // KPIs
  const totalPaid = payments.filter(p => p.status === 'pago').reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.status === 'pendente').reduce((s, p) => s + p.amount, 0);
  const ib = parseFloat(initialBalance) || 0;
  const finalBalance = ib - totalPaid;

  // Alerts
  const dueToday = payments.filter(p => p.status === 'pendente' && p.due_date === today);
  const overdue = payments.filter(p => p.status === 'pendente' && p.due_date < today);

  function prevMonthNav() {
    const [y, m] = month.split('-').map(Number);
    if (m === 1) setMonth(`${y - 1}-12`);
    else setMonth(`${y}-${String(m - 1).padStart(2, '0')}`);
  }
  function nextMonthNav() { setMonth(nextMonth(month)); }

  function openNew() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(p: Payment) {
    setForm({
      due_date: p.due_date,
      item: p.item,
      description: p.description,
      bank_info: p.bank_info,
      observation: p.observation,
      amount: String(p.amount),
    });
    setEditingId(p.id);
    setFormError('');
    setShowForm(true);
  }

  async function handleSave() {
    setFormError('');
    if (!form.item.trim()) { setFormError('Informe o item.'); return; }
    if (!form.due_date) { setFormError('Informe a data de vencimento.'); return; }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount < 0) { setFormError('Valor inválido.'); return; }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    if (editingId) {
      const { error } = await supabase
        .from('rosimar_payments')
        .update({
          due_date: form.due_date,
          item: form.item.trim(),
          description: form.description.trim(),
          bank_info: form.bank_info.trim(),
          observation: form.observation.trim(),
          amount,
        })
        .eq('id', editingId)
        .eq('user_id', user.id);
      if (error) { setFormError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase
        .from('rosimar_payments')
        .insert({
          user_id: user.id,
          due_date: form.due_date,
          item: form.item.trim(),
          description: form.description.trim(),
          bank_info: form.bank_info.trim(),
          observation: form.observation.trim(),
          amount,
          status: 'pendente',
          reference_month: month,
        });
      if (error) { setFormError(error.message); setSaving(false); return; }
    }

    setSaving(false);
    setShowForm(false);
    loadPayments();
  }

  async function togglePaid(p: Payment) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const newStatus: PaymentStatus = p.status === 'pago' ? 'pendente' : 'pago';
    await supabase
      .from('rosimar_payments')
      .update({ status: newStatus, paid_at: newStatus === 'pago' ? today : null })
      .eq('id', p.id)
      .eq('user_id', user.id);
    loadPayments();
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este lançamento?')) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('rosimar_payments').delete().eq('id', id).eq('user_id', user.id);
    loadPayments();
  }

  async function replicateToNextMonth() {
    if (!confirm(`Replicar todos os lançamentos de ${formatMonth(month)} para ${formatMonth(nextMonth(month))}?`)) return;
    setReplicating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setReplicating(false); return; }

    const nm = nextMonth(month);
    const rows = payments.map(p => ({
      user_id: user.id,
      due_date: p.due_date.replace(month.substring(0, 7), nm.substring(0, 7)),
      item: p.item,
      description: p.description,
      bank_info: p.bank_info,
      observation: p.observation,
      amount: p.amount,
      status: 'pendente' as PaymentStatus,
      reference_month: nm,
    }));

    await supabase.from('rosimar_payments').insert(rows);
    setReplicating(false);
    setMonth(nm);
  }

  // Attachments
  async function openAttachments(p: Payment) {
    setAttachmentPaymentId(p.id);
    const { data } = await supabase
      .from('rosimar_attachments')
      .select('*')
      .eq('payment_id', p.id)
      .order('created_at', { ascending: true });
    setAttachments(data || []);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !attachmentPaymentId) return;
    setUploadingFile(true);
    const ext = file.name.split('.').pop();
    const path = `rosimar/${attachmentPaymentId}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('bill-attachments').upload(path, file);
    if (uploadErr) { alert('Erro ao enviar arquivo: ' + uploadErr.message); setUploadingFile(false); return; }

    await supabase.from('rosimar_attachments').insert({
      payment_id: attachmentPaymentId,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
    });
    const { data } = await supabase.from('rosimar_attachments').select('*').eq('payment_id', attachmentPaymentId).order('created_at');
    setAttachments(data || []);
    setUploadingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDeleteAttachment(att: Attachment) {
    if (!confirm('Excluir este anexo?')) return;
    await supabase.storage.from('bill-attachments').remove([att.storage_path]);
    await supabase.from('rosimar_attachments').delete().eq('id', att.id);
    setAttachments(prev => prev.filter(a => a.id !== att.id));
  }

  async function handleViewAttachment(att: Attachment) {
    const { data } = await supabase.storage.from('bill-attachments').createSignedUrl(att.storage_path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  function statusLabel(p: Payment) {
    if (p.status === 'pago') return { label: 'Pago', cls: 'bg-emerald-100 text-emerald-700' };
    if (p.due_date < today) return { label: 'Vencido', cls: 'bg-red-100 text-red-700' };
    if (p.due_date === today) return { label: 'Vence hoje', cls: 'bg-amber-100 text-amber-700' };
    return { label: 'Pendente', cls: 'bg-slate-100 text-slate-600' };
  }

  return (
    <div className="space-y-6">
      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prevMonthNav} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
            <ChevronLeft size={18} className="text-slate-600" />
          </button>
          <span className="text-lg font-bold text-slate-800 min-w-[160px] text-center">
            {formatMonth(month)}
          </span>
          <button onClick={nextMonthNav} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={replicateToNextMonth}
            disabled={replicating || payments.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            <Copy size={15} />
            Replicar para {formatMonth(nextMonth(month))}
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors"
          >
            <Plus size={16} />
            Novo lançamento
          </button>
        </div>
      </div>

      {/* Alerts */}
      {(dueToday.length > 0 || overdue.length > 0) && (
        <div className="space-y-2">
          {dueToday.length > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <Clock size={18} className="text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800 font-medium">
                {dueToday.length} conta{dueToday.length > 1 ? 's' : ''} vencendo hoje:{' '}
                <span className="font-semibold">{dueToday.map(p => p.item).join(', ')}</span>
              </p>
            </div>
          )}
          {overdue.length > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800 font-medium">
                {overdue.length} conta{overdue.length > 1 ? 's' : ''} vencida{overdue.length > 1 ? 's' : ''}:{' '}
                <span className="font-semibold">{overdue.map(p => p.item).join(', ')}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Saldo Inicial</p>
          <input
            type="number"
            value={initialBalance}
            onChange={e => setInitialBalance(e.target.value)}
            placeholder="0,00"
            className="text-2xl font-bold text-slate-800 w-full outline-none bg-transparent placeholder-slate-300"
          />
          <p className="text-xs text-slate-400 mt-1">Clique para editar</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Despesas Pagas</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-slate-400 mt-1">{payments.filter(p => p.status === 'pago').length} lançamento(s)</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Saldo Final</p>
          <p className={`text-2xl font-bold ${finalBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(finalBalance)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Pendente: {formatCurrency(totalPending)}</p>
        </div>
      </div>

      {/* Payments list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Lançamentos</h2>
          <span className="text-sm text-slate-500">{payments.length} item(s)</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Carregando...</div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Nenhum lançamento neste mês.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {payments.map(p => {
              const { label, cls } = statusLabel(p);
              return (
                <div key={p.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  {/* Check button */}
                  <button
                    onClick={() => togglePaid(p)}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      p.status === 'pago'
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 text-transparent hover:border-emerald-400'
                    }`}
                  >
                    <Check size={14} />
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${p.status === 'pago' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {p.item}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
                    </div>
                    {p.description && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{p.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-slate-400">Venc: {formatDate(p.due_date)}</span>
                      {p.bank_info && <span className="text-xs text-slate-400 truncate max-w-[160px]">Banco: {p.bank_info}</span>}
                      {p.observation && <span className="text-xs text-slate-400 truncate max-w-[160px]">Obs: {p.observation}</span>}
                    </div>
                  </div>

                  {/* Amount */}
                  <span className={`text-sm font-bold flex-shrink-0 ${p.status === 'pago' ? 'text-slate-400' : 'text-slate-800'}`}>
                    {formatCurrency(p.amount)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openAttachments(p)}
                      title="Anexos"
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Paperclip size={15} />
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      title="Editar"
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      title="Excluir"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">{editingId ? 'Editar lançamento' : 'Novo lançamento'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Data de vencimento *</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-slate-800 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Valor (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0,00"
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-slate-800 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Item *</label>
                <input
                  type="text"
                  value={form.item}
                  onChange={e => setForm(f => ({ ...f, item: e.target.value }))}
                  placeholder="Ex: Aluguel, Energia, Internet..."
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-slate-800 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Descrição</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Descrição adicional"
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-slate-800 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Dado bancário</label>
                <input
                  type="text"
                  value={form.bank_info}
                  onChange={e => setForm(f => ({ ...f, bank_info: e.target.value }))}
                  placeholder="Ex: Banco Itaú Ag 1234 CC 56789 ou PIX..."
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-slate-800 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Observação</label>
                <textarea
                  value={form.observation}
                  onChange={e => setForm(f => ({ ...f, observation: e.target.value }))}
                  placeholder="Observações livres..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-slate-800 transition-colors resize-none"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{formError}</p>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 text-sm font-semibold bg-slate-800 text-white rounded-xl hover:bg-slate-700 disabled:opacity-60 transition-colors"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachments Modal */}
      {attachmentPaymentId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Anexos</h3>
              <button onClick={() => setAttachmentPaymentId(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Upload */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-slate-500 hover:bg-slate-50 transition-colors"
              >
                <Paperclip size={24} className="text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-medium">
                  {uploadingFile ? 'Enviando...' : 'Clique para anexar arquivo'}
                </p>
                <p className="text-xs text-slate-400 mt-1">PDF, imagens, documentos</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
              />

              {/* List */}
              {attachments.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nenhum anexo ainda.</p>
              ) : (
                <div className="space-y-2">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                      <FileText size={18} className="text-slate-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{att.file_name}</p>
                        <p className="text-xs text-slate-400">{(att.size_bytes / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        onClick={() => handleViewAttachment(att)}
                        title="Visualizar"
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteAttachment(att)}
                        title="Excluir"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
