import { useState, useEffect, useCallback } from 'react';
import { supabase, IncomeEntry, formatCurrency, formatDate, formatMonth, getCurrentMonth } from '../lib/supabase';
import { Plus, Pencil, Trash2, X, Check, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';

function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}
function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

const emptyForm = { description: '', amount: '', date: '', origin: '', reference_month: getCurrentMonth() };

export default function IncomeEntries() {
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(getCurrentMonth());
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<IncomeEntry | null>(null);
  const [form, setForm] = useState({ ...emptyForm, reference_month: getCurrentMonth() });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('income_entries').select('*').eq('reference_month', month).order('date');
    setEntries(data || []);
    setLoading(false);
  }, [month]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  function openForm(entry?: IncomeEntry) {
    if (entry) {
      setEditEntry(entry);
      setForm({ description: entry.description, amount: String(entry.amount), date: entry.date, origin: entry.origin, reference_month: entry.reference_month });
    } else {
      setEditEntry(null);
      setForm({ ...emptyForm, reference_month: month });
    }
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.description.trim() || !form.amount || !form.date) return;
    const payload = {
      description: form.description,
      amount: parseFloat(form.amount),
      date: form.date,
      origin: form.origin,
      reference_month: form.reference_month,
      updated_at: new Date().toISOString(),
    };
    if (editEntry) {
      await supabase.from('income_entries').update(payload).eq('id', editEntry.id);
    } else {
      await supabase.from('income_entries').insert(payload);
    }
    setShowForm(false);
    setEditEntry(null);
    fetchEntries();
  }

  async function handleDelete(id: string) {
    await supabase.from('income_entries').delete().eq('id', id);
    setDeleteConfirm(null);
    fetchEntries();
  }

  const total = entries.reduce((s, e) => s + e.amount, 0);
  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Entradas</h1>
          <p className="text-slate-500 mt-1">Lançamentos de receitas e entradas</p>
        </div>
        <button onClick={() => openForm()} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors font-medium">
          <Plus size={18} /> Nova Entrada
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <button onClick={() => setMonth(prevMonth(month))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft size={20} className="text-slate-600" />
        </button>
        <span className="font-semibold text-slate-800 text-lg min-w-[180px] text-center">{formatMonth(month)}</span>
        <button onClick={() => setMonth(nextMonth(month))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronRight size={20} className="text-slate-600" />
        </button>
        <div className="ml-auto bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-center">
          <p className="text-xs text-emerald-600">Total de Entradas</p>
          <p className="font-bold text-emerald-700 text-lg">{formatCurrency(total)}</p>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">{editEntry ? 'Editar Entrada' : 'Nova Entrada'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição *</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputClass} placeholder="Descrição da entrada" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor *</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inputClass} placeholder="0,00" min="0" step="0.01" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Origem</label>
                <input type="text" value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} className={inputClass} placeholder="Ex: Cliente, Venda..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mês de Referência</label>
                <input type="month" value={form.reference_month} onChange={e => setForm(f => ({ ...f, reference_month: e.target.value }))} className={inputClass} />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={handleSave} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors font-medium">
                <Check size={16} /> Salvar
              </button>
              <button onClick={() => setShowForm(false)} className="flex items-center gap-2 border border-slate-300 text-slate-600 px-5 py-2.5 rounded-lg hover:bg-slate-50 transition-colors font-medium">
                <X size={16} /> Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400">Carregando...</div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <TrendingUp size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhuma entrada lançada para este mês.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Origem</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{entry.description}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCurrency(entry.amount)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(entry.date)}</td>
                  <td className="px-4 py-3 text-slate-500">{entry.origin || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openForm(entry)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Pencil size={15} />
                      </button>
                      {deleteConfirm === entry.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(entry.id)} className="px-2 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors">Excluir</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 border border-slate-300 text-slate-600 text-xs rounded-lg hover:bg-slate-50 transition-colors">Não</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(entry.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
