import { useState, useEffect, useCallback } from 'react';
import { supabase, Bill, CostCenter, PaymentSource, computeStatus, formatCurrency, formatDate, formatMonth, getCurrentMonth, todayLocal } from '../lib/supabase';
import { Plus, Pencil, Trash2, Copy, ChevronLeft, ChevronRight, FileText, ExternalLink, Bell, Paperclip } from 'lucide-react';
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
  const [filterCostCenter, setFilterCostCenter] = useState('');
  const [filterPaymentSource, setFilterPaymentSource] = useState('');
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>([]);
  const [dismissedAlert, setDismissedAlert] = useState(false);

  useEffect(() => {
    supabase.from('cost_centers').select('*').order('name').then(({ data }) => setCostCenters(data || []));
    supabase.from('payment_sources').select('*').order('name').then(({ data }) => setPaymentSources(data || []));
  }, []);

  const fetchBills = useCallback(async () => {
    setLoading(true);
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

    const costCenterIds = [...new Set(billsData.map(b => b.cost_center_id).filter(Boolean))];
    let centersMap = new Map();
    if (costCenterIds.length > 0) {
      const { data: centers } = await supabase.from('cost_centers').select('id, name').in('id', costCenterIds);
      if (centers) centersMap = new Map(centers.map(c => [c.id, c]));
    }

    const paymentSourceIds = [...new Set(billsData.map(b => b.payment_source_id).filter(Boolean))];
    let sourcesMap = new Map();
    if (paymentSourceIds.length > 0) {
      const { data: sources } = await supabase.from('payment_sources').select('id, name').in('id', paymentSourceIds);
      if (sources) sourcesMap = new Map(sources.map(s => [s.id, s]));
    }

    // Attachment counts
    const billIds = billsData.map(b => b.id);
    const { data: attachCounts } = await supabase
      .from('bill_attachments')
      .select('bill_id')
      .in('bill_id', billIds);
    const countMap: Record<string, number> = {};
    (attachCounts || []).forEach(a => { countMap[a.bill_id] = (countMap[a.bill_id] || 0) + 1; });

    const updated = billsData.map(b => ({
      ...b,
      cost_centers: centersMap.get(b.cost_center_id) || null,
      payment_sources: sourcesMap.get(b.payment_source_id) || null,
      status: computeStatus(b.due_date, b.status),
      _attachment_count: countMap[b.id] || 0,
    })) as Bill[];

    const toUpdate = updated.filter((b, idx) => b.status !== billsData[idx].status);
    if (toUpdate.length > 0) {
      await Promise.all(toUpdate.map(b => supabase.from('bills').update({ status: b.status }).eq('id', b.id)));
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
    const dueDay = parseInt(bill.due_date.split('-')[2], 10);
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
      external_payment: bill.external_payment,
      payment_source_id: bill.payment_source_id,
    });
    setReplicateConfirm(null);
    fetchBills();
  }

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  let filtered = bills;
  if (filterStatus) filtered = filtered.filter(b => b.status === filterStatus);
  if (filterCostCenter) filtered = filtered.filter(b => b.cost_center_id === filterCostCenter);
  if (filterPaymentSource) {
    if (filterPaymentSource === '__none__') {
      filtered = filtered.filter(b => !b.payment_source_id);
    } else {
      filtered = filtered.filter(b => b.payment_source_id === filterPaymentSource);
    }
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const total = bills.reduce((s, b) => s + b.amount, 0);
  const paid = bills.filter(b => b.status === 'pago').reduce((s, b) => s + b.amount, 0);
  const pending = bills.filter(b => b.status !== 'pago').reduce((s, b) => s + b.amount, 0);

  const today = todayLocal();
  const dueTodayBills = bills.filter(b => b.due_date === today && b.status !== 'pago');

  useEffect(() => { setPage(1); }, [filterStatus, filterCostCenter, filterPaymentSource, month]);

  return (
    <div className="space-y-4">
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

      {/* Today's alert */}
      {dueTodayBills.length > 0 && !dismissedAlert && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <Bell size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {dueTodayBills.length} conta{dueTodayBills.length > 1 ? 's vencem' : ' vence'} hoje!
            </p>
            <ul className="mt-1 space-y-0.5">
              {dueTodayBills.map(b => (
                <li key={b.id} className="text-xs text-amber-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <span className="font-medium">{b.item}</span>
                  <span className="text-amber-600">— {formatCurrency(b.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => setDismissedAlert(true)}
            className="text-amber-500 hover:text-amber-700 transition-colors"
          >
            <ChevronRight size={16} className="rotate-90" />
          </button>
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <button onClick={() => setMonth(prevMonth(month))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft size={20} className="text-slate-600" />
        </button>
        <span className="font-semibold text-slate-800 text-lg min-w-[180px] text-center">{formatMonth(month)}</span>
        <button onClick={() => setMonth(nextMonth(month))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronRight size={20} className="text-slate-600" />
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todos</option>
              <option value="aberto">Aberto</option>
              <option value="pago">Pago</option>
              <option value="vencido">Vencido</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Centro de Custo</label>
            <select value={filterCostCenter} onChange={e => setFilterCostCenter(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todos</option>
              {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fonte Pagadora</label>
            <select value={filterPaymentSource} onChange={e => setFilterPaymentSource(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas</option>
              <option value="__none__">Sem fonte (pessoal)</option>
              {paymentSources.map(ps => <option key={ps.id} value={ps.id}>{ps.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            {(filterStatus || filterCostCenter || filterPaymentSource) && (
              <button
                onClick={() => { setFilterStatus(''); setFilterCostCenter(''); setFilterPaymentSource(''); }}
                className="w-full border border-slate-300 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dt. Pagamento</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Centro de Custo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Classificação</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dado Bancário</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map(bill => (
                  <tr key={bill.id} className={`transition-colors ${bill.status === 'pago' ? 'bg-emerald-50/40 hover:bg-emerald-50' : bill.due_date === today ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[bill.status]}`}>
                        {STATUS_LABELS[bill.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${bill.status === 'pago' ? 'text-emerald-700' : 'text-slate-800'}`}>{bill.item}</span>
                        {bill.external_payment && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full" title={(bill.payment_sources as any)?.name || 'Pagamento Externo'}>
                            <ExternalLink size={10} />
                            {(bill.payment_sources as any)?.name || 'Externo'}
                          </span>
                        )}
                        {(bill._attachment_count ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full" title={`${bill._attachment_count} anexo(s)`}>
                            <Paperclip size={9} />
                            {bill._attachment_count}
                          </span>
                        )}
                        {bill.due_date === today && bill.status !== 'pago' && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full">
                            <Bell size={9} />
                            Hoje
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-sm ${bill.status === 'pago' ? 'text-emerald-600' : bill.due_date === today ? 'text-amber-700 font-semibold' : 'text-slate-600'}`}>{formatDate(bill.due_date)}</td>
                    <td className="px-4 py-3 text-sm text-emerald-600 font-medium">{bill.payment_date ? formatDate(bill.payment_date) : '—'}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${bill.status === 'pago' ? 'text-emerald-700' : 'text-slate-800'}`}>{formatCurrency(bill.amount)}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{(bill.cost_centers as any)?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{CLASS_LABELS[bill.classification]}</td>
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
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
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
