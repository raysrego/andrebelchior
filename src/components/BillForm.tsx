import { useState, useEffect } from 'react';
import { supabase, Bill, CostCenter, Status, Classification, getCurrentMonth } from '../lib/supabase';
import { X, Check } from 'lucide-react';

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
};

export default function BillForm({ bill, onClose, onSaved, defaultMonth }: Props) {
  const [form, setForm] = useState({ ...emptyForm, reference_month: defaultMonth || getCurrentMonth() });
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);

  useEffect(() => {
    supabase.from('cost_centers').select('*').order('name').then(({ data }) => setCostCenters(data || []));
  }, []);

  useEffect(() => {
    if (bill) {
      setForm({
        status: bill.status,
        due_date: bill.due_date,
        item: bill.item,
        amount: String(bill.amount),
        cost_center_id: bill.cost_center_id || '',
        classification: bill.classification,
        bank_info: bill.bank_info,
        reference_month: bill.reference_month,
      });
    }
  }, [bill]);

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
      updated_at: new Date().toISOString(),
    };
    if (bill) {
      await supabase.from('bills').update(payload).eq('id', bill.id);
    } else {
      await supabase.from('bills').insert(payload);
    }
    onSaved();
    onClose();
  }

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {node}
    </div>
  );

  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">{bill ? 'Editar Conta' : 'Nova Conta a Pagar'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
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
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))} className={inputClass}>
              <option value="aberto">Aberto</option>
              <option value="pago">Pago</option>
              <option value="vencido">Vencido</option>
            </select>
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
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={handleSave} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium">
            <Check size={16} /> Salvar
          </button>
          <button onClick={onClose} className="flex items-center gap-2 border border-slate-300 text-slate-600 px-5 py-2.5 rounded-lg hover:bg-slate-50 transition-colors font-medium">
            <X size={16} /> Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
