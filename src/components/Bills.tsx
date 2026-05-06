import { useState, useEffect, useCallback } from 'react';
import { supabase, Bill, computeStatus, formatCurrency, formatDate, formatMonth, getCurrentMonth } from '../lib/supabase';
import { Plus, Pencil, Trash2, Copy, ChevronLeft, ChevronRight, FileText, ExternalLink } from 'lucide-react';
import BillForm from './BillForm';

const STATUS_COLORS: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-700',
  pago: 'bg-emerald-100 text-emerald-700',
  vencido: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  pago: 'Pago',
  vencido: 'Vencido',
};

const CLASS_LABELS: Record<string, string> = {
  fixo: 'Fixo',
  fixo_variavel: 'Fixo Variável',
  extra: 'Extra',
};

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

export default function Bills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(getCurrentMonth());
  const [showForm, setShowForm] = useState(false);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [replicateConfirm, setReplicateConfirm] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');

  const fetchBills = useCallback(async () => {
    setLoading(true);
    // 1. Buscar contas do mês
    const { data: billsData, error: billsError } = await supabase
      .from('bills')
      .select('*')
      .eq('reference_month', month)
      .order('due_date');

    if (billsError) {
      console.error(billsError);
      setBills([]);
      setLoading(false);
      return;
    }

    if (!billsData || billsData.length === 0) {
      setBills([]);
      setLoading(false);
      return;
    }

    // 2. IDs únicos dos centros de custo
    const costCenterIds = [...new Set(billsData.map(b => b.cost_center_id).filter(id => id))];
    let centersMap = new Map();
    if (costCenterIds.length > 0) {
      const { data: centers } = await supabase
        .from('cost_centers')
        .select('id, name')
        .in('id', costCenterIds);
      if (centers) centersMap = new Map(centers.map(c => [c.id, c]));
    }

    // 3. Enriquecer com nome do centro de custo e recalcular status
    const updated = billsData.map(b => ({
      ...b,
      cost_centers: centersMap.get(b.cost_center_id) || null,
      status: computeStatus(b.due_date, b.status),
    })) as Bill[];

    // 4. Atualizar status no banco (se necessário)
    const toUpdate = updated.filter((b, idx) => b.status !== billsData[idx].status);
    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map(b => supabase.from('bills').update({ status: b.status }).eq('id', b.id))
      );
    }

    setBills(updated);
    setLoading(false);
  }, [month]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  async function handleDelete(id: string) {
    await supabase.from('bills').delete().eq('id', id);
    setDeleteConfirm(null);
    fetchBills();
  }

  async function handleReplicate(bill: Bill) {
    const nm = nextMonth(bill.reference_month);
    const [y, m] = nm.split('-').map(Number);
    const dueDay = new Date(bill.due_date).getDate();
    const newDue = `${y}-${String(m).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
    await supabase.from('bills').insert({
      status: 'aberto',
      due_date: newDue,
      item: bill.item,
      amount: bill.amount,
      cost_center_id: bill.cost_center_id,
      classification: bill.classification,
      bank_info: bill.bank_info,
      reference_month: nm,
    });
    setReplicateConfirm(null);
    fetchBills();
  }

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filtered = filterStatus ? bills.filter(b => b.status === filterStatus) : bills;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const total = bills.reduce((s, b) => s + b.amount, 0);
  const paid = bills.filter(b => b.status === 'pago').reduce((s, b) => s + b.amount, 0);
  const pending = bills.filter(b => b.status !== 'pago').reduce((s, b) => s + b.amount, 0);

  // Reset page when filter or month changes
  useEffect(() => { setPage(1); }, [filterStatus, month]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho e navegação (idênticos ao original) */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Contas a Pagar</h1>
          <p className="text-slate-500 mt-1">Gerencie suas despesas mensais</p>
        </div>
        <button
          onClick={() => { setEditBill(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus size={18} />
          Nova Conta
        </button>
      </div>

      <div className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <button onClick={() => setMonth(prevMonth(month))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft size={20} className="text-slate-600" />
        </button>
        <span className="font-semibold text-slate-800 text-lg min-w-[180px] text-center">{formatMonth(month)}</span>
        <button onClick={() => setMonth(nextMonth(month))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronRight size={20} className="text-slate-600" />
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-slate-500">Filtrar:</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos</option>
            <option value="aberto">Aberto</option>
            <option value="pago">Pago</option>
            <option value="vencido">Vencido</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Total do Mês</p>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(total)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Pago</p>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(paid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Em Aberto</p>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(pending)}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <FileText size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhuma conta encontrada para este mês.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Item</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vencimento</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Centro de Custo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Classificação</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dado Bancário</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map(bill => (
                  <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[bill.status]}`}>
                        {STATUS_LABELS[bill.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{bill.item}</span>
                        {bill.external_payment && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full" title={bill.external_payment_description || 'Pagamento Externo'}>
                            <ExternalLink size={10} />
                            Externo
                          </span>
                        )}
                      </div>
                      {bill.external_payment && bill.external_payment_description && (
                        <p className="text-xs text-slate-400 mt-0.5">{bill.external_payment_description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(bill.due_date)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(bill.amount)}</td>
                    <td className="px-4 py-3 text-slate-600">{bill.cost_centers?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{CLASS_LABELS[bill.classification]}</td>
                    <td className="px-4 py-3 text-slate-500 text-sm">{bill.bank_info || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditBill(bill); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                          <Pencil size={15} />
                        </button>
                        {replicateConfirm === bill.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleReplicate(bill)} className="px-2 py-1 bg-teal-600 text-white text-xs rounded-lg hover:bg-teal-700 transition-colors">Sim</button>
                            <button onClick={() => setReplicateConfirm(null)} className="px-2 py-1 border border-slate-300 text-slate-600 text-xs rounded-lg hover:bg-slate-50 transition-colors">Não</button>
                          </div>
                        ) : (
                          <button onClick={() => setReplicateConfirm(bill.id)} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title={`Replicar para ${formatMonth(nextMonth(bill.reference_month))}`}>
                            <Copy size={15} />
                          </button>
                        )}
                        {deleteConfirm === bill.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(bill.id)} className="px-2 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors">Excluir</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 border border-slate-300 text-slate-600 text-xs rounded-lg hover:bg-slate-50 transition-colors">Não</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(bill.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-sm text-slate-500">
                Exibindo {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} lançamentos
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <BillForm
          bill={editBill}
          defaultMonth={month}
          onClose={() => { setShowForm(false); setEditBill(null); }}
          onSaved={fetchBills}
        />
      )}
    </div>
  );
}
