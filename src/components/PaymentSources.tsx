import { useState, useEffect } from 'react';
import { supabase, PaymentSource } from '../lib/supabase';
import { Plus, Pencil, Trash2, X, Check, CreditCard } from 'lucide-react';

export default function PaymentSources() {
  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => { fetchPaymentSources(); }, []);

  async function fetchPaymentSources() {
    const { data } = await supabase.from('payment_sources').select('*').order('name');
    setPaymentSources(data || []);
    setLoading(false);
  }

  async function handleSave() {
    if (!name.trim()) return;
    if (editingId) {
      await supabase.from('payment_sources').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', editingId);
    } else {
      await supabase.from('payment_sources').insert({ name: name.trim() });
    }
    cancelForm();
    fetchPaymentSources();
  }

  function startEdit(ps: PaymentSource) {
    setEditingId(ps.id);
    setName(ps.name);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    await supabase.from('payment_sources').delete().eq('id', id);
    setDeleteConfirm(null);
    fetchPaymentSources();
  }

  function cancelForm() {
    setName('');
    setEditingId(null);
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fontes Pagadoras</h1>
          <p className="text-slate-500 mt-1">Gerencie as fontes pagadoras externas</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setName(''); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus size={18} />
          Nova Fonte
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {editingId ? 'Editar Fonte Pagadora' : 'Nova Fonte Pagadora'}
          </h2>
          <div className="max-w-sm">
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Cartão Empresa, Conta Corrente..."
              autoFocus
            />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              <Check size={16} /> Salvar
            </button>
            <button onClick={cancelForm} className="flex items-center gap-2 border border-slate-300 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors font-medium">
              <X size={16} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400">Carregando...</div>
      ) : paymentSources.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <CreditCard size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhuma fonte pagadora cadastrada.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paymentSources.map(ps => (
                <tr key={ps.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800">{ps.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(ps)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Pencil size={16} />
                      </button>
                      {deleteConfirm === ps.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(ps.id)} className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors">Confirmar</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 border border-slate-300 text-slate-600 text-xs rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(ps.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
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
