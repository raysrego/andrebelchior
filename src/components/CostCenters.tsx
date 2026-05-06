import { useState, useEffect } from 'react';
import { supabase, CostCenter } from '../lib/supabase';
import { Plus, Pencil, Trash2, X, Check, Building2 } from 'lucide-react';

export default function CostCenters() {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => { fetchCostCenters(); }, []);

  async function fetchCostCenters() {
    const { data } = await supabase.from('cost_centers').select('*').order('name');
    setCostCenters(data || []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    if (editingId) {
      await supabase.from('cost_centers').update({ name: form.name, description: form.description }).eq('id', editingId);
    } else {
      await supabase.from('cost_centers').insert({ name: form.name, description: form.description });
    }
    setForm({ name: '', description: '' });
    setEditingId(null);
    setShowForm(false);
    fetchCostCenters();
  }

  function startEdit(cc: CostCenter) {
    setEditingId(cc.id);
    setForm({ name: cc.name, description: cc.description });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    await supabase.from('cost_centers').delete().eq('id', id);
    setDeleteConfirm(null);
    fetchCostCenters();
  }

  function cancelForm() {
    setForm({ name: '', description: '' });
    setEditingId(null);
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Centros de Custo</h1>
          <p className="text-slate-500 mt-1">Gerencie os centros de custo da empresa</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', description: '' }); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus size={18} />
          Novo Centro
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {editingId ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Administrativo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Descrição opcional"
              />
            </div>
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
      ) : costCenters.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Building2 size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhum centro de custo cadastrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {costCenters.map(cc => (
                <tr key={cc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800">{cc.name}</td>
                  <td className="px-6 py-4 text-slate-500">{cc.description || '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(cc)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Pencil size={16} />
                      </button>
                      {deleteConfirm === cc.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(cc.id)} className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors">Confirmar</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 border border-slate-300 text-slate-600 text-xs rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(cc.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
