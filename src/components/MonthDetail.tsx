import { useState, useEffect } from 'react';
import { supabase, Bill, IncomeEntry, formatCurrency, formatDate, formatMonth, computeStatus } from '../lib/supabase';
import { X, TrendingUp, TrendingDown, FileDown, ExternalLink, Wallet, DollarSign, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  month: string;
  initialBalance: number;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-700',
  pago: 'bg-emerald-100 text-emerald-700',
  vencido: 'bg-red-100 text-red-700',
};
const STATUS_LABELS: Record<string, string> = { aberto: 'Aberto', pago: 'Pago', vencido: 'Vencido' };

const MONTHS_LABELS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function prevMonthStr(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function nextMonthStr(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

export default function MonthDetail({ month: initialMonth, initialBalance: initialBalanceProp, onClose }: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [initialBalance, setInitialBalance] = useState(initialBalanceProp);
  const [bills, setBills] = useState<Bill[]>([]);
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [tab, setTab] = useState<'overview' | 'income' | 'bills'>('overview');
  const [loading, setLoading] = useState(true);
  const [filterCostCenter, setFilterCostCenter] = useState('');
  const [filterPaymentSource, setFilterPaymentSource] = useState('');
  const [costCenters, setCostCenters] = useState<{ id: string; name: string }[]>([]);
  const [paymentSources, setPaymentSources] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from('cost_centers').select('id, name').order('name').then(({ data }) => setCostCenters(data || []));
    supabase.from('payment_sources').select('id, name').order('name').then(({ data }) => setPaymentSources(data || []));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: billsData }, { data: entriesData }, { data: balanceData }] = await Promise.all([
        supabase.from('bills').select('*, cost_centers(id, name), payment_sources(id, name)').eq('reference_month', month).order('due_date'),
        supabase.from('income_entries').select('*').eq('reference_month', month).order('date'),
        supabase.from('monthly_balances').select('initial_balance').eq('reference_month', month).maybeSingle(),
      ]);
      setBills((billsData || []).map(b => ({ ...b, status: computeStatus(b.due_date, b.status) })) as Bill[]);
      setEntries(entriesData || []);
      if (balanceData) setInitialBalance(balanceData.initial_balance);
      setLoading(false);
    }
    load();
  }, [month]);

  const totalIncome = entries.reduce((s, e) => s + e.amount, 0);

  // Personal: paid, non-external
  const personalPaid = bills.filter(b => b.status === 'pago' && !b.external_payment).reduce((s, b) => s + b.amount, 0);
  const finalBalance = initialBalance + totalIncome - personalPaid;

  // External by source
  const sourceBreakdown: Record<string, { name: string; amount: number }> = {};
  bills.filter(b => b.status === 'pago' && b.external_payment).forEach(b => {
    const sid = b.payment_source_id || '__unknown__';
    const sname = (b.payment_sources as any)?.name || 'Sem fonte';
    if (!sourceBreakdown[sid]) sourceBreakdown[sid] = { name: sname, amount: 0 };
    sourceBreakdown[sid].amount += b.amount;
  });
  const externalPaid = Object.values(sourceBreakdown).reduce((s, v) => s + v.amount, 0);
  const totalPaidGeneral = personalPaid + externalPaid;

  // Filtered bills for table
  let filteredBills = bills;
  if (filterCostCenter) filteredBills = filteredBills.filter(b => b.cost_center_id === filterCostCenter);
  if (filterPaymentSource) {
    if (filterPaymentSource === '__none__') filteredBills = filteredBills.filter(b => !b.payment_source_id);
    else filteredBills = filteredBills.filter(b => b.payment_source_id === filterPaymentSource);
  }

  function handleExportPDF() {
    const [y, m] = month.split('-').map(Number);
    const monthLabel = `${MONTHS_LABELS[m - 1]} ${y}`;
    const genDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    const pw = window.open('', '_blank', 'width=850,height=700');
    if (!pw) return;

    pw.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Relatório Contábil — ${monthLabel}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;background:#fff;padding:36px}
  .header{border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}
  .header-left h1{font-size:18px;font-weight:700;color:#0f172a}
  .header-left p{font-size:11px;color:#64748b;margin-top:2px}
  .header-right{text-align:right;font-size:11px;color:#64748b}
  .section{margin-bottom:22px}
  .section-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#475569;border-bottom:1px solid #e2e8f0;padding-bottom:5px;margin-bottom:10px}
  .balance-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
  .balance-card{border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px}
  .balance-card .label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px}
  .balance-card .value{font-size:15px;font-weight:700}
  .value-income{color:#059669}
  .value-expense{color:#dc2626}
  .value-balance{color:#1d4ed8}
  .value-neutral{color:#1e293b}
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
  .ext-badge{background:#fef3c7;color:#92400e;display:inline-block;padding:1px 6px;border-radius:99px;font-size:10px;margin-left:4px}
  .footer{margin-top:28px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}
  .green{color:#059669}
  @media print{body{padding:20px}}
</style>
</head>
<body>
<div class="header">
  <div class="header-left">
    <h1>Relatório Contábil Mensal</h1>
    <p>${monthLabel}</p>
  </div>
  <div class="header-right">
    <p>Emitido em ${genDate}</p>
  </div>
</div>

<div class="balance-grid">
  <div class="balance-card"><div class="label">Saldo Inicial</div><div class="value value-neutral">${formatCurrency(initialBalance)}</div></div>
  <div class="balance-card"><div class="label">Total Entradas</div><div class="value value-income">${formatCurrency(totalIncome)}</div></div>
  <div class="balance-card"><div class="label">Despesas Pagas Geral</div><div class="value value-expense">${formatCurrency(totalPaidGeneral)}</div></div>
  <div class="balance-card"><div class="label">Saldo Final</div><div class="value value-balance" style="color:${finalBalance >= 0 ? '#1d4ed8' : '#ea580c'}">${formatCurrency(finalBalance)}</div></div>
</div>

${Object.keys(sourceBreakdown).length > 0 ? `
<div class="section">
  <div class="section-title">Despesas por Fonte Pagadora</div>
  <table>
    <thead><tr><th>Fonte Pagadora</th><th class="right">Total Pago</th></tr></thead>
    <tbody>
      <tr><td>Conta Pessoal</td><td class="right value-expense">${formatCurrency(personalPaid)}</td></tr>
      ${Object.values(sourceBreakdown).map(s => `<tr><td>${s.name}</td><td class="right value-expense">${formatCurrency(s.amount)}</td></tr>`).join('')}
      <tr class="total-row"><td>Total</td><td class="right value-expense">${formatCurrency(totalPaidGeneral)}</td></tr>
    </tbody>
  </table>
</div>` : ''}

${entries.length > 0 ? `
<div class="section">
  <div class="section-title">Entradas</div>
  <table>
    <thead><tr><th>Descrição</th><th>Origem</th><th>Data</th><th class="right">Valor</th></tr></thead>
    <tbody>
      ${entries.map(e => `<tr><td>${e.description}</td><td>${e.origin || '—'}</td><td>${formatDate(e.date)}</td><td class="right value-income">${formatCurrency(e.amount)}</td></tr>`).join('')}
      <tr class="total-row"><td colspan="3">Total de Entradas</td><td class="right value-income">${formatCurrency(totalIncome)}</td></tr>
    </tbody>
  </table>
</div>` : ''}

${bills.length > 0 ? `
<div class="section">
  <div class="section-title">Despesas</div>
  <table>
    <thead><tr><th>Status</th><th>Descrição</th><th>Vencimento</th><th>Dt. Pagamento</th><th>Centro de Custo</th><th class="right">Valor</th></tr></thead>
    <tbody>
      ${bills.map(b => `
      <tr>
        <td><span class="badge badge-${b.status}">${STATUS_LABELS[b.status]}</span></td>
        <td>${b.item}${b.external_payment ? `<span class="ext-badge">${(b.payment_sources as any)?.name || b.external_payment_description || 'Ext.'}</span>` : ''}</td>
        <td>${formatDate(b.due_date)}</td>
        <td>${b.payment_date ? formatDate(b.payment_date) : '—'}</td>
        <td>${(b.cost_centers as any)?.name || '—'}</td>
        <td class="right ${b.status === 'pago' ? 'green' : 'value-expense'}">${formatCurrency(b.amount)}</td>
      </tr>`).join('')}
      <tr class="total-row"><td colspan="5">Total de Despesas</td><td class="right value-expense">${formatCurrency(bills.reduce((s,b)=>s+b.amount,0))}</td></tr>
    </tbody>
  </table>
</div>` : ''}

<div class="footer">
  <span>Sistema Financeiro — Relatório gerado automaticamente</span>
  <span>${monthLabel}</span>
</div>
<script>window.onload=function(){window.print()}</script>
</body>
</html>`);
    pw.document.close();
  }

  const [y, m] = month.split('-').map(Number);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-4xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMonth(prevMonthStr(month))} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronLeft size={18} className="text-slate-600" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{MONTHS_LABELS[m - 1]} {y}</h2>
              <p className="text-xs text-slate-500">Detalhamento do mês</p>
            </div>
            <button onClick={() => setMonth(nextMonthStr(month))} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronRight size={18} className="text-slate-600" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors">
              <FileDown size={14} />
              <span className="hidden sm:inline">Exportar PDF</span>
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 sm:px-6 py-3 border-b border-slate-100 flex-shrink-0 overflow-x-auto">
          {(['overview', 'income', 'bills'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === t ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {t === 'overview' ? 'Resumo' : t === 'income' ? 'Entradas' : 'Despesas'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-5">
          {loading ? <div className="text-center py-8 text-slate-400">Carregando...</div> : (
            <>
              {/* OVERVIEW TAB */}
              {tab === 'overview' && (
                <div className="space-y-4">
                  {/* Central highlight cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-amber-500 rounded-xl p-4 text-white text-center">
                      <p className="text-xs text-amber-100 mb-1">Projeção de Despesas</p>
                      <p className="text-2xl font-bold">{formatCurrency(bills.filter(b => b.status !== 'pago').reduce((s,b)=>s+b.amount,0))}</p>
                      <p className="text-xs text-amber-200 mt-0.5">Contas ainda não pagas</p>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-4 text-white text-center">
                      <p className="text-xs text-slate-300 mb-1">Despesas Pagas Geral</p>
                      <p className="text-2xl font-bold">{formatCurrency(totalPaidGeneral)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Pessoal + Outras Fontes</p>
                    </div>
                  </div>

                  {/* Movimentações Conta Pessoal */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Movimentações Conta Pessoal</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Wallet size={13} className="text-slate-500" />
                          <span className="text-xs text-slate-500">Saldo Inicial</span>
                        </div>
                        <p className="text-base font-bold text-slate-800">{formatCurrency(initialBalance)}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingUp size={13} className="text-emerald-600" />
                          <span className="text-xs text-emerald-600">Entradas</span>
                        </div>
                        <p className="text-base font-bold text-emerald-700">{formatCurrency(totalIncome)}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingDown size={13} className="text-red-600" />
                          <span className="text-xs text-red-600">Despesas Pagas</span>
                        </div>
                        <p className="text-base font-bold text-red-700">{formatCurrency(personalPaid)}</p>
                      </div>
                      <div className={`rounded-lg p-3 ${finalBalance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <DollarSign size={13} className={finalBalance >= 0 ? 'text-blue-600' : 'text-orange-600'} />
                          <span className={`text-xs ${finalBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo Final</span>
                        </div>
                        <p className={`text-base font-bold ${finalBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{formatCurrency(finalBalance)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Movimentações Outras Fontes */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Movimentações Outras Fontes Pagadoras</p>
                    {Object.keys(sourceBreakdown).length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-3">Nenhuma despesa com fonte pagadora neste mês.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Object.values(sourceBreakdown).map(({ name, amount }) => (
                          <div key={name} className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <CreditCard size={13} className="text-amber-600" />
                              <span className="text-xs text-amber-700 font-medium truncate">{name}</span>
                            </div>
                            <p className="text-xs text-amber-600 mb-0.5">Despesas Pagas</p>
                            <p className="text-base font-bold text-amber-700">{formatCurrency(amount)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* INCOME TAB */}
              {tab === 'income' && (
                <div>
                  {entries.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">Nenhuma entrada neste mês.</p>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Descrição</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Valor</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Data</th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase hidden sm:table-cell">Origem</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {entries.map(e => (
                              <tr key={e.id} className="hover:bg-slate-50">
                                <td className="px-4 py-2.5 text-slate-800 text-sm">{e.description}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-emerald-600 text-sm">{formatCurrency(e.amount)}</td>
                                <td className="px-4 py-2.5 text-slate-500 text-sm">{formatDate(e.date)}</td>
                                <td className="px-4 py-2.5 text-slate-500 text-sm hidden sm:table-cell">{e.origin || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* BILLS TAB */}
              {tab === 'bills' && (
                <div className="space-y-3">
                  {/* Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  </div>

                  {filteredBills.length === 0 ? (
                    <p className="text-center py-8 text-slate-400">Nenhuma despesa encontrada.</p>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Item</th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Vencimento</th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Dt. Pagamento</th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Valor</th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase hidden sm:table-cell">C. Custo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {filteredBills.map(b => (
                              <tr key={b.id} className={`hover:bg-slate-50 ${b.status === 'pago' ? 'bg-emerald-50/30' : ''}`}>
                                <td className="px-3 py-2.5">
                                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[b.status]}`}>
                                    {STATUS_LABELS[b.status]}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-sm ${b.status === 'pago' ? 'text-emerald-700 font-medium' : 'text-slate-800'}`}>{b.item}</span>
                                    {b.external_payment && (
                                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                        <ExternalLink size={9} />
                                        {(b.payment_sources as any)?.name || 'Externo'}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-slate-500 text-sm">{formatDate(b.due_date)}</td>
                                <td className="px-3 py-2.5 text-emerald-600 text-sm font-medium">{b.payment_date ? formatDate(b.payment_date) : '—'}</td>
                                <td className={`px-3 py-2.5 text-right font-semibold text-sm ${b.status === 'pago' ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(b.amount)}</td>
                                <td className="px-3 py-2.5 text-slate-500 text-sm hidden sm:table-cell">{(b.cost_centers as any)?.name || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
