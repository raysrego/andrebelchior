import { useState, useEffect, useCallback } from 'react';
import { supabase, Bill, IncomeEntry, CostCenter, PaymentSource, formatCurrency, formatDate, computeStatus, formatMonth } from '../lib/supabase';
import { Search, Filter, FileBarChart, TrendingUp, TrendingDown, FileDown } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-700',
  pago: 'bg-emerald-100 text-emerald-700',
  vencido: 'bg-red-100 text-red-700',
};
const STATUS_LABELS: Record<string, string> = { aberto: 'Aberto', pago: 'Pago', vencido: 'Vencido' };
const CLASS_LABELS: Record<string, string> = { fixo: 'Fixo', fixo_variavel: 'Fixo Variável', extra: 'Extra' };

export default function Reports() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    costCenterId: '',
    paymentSourceId: '',
    classification: '',
    search: '',
    type: 'all' as 'all' | 'bills' | 'income',
  });

  useEffect(() => {
    supabase.from('cost_centers').select('*').order('name').then(({ data }) => setCostCenters(data || []));
    supabase.from('payment_sources').select('*').order('name').then(({ data }) => setPaymentSources(data || []));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);

    let billsQuery = supabase.from('bills').select('*, cost_centers(id, name), payment_sources(id, name)');
    let entriesQuery = supabase.from('income_entries').select('*');

    if (filters.startDate) {
      billsQuery = billsQuery.gte('due_date', filters.startDate);
      entriesQuery = entriesQuery.gte('date', filters.startDate);
    }
    if (filters.endDate) {
      billsQuery = billsQuery.lte('due_date', filters.endDate);
      entriesQuery = entriesQuery.lte('date', filters.endDate);
    }
    if (filters.costCenterId) {
      billsQuery = billsQuery.eq('cost_center_id', filters.costCenterId);
    }
    if (filters.paymentSourceId) {
      if (filters.paymentSourceId === '__none__') {
        billsQuery = billsQuery.is('payment_source_id', null);
      } else {
        billsQuery = billsQuery.eq('payment_source_id', filters.paymentSourceId);
      }
    }
    if (filters.classification) {
      billsQuery = billsQuery.eq('classification', filters.classification);
    }
    if (filters.search) {
      billsQuery = billsQuery.ilike('item', `%${filters.search}%`);
      entriesQuery = entriesQuery.ilike('description', `%${filters.search}%`);
    }

    const [{ data: billsData }, { data: entriesData }] = await Promise.all([
      filters.type !== 'income' ? billsQuery.order('due_date') : Promise.resolve({ data: [] }),
      filters.type !== 'bills' ? entriesQuery.order('date') : Promise.resolve({ data: [] }),
    ]);

    setBills(((billsData || []).map(b => ({ ...b, status: computeStatus(b.due_date, b.status) }))) as Bill[]);
    setEntries(entriesData || []);
    setLoading(false);
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalIncome = entries.reduce((s, e) => s + e.amount, 0);
  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const totalPaid = bills.filter(b => b.status === 'pago').reduce((s, b) => s + b.amount, 0);

  function handleExportPDF() {
    const genDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const periodLabel = filters.startDate || filters.endDate
      ? `${filters.startDate ? formatDate(filters.startDate) : '—'} até ${filters.endDate ? formatDate(filters.endDate) : '—'}`
      : 'Todos os períodos';

    const pw = window.open('', '_blank', 'width=900,height=700');
    if (!pw) return;

    pw.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Relatório Financeiro</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;background:#fff;padding:36px}
  .header{border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}
  .header-left h1{font-size:18px;font-weight:700;color:#0f172a}
  .header-left p{font-size:11px;color:#64748b;margin-top:2px}
  .header-right{text-align:right;font-size:11px;color:#64748b}
  .summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px}
  .summary-card{border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px}
  .summary-card .label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px}
  .summary-card .value{font-size:15px;font-weight:700}
  .value-income{color:#059669}
  .value-expense{color:#dc2626}
  .value-neutral{color:#1e293b}
  .section{margin-bottom:24px}
  .section-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#475569;border-bottom:1px solid #e2e8f0;padding-bottom:5px;margin-bottom:10px}
  table{width:100%;border-collapse:collapse}
  thead tr{background:#f8fafc}
  th{text-align:left;padding:7px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;border-bottom:1px solid #e2e8f0}
  th.right{text-align:right}
  td{padding:7px 10px;font-size:11px;border-bottom:1px solid #f1f5f9;color:#334155}
  td.right{text-align:right;font-weight:600}
  .badge{display:inline-block;padding:2px 7px;border-radius:99px;font-size:10px;font-weight:600}
  .badge-pago{background:#d1fae5;color:#065f46}
  .badge-aberto{background:#dbeafe;color:#1e40af}
  .badge-vencido{background:#fee2e2;color:#991b1b}
  .total-row td{font-weight:700;background:#f8fafc;border-top:2px solid #e2e8f0}
  .green{color:#059669}
  .footer{margin-top:28px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}
  @media print{body{padding:20px}}
</style>
</head>
<body>
<div class="header">
  <div class="header-left">
    <h1>Relatório Financeiro</h1>
    <p>Período: ${periodLabel}</p>
  </div>
  <div class="header-right">
    <p>Emitido em ${genDate}</p>
  </div>
</div>

<div class="summary-grid">
  <div class="summary-card"><div class="label">Total Entradas</div><div class="value value-income">${formatCurrency(totalIncome)}</div></div>
  <div class="summary-card"><div class="label">Total Despesas</div><div class="value value-expense">${formatCurrency(totalBills)}</div></div>
  <div class="summary-card"><div class="label">Resultado</div><div class="value" style="color:${totalIncome - totalBills >= 0 ? '#1d4ed8' : '#ea580c'}">${formatCurrency(totalIncome - totalBills)}</div></div>
</div>

${entries.length > 0 ? `
<div class="section">
  <div class="section-title">Entradas (${entries.length})</div>
  <table>
    <thead><tr><th>Descrição</th><th>Origem</th><th>Mês Ref.</th><th>Data</th><th class="right">Valor</th></tr></thead>
    <tbody>
      ${entries.map(e => `<tr><td>${e.description}</td><td>${e.origin || '—'}</td><td>${e.reference_month}</td><td>${formatDate(e.date)}</td><td class="right value-income">${formatCurrency(e.amount)}</td></tr>`).join('')}
      <tr class="total-row"><td colspan="4">Total de Entradas</td><td class="right value-income">${formatCurrency(totalIncome)}</td></tr>
    </tbody>
  </table>
</div>` : ''}

${bills.length > 0 ? `
<div class="section">
  <div class="section-title">Despesas (${bills.length})</div>
  <table>
    <thead><tr><th>Status</th><th>Descrição</th><th>Centro de Custo</th><th>Classificação</th><th>Vencimento</th><th>Dt. Pagamento</th><th>Fonte Pagadora</th><th class="right">Valor</th></tr></thead>
    <tbody>
      ${bills.map(b => `
      <tr>
        <td><span class="badge badge-${b.status}">${STATUS_LABELS[b.status]}</span></td>
        <td>${b.item}</td>
        <td>${(b.cost_centers as any)?.name || '—'}</td>
        <td>${CLASS_LABELS[b.classification]}</td>
        <td>${formatDate(b.due_date)}</td>
        <td>${b.payment_date ? formatDate(b.payment_date) : '—'}</td>
        <td>${(b.payment_sources as any)?.name || b.external_payment_description || '—'}</td>
        <td class="right ${b.status === 'pago' ? 'green' : 'value-expense'}">${formatCurrency(b.amount)}</td>
      </tr>`).join('')}
      <tr class="total-row"><td colspan="7">Total de Despesas</td><td class="right value-expense">${formatCurrency(totalBills)}</td></tr>
    </tbody>
  </table>
</div>` : ''}

<div class="footer">
  <span>Sistema Financeiro — Relatório gerado automaticamente</span>
  <span>${periodLabel}</span>
</div>
<script>window.onload=function(){window.print()}</script>
</body>
</html>`);
    pw.document.close();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Relatórios</h1>
          <p className="text-slate-500 mt-1">Análise detalhada de receitas e despesas</p>
        </div>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors font-medium"
        >
          <FileDown size={16} />
          Exportar PDF
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-slate-600" />
          <h2 className="font-semibold text-slate-800">Filtros</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Data inicial</label>
            <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Data final</label>
            <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Centro de Custo</label>
            <select value={filters.costCenterId} onChange={e => setFilters(f => ({ ...f, costCenterId: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todos</option>
              {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fonte Pagadora</label>
            <select value={filters.paymentSourceId} onChange={e => setFilters(f => ({ ...f, paymentSourceId: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas</option>
              <option value="__none__">Sem fonte (pessoal)</option>
              {paymentSources.map(ps => <option key={ps.id} value={ps.id}>{ps.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Classificação</label>
            <select value={filters.classification} onChange={e => setFilters(f => ({ ...f, classification: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas</option>
              <option value="fixo">Fixo</option>
              <option value="fixo_variavel">Fixo Variável</option>
              <option value="extra">Extra</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
            <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value as any }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">Todos</option>
              <option value="bills">Despesas</option>
              <option value="income">Entradas</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Busca por item</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                placeholder="Buscar..."
                className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <TrendingUp size={16} className="text-emerald-500" />
            <span className="text-xs text-slate-500">Total Entradas</span>
          </div>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{entries.length} lançamento(s)</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <TrendingDown size={16} className="text-red-500" />
            <span className="text-xs text-slate-500">Total Despesas</span>
          </div>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalBills)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{bills.length} conta(s) · {formatCurrency(totalPaid)} pago</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <FileBarChart size={16} className="text-blue-500" />
            <span className="text-xs text-slate-500">Resultado</span>
          </div>
          <p className={`text-xl font-bold ${totalIncome - totalBills >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            {formatCurrency(totalIncome - totalBills)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Carregando...</div>
      ) : (
        <div className="space-y-4">
          {/* Entries table */}
          {filters.type !== 'bills' && entries.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
                <TrendingUp size={18} className="text-emerald-600" />
                <h3 className="font-semibold text-slate-800">Entradas ({entries.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Descrição</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Valor</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Data</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Origem</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Ref. Mês</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {entries.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-800">{e.description}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCurrency(e.amount)}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(e.date)}</td>
                        <td className="px-4 py-3 text-slate-500">{e.origin || '—'}</td>
                        <td className="px-4 py-3 text-slate-400 text-sm">{e.reference_month}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bills table */}
          {filters.type !== 'income' && bills.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
                <TrendingDown size={18} className="text-red-600" />
                <h3 className="font-semibold text-slate-800">Despesas ({bills.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Item</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Valor</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Vencimento</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Dt. Pagamento</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Centro de Custo</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Fonte Pagadora</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Classificação</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Ref. Mês</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {bills.map(b => (
                      <tr key={b.id} className={`hover:bg-slate-50 ${b.status === 'pago' ? 'bg-emerald-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[b.status]}`}>
                            {STATUS_LABELS[b.status]}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-medium ${b.status === 'pago' ? 'text-emerald-700' : 'text-slate-800'}`}>{b.item}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${b.status === 'pago' ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(b.amount)}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(b.due_date)}</td>
                        <td className="px-4 py-3 text-emerald-600 font-medium">{b.payment_date ? formatDate(b.payment_date) : '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{(b.cost_centers as any)?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{(b.payment_sources as any)?.name || b.external_payment_description || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{CLASS_LABELS[b.classification]}</td>
                        <td className="px-4 py-3 text-slate-400 text-sm">{b.reference_month}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {bills.length === 0 && entries.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <FileBarChart size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Nenhum resultado encontrado com os filtros aplicados.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
