import { useState, useEffect } from 'react';
import { supabase, Bill, CostCenter, PaymentSource, Status, Classification, ColorTag, COLOR_TAGS, getCurrentMonth, todayLocal } from '../lib/supabase';
import { X, Check, ExternalLink, Paperclip, Upload, Trash2, FileText, Receipt, Tag } from 'lucide-react';

interface Props {
  bill?: Bill | null;
  onClose: () => void;
  onSaved: () => void;
  defaultMonth?: string;
}

const emptyForm = {
  status: 'aberto' as Status,
  due_date: '',
  item: '',
  amount: '',
  cost_center_id: '',
  classification: 'fixo' as Classification,
  bank_info: '',
  reference_month: getCurrentMonth(),
  external_payment: false,
  external_payment_description: '',
  payment_source_id: '',
  payment_date: '',
  color_tag: null as ColorTag,
};

// Interface para anexo (com tipo)
interface BillAttachment {
  id: string;
  file_name: string;
  storage_path: string;
  type: 'boleto' | 'comprovante';
  created_at: string;
  signedUrl?: string;
}

export default function BillForm({ bill, onClose, onSaved, defaultMonth }: Props) {
  const [form, setForm] = useState({ ...emptyForm, reference_month: defaultMonth || getCurrentMonth() });
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>([]);
  const [savedBillId, setSavedBillId] = useState<string | null>(bill?.id ?? null);
  const [saved, setSaved] = useState(!!bill);

  // Anexos separados
  const [boletos, setBoletos] = useState<BillAttachment[]>([]);
  const [comprovantes, setComprovantes] = useState<BillAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.from('cost_centers').select('*').order('name').then(({ data }) => setCostCenters(data || []));
    supabase.from('payment_sources').select('*').order('name').then(({ data }) => setPaymentSources(data || []));
  }, []);

  useEffect(() => {
    if (bill) {
      setSavedBillId(bill.id);
      setSaved(true);
      setForm({
        status: bill.status,
        due_date: bill.due_date,
        item: bill.item,
        amount: String(bill.amount),
        cost_center_id: bill.cost_center_id || '',
        classification: bill.classification,
        bank_info: bill.bank_info,
        reference_month: bill.reference_month,
        external_payment: bill.external_payment ?? false,
        external_payment_description: bill.external_payment_description ?? '',
        payment_source_id: bill.payment_source_id || '',
        payment_date: bill.payment_date || '',
        color_tag: bill.color_tag ?? null,
      });
      loadAttachments(bill.id);
    }
  }, [bill]);

  async function loadAttachments(billId: string) {
    const { data, error } = await supabase
      .from('bill_attachments')
      .select('*')
      .eq('bill_id', billId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Erro ao carregar anexos:', error);
      return;
    }
    const items = data || [];
    const withUrls = await Promise.all(
      items.map(async (att) => {
        const { data: signed } = await supabase.storage
          .from('bill-attachments')
          .createSignedUrl(att.storage_path, 60 * 60);
        return { ...att, signedUrl: signed?.signedUrl ?? undefined };
      })
    );
    setBoletos(withUrls.filter(a => a.type === 'boleto'));
    setComprovantes(withUrls.filter(a => a.type === 'comprovante'));
  }

  async function handleFileUpload(files: FileList | null, type: 'boleto' | 'comprovante') {
    if (!files || files.length === 0) return;
    if (!savedBillId) {
      alert('Salve a conta primeiro antes de anexar arquivos.');
      return;
    }
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const storagePath = `bills/${savedBillId}/${type}/${fileName}`;

        // Upload para o Storage do Supabase
        const { error: uploadError } = await supabase.storage
          .from('bill-attachments') // Bucket já deve existir
          .upload(storagePath, file);
        if (uploadError) throw uploadError;

        // Inserir registro na tabela bill_attachments
        const { error: dbError } = await supabase.from('bill_attachments').insert({
          bill_id: savedBillId,
          file_name: file.name,
          storage_path: storagePath,
          mime_type: file.type,
          size_bytes: file.size,
          type: type,
        });
        if (dbError) throw dbError;
      }
      await loadAttachments(savedBillId);
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Falha ao enviar arquivo. Verifique o bucket Storage e as permissões.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAttachment(attachment: BillAttachment) {
    if (!confirm(`Remover ${attachment.file_name}?`)) return;
    try {
      // Remover do Storage
      const { error: storageError } = await supabase.storage
        .from('bill-attachments')
        .remove([attachment.storage_path]);
      if (storageError) throw storageError;

      // Remover do banco
      const { error: dbError } = await supabase
        .from('bill_attachments')
        .delete()
        .eq('id', attachment.id);
      if (dbError) throw dbError;

      // Atualizar estado local
      if (attachment.type === 'boleto') {
        setBoletos(prev => prev.filter(a => a.id !== attachment.id));
      } else {
        setComprovantes(prev => prev.filter(a => a.id !== attachment.id));
      }
    } catch (error) {
      console.error('Erro ao deletar:', error);
      alert('Não foi possível remover o anexo.');
    }
  }

  function handleStatusChange(newStatus: Status) {
    setForm(f => ({
      ...f,
      status: newStatus,
      payment_date: newStatus === 'pago' && !f.payment_date
        ? todayLocal()
        : newStatus !== 'pago' ? '' : f.payment_date,
    }));
  }

  async function handleSave() {
    if (!form.item.trim() || !form.due_date || !form.amount) return;
    const payload = {
      status: form.status,
      due_date: form.due_date,
      item: form.item,
      amount: parseFloat(form.amount),
      cost_center_id: form.cost_center_id || null,
      classification: form.classification,
      bank_info: form.bank_info,
      reference_month: form.reference_month,
      external_payment: form.external_payment,
      external_payment_description: form.external_payment ? form.external_payment_description : '',
      payment_source_id: form.external_payment && form.payment_source_id ? form.payment_source_id : null,
      payment_date: form.status === 'pago' && form.payment_date ? form.payment_date : null,
      color_tag: form.color_tag,
      updated_at: new Date().toISOString(),
    };

    let billId = savedBillId;
    if (bill) {
      await supabase.from('bills').update(payload).eq('id', bill.id);
      billId = bill.id;
    } else {
      const { data } = await supabase.from('bills').insert(payload).select('id').single();
      billId = data?.id;
      if (billId) setSavedBillId(billId);
    }
    setSaved(true);
    onSaved();
    onClose();
  }

  function handleClose() {
    onClose();
  }

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {node}
    </div>
  );

  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

  // Componente interno para exibir área de upload de anexos por tipo
  const AttachmentSection = ({ type, title, icon, attachments }: { type: 'boleto' | 'comprovante', title: string, icon: React.ReactNode, attachments: BillAttachment[] }) => (
    <div className="border rounded-xl p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-medium text-slate-700">{title}</h3>
        </div>
        {savedBillId && (
          <label className="cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
            <Upload size={14} />
            <span>Upload</span>
            <input
              type="file"
              multiple
              className="hidden"
              accept="image/*,application/pdf"
              onChange={e => handleFileUpload(e.target.files, type)}
              disabled={uploading}
            />
          </label>
        )}
      </div>
      {!savedBillId && (
        <div className="text-xs text-slate-400 flex items-center gap-2 py-2">
          <Paperclip size={14} /> Salve a conta para adicionar anexos.
        </div>
      )}
      {attachments.length === 0 && savedBillId && (
        <div className="text-xs text-slate-400 italic py-2">Nenhum {title.toLowerCase()} anexado.</div>
      )}
      <div className="space-y-2 mt-2">
        {attachments.map(att => (
          <div key={att.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
            <a
              href={att.signedUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center gap-2 truncate"
            >
              <FileText size={14} />
              <span className="truncate">{att.file_name}</span>
            </a>
            <button
              onClick={() => handleDeleteAttachment(att)}
              className="text-red-500 hover:text-red-700 p-1"
              title="Remover"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">{bill ? 'Editar Conta' : 'Nova Conta a Pagar'}</h2>
          <button onClick={handleClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('Item / Descrição *', <input type="text" value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))} className={inputClass} placeholder="Nome do item" />)}
          {field('Valor *', <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inputClass} placeholder="0,00" min="0" step="0.01" />)}
          {field('Vencimento *', <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inputClass} />)}
          {field('Mês de Referência', (
            <input type="month" value={form.reference_month} onChange={e => setForm(f => ({ ...f, reference_month: e.target.value }))} className={inputClass} />
          ))}
          {field('Status', (
            <select value={form.status} onChange={e => handleStatusChange(e.target.value as Status)} className={inputClass}>
              <option value="aberto">Aberto</option>
              <option value="pago">Pago</option>
              <option value="vencido">Vencido</option>
            </select>
          ))}
          {form.status === 'pago' && field('Data de Pagamento', (
            <input
              type="date"
              value={form.payment_date}
              onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
              className="w-full border border-emerald-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-emerald-50"
            />
          ))}
          {field('Classificação', (
            <select value={form.classification} onChange={e => setForm(f => ({ ...f, classification: e.target.value as Classification }))} className={inputClass}>
              <option value="fixo">Fixo</option>
              <option value="fixo_variavel">Fixo Variável</option>
              <option value="extra">Extra</option>
            </select>
          ))}
          {field('Centro de Custo', (
            <select value={form.cost_center_id} onChange={e => setForm(f => ({ ...f, cost_center_id: e.target.value }))} className={inputClass}>
              <option value="">— Selecione —</option>
              {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
            </select>
          ))}
          {field('Dado Bancário', <input type="text" value={form.bank_info} onChange={e => setForm(f => ({ ...f, bank_info: e.target.value }))} className={inputClass} placeholder="Banco / Conta / Pix" />)}
        </div>

        {/* Color tag section */}
        <div className="px-6 pb-4">
          <div className="border border-slate-200 rounded-xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag size={16} className="text-slate-500" />
              <h3 className="text-sm font-medium text-slate-700">Categoria de Cor</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, color_tag: null }))}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${form.color_tag === null ? 'border-slate-800 bg-white shadow-sm' : 'border-slate-200 bg-white hover:border-slate-400'}`}
              >
                <span className="w-6 h-6 rounded-full border-2 border-slate-300 bg-white" />
                <span className="text-xs font-medium text-slate-600">Sem cor</span>
              </button>
              {COLOR_TAGS.map(ct => (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color_tag: ct.value }))}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${form.color_tag === ct.value ? 'border-slate-800 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                >
                  <span className={`w-6 h-6 rounded-full ${ct.swatch}`} />
                  <span className="text-xs font-medium text-slate-700">{ct.label}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">{ct.legend}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* External payment section */}
        <div className="px-6 pb-4">
          <div className={`border rounded-xl p-4 transition-colors ${form.external_payment ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={form.external_payment}
                  onChange={e => setForm(f => ({ ...f, external_payment: e.target.checked, payment_source_id: '' }))}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${form.external_payment ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-300'}`}>
                  {form.external_payment && <Check size={12} className="text-white" strokeWidth={3} />}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ExternalLink size={16} className={form.external_payment ? 'text-amber-600' : 'text-slate-400'} />
                <span className={`text-sm font-medium ${form.external_payment ? 'text-amber-700' : 'text-slate-600'}`}>
                  Pagamento Externo
                </span>
              </div>
              {form.external_payment && (
                <span className="ml-auto text-xs text-amber-600 font-medium bg-amber-100 px-2 py-0.5 rounded-full">
                  Não afeta saldo
                </span>
              )}
            </label>
            {form.external_payment && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-amber-700 mb-1">Fonte Pagadora</label>
                <select
                  value={form.payment_source_id}
                  onChange={e => setForm(f => ({ ...f, payment_source_id: e.target.value }))}
                  className="w-full border border-amber-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm bg-white"
                >
                  <option value="">— Selecione a fonte pagadora —</option>
                  {paymentSources.map(ps => (
                    <option key={ps.id} value={ps.id}>{ps.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Seção de Anexos: Boleto e Comprovantes */}
        {saved && savedBillId ? (
          <div className="px-6 pb-4 space-y-4">
            <AttachmentSection
              type="boleto"
              title="Boleto"
              icon={<FileText size={18} className="text-blue-600" />}
              attachments={boletos}
            />
            <AttachmentSection
              type="comprovante"
              title="Comprovantes"
              icon={<Receipt size={18} className="text-emerald-600" />}
              attachments={comprovantes}
            />
          </div>
        ) : (
          <div className="px-6 pb-4">
            <div className="border border-dashed border-slate-300 rounded-xl bg-slate-50 p-4 flex items-center gap-3">
              <Paperclip size={16} className="text-slate-400 flex-shrink-0" />
              <p className="text-xs text-slate-400">Salve a conta primeiro para poder anexar boletos e comprovantes.</p>
            </div>
          </div>
        )}

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={handleSave} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium">
            <Check size={16} /> Salvar
          </button>
          <button onClick={handleClose} className="flex items-center gap-2 border border-slate-300 text-slate-600 px-5 py-2.5 rounded-lg hover:bg-slate-50 transition-colors font-medium">
            <X size={16} /> Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
