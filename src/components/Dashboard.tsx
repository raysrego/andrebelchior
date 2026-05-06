import { useState, useEffect, useCallback } from 'react';
import { supabase, formatCurrency, formatMonth, getCurrentMonth, computeStatus } from '../lib/supabase';
import { Pencil, Check, X, ChevronRight, TrendingUp, TrendingDown, Wallet, DollarSign, AlertCircle, CreditCard } from 'lucide-react';
import MonthDetail from './MonthDetail';

interface MonthData {
  month: string;
  initialBalance: number;
  income: number;
  personalExpenses: number;  // paid, non-external (affects balance)
  externalExpenses: number;  // paid, external (all sources combined)
  finalBalance: number;
  sourceBreakdown: Record<string, { name: string; amount: number }>;
}

function getMonthsRange(): string[] {
  const current = getCurrentMonth();
  const [cy, cm] = current.split('-').map(Number);
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    let m = cm - i;
    let y = cy;
    while (m <= 0) { m += 12; y -= 1; }
    months.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  let nm = cm + 1, ny = cy;
  if (nm > 12) { nm = 1; ny += 1; }
  months.push(`${ny}-${String(nm).padStart(2, '0')}`);
  return months;
}

export default function Dashboard() {
  const [monthsData, setMonthsData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingInitial, setEditingInitial] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [detailMonth, setDetailMonth] = useState<string | null>(null);
  const [pendingProjection, setPendingProjection] = useState(0);
  const currentMonth = getCurrentMonth();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const months = getMonthsRange();

    const [
      { data: balancesData },
      { data: billsData },
      { data: entriesData },
      { data: pendingBills },
      { data: sourcesData },
    ] = await Promise.all([
      supabase.from('monthly_balances').select('*').in('reference_month', months),
      supabase.from('bills').select('amount, reference_month, due_date, status, external_payment, payment_source_id').in('reference_month', months),
      supabase.from('income_entries').select('amount, reference_month').in('reference_month', months),
      supabase.from('bills').select('amount, due_date, status').neq('status', 'pago'),
      supabase.from('payment_sources').select('id, name'),
    ]);

    const pendingTotal = (pendingBills || []).reduce((sum, b) => {
      const s = computeStatus(b.due_date, b.status);
      return s !== 'pago' ? sum + b.amount : sum;
    }, 0);
    setPendingProjection(pendingTotal);

    const sourcesMap: Record<string, string> = {};
    (sourcesData || []).forEach(s => { sourcesMap[s.id] = s.name; });

    const balancesMap: Record<string, number> = {};
    (balancesData || []).forEach(b => { balancesMap[b.reference_month] = b.initial_balance; });

    const incomeMap: Record<string, number> = {};
    (entriesData || []).forEach(e => {
      incomeMap[e.reference_month] = (incomeMap[e.reference_month] || 0) + e.amount;
    });

    // personalExpensesMap: paid, NOT external
    const personalExpensesMap: Record<string, number> = {};
    // externalExpensesMap: paid, external (all sources combined)
    const externalExpensesMap: Record<string, number> = {};
    // sourceBreakdownMap: per month, per source_id
    const sourceBreakdownMap: Record<string, Record<string, number>> = {};

    (billsData || []).forEach(b => {
      const s = computeStatus(b.due_date, b.status);
      if (s !== 'pago') return;
      if (!b.external_payment) {
        personalExpensesMap[b.reference_month] = (personalExpensesMap[b.reference_month] || 0) + b.amount;
      } else {
        externalExpensesMap[b.reference_month] = (externalExpensesMap[b.reference_month] || 0) + b.amount;
        if (b.payment_source_id) {
          if (!sourceBreakdownMap[b.reference_month]) sourceBreakdownMap[b.reference_month] = {};
          sourceBreakdownMap[b.reference_month][b.payment_source_id] =
            (sourceBreakdownMap[b.reference_month][b.payment_source_id] || 0) + b.amount;
        }
      }
    });

    const monthsWithEntries = new Set<string>();
    (billsData || []).forEach(b => monthsWithEntries.add(b.reference_month));
    (entriesData || []).forEach(e => monthsWithEntries.add(e.reference_month));

    const result: MonthData[] = [];
    let prevFinal: number | null = null;

    for (const month of months) {
      let initialBalance: number;
      if (prevFinal !== null) {
        const stored = balancesMap[month];
        if (stored !== undefined && stored !== 0) {
          initialBalance = stored;
        } else {
          initialBalance = prevFinal;
          if (stored === undefined) {
            supabase.from('monthly_balances').upsert({ reference_month: month, initial_balance: prevFinal }, { onConflict: 'reference_month' });
          }
        }
      } else {
        initialBalance = balancesMap[month] ?? 0;
      }

      const income = incomeMap[month] || 0;
      const personalExpenses = personalExpensesMap[month] || 0;
      const externalExpenses = externalExpensesMap[month] || 0;
      const finalBalance = initialBalance + income - personalExpenses;

      // Build source breakdown with names
      const rawBreakdown = sourceBreakdownMap[month] || {};
      const sourceBreakdown: Record<string, { name: string; amount: number }> = {};
      Object.entries(rawBreakdown).forEach(([sourceId, amount]) => {
        sourceBreakdown[sourceId] = { name: sourcesMap[sourceId] || 'Fonte desconhecida', amount };
      });

      result.push({ month, initialBalance, income, personalExpenses, externalExpenses, finalBalance, sourceBreakdown });
      prevFinal = finalBalance;
    }

    const filtered = result.filter(md => monthsWithEntries.has(md.month) || md.month === currentMonth);
    setMonthsData(filtered);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function saveInitialBalance(month: string, value: number) {
    await supabase.from('monthly_balances').upsert({ reference_month: month, initial_balance: value, updated_at: new Date().toISOString() }, { onConflict: 'reference_month' });
    setEditingInitial(null);
    fetchData();
  }

  const current = monthsData.find(m => m.month === currentMonth);
  const totalPaidGeneral = current ? current.personalExpenses + current.externalExpenses : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Visão geral financeira</p>
      </div>

      {/* Central highlight cards */}
      {current && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-amber-500 rounded-2xl p-6 text-white flex flex-col items-center justify-center text-center shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={20} className="text-amber-100" />
              <span className="text-sm font-medium text-amber-100">Projeção de Despesas</span>
            </div>
            <p className="text-3xl font-bold">{formatCurrency(pendingProjection)}</p>
            <p className="text-xs text-amber-200 mt-1">Contas pendentes (todos os meses)</p>
          </div>
          <div className="bg-slate-800 rounded-2xl p-6 text-white flex flex-col items-center justify-center text-center shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={20} className="text-slate-300" />
              <span className="text-sm font-medium text-slate-300">Despesas Pagas Geral</span>
            </div>
            <p className="text-3xl font-bold">{formatCurrency(totalPaidGeneral)}</p>
            <p className="text-xs text-slate-400 mt-1">{formatMonth(current.month)} — Pessoal + Outras Fontes</p>
          </div>
        </div>
      )}

      {/* Current month breakdown */}
      {current && (
        <div className="space-y-4">
          {/* Row 1: Movimentações Conta Pessoal */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Movimentações Conta Pessoal — {formatMonth(current.month)}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet size={16} className="text-slate-500" />
                  <span className="text-xs text-slate-500">Saldo Inicial</span>
                </div>
                <div className="flex items-center gap-1">
                  <p className="text-lg font-bold text-slate-800">{formatCurrency(current.initialBalance)}</p>
                  {editingInitial === current.month ? (
                    <div className="flex items-center gap-1 ml-1">
                      <input
                        type="number"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="w-20 text-xs border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <button onClick={() => saveInitialBalance(current.month, parseFloat(editValue) || 0)} className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors">
                        <Check size={10} />
                      </button>
                      <button onClick={() => setEditingInitial(null)} className="p-1 border border-slate-300 rounded hover:bg-slate-50 transition-colors">
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingInitial(current.month); setEditValue(String(current.initialBalance)); }} className="p-1 text-slate-300 hover:text-blue-500 transition-colors">
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-emerald-600" />
                  <span className="text-xs text-emerald-600">Entradas</span>
                </div>
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(current.income)}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown size={16} className="text-red-600" />
                  <span className="text-xs text-red-600">Despesas Pagas</span>
                </div>
                <p className="text-lg font-bold text-red-700">{formatCurrency(current.personalExpenses)}</p>
              </div>
              <div className={`rounded-xl p-4 ${current.finalBalance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={16} className={current.finalBalance >= 0 ? 'text-blue-600' : 'text-orange-600'} />
                  <span className={`text-xs ${current.finalBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo Final</span>
                </div>
                <p className={`text-lg font-bold ${current.finalBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{formatCurrency(current.finalBalance)}</p>
              </div>
            </div>
          </div>

          {/* Row 2: Movimentações Outras Fontes Pagadoras */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Movimentações Outras Fontes Pagadoras — {formatMonth(current.month)}</p>
            {Object.keys(current.sourceBreakdown).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Nenhuma despesa registrada com fonte pagadora neste mês.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.values(current.sourceBreakdown).map(({ name, amount }) => (
                  <div key={name} className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard size={16} className="text-amber-600" />
                      <span className="text-xs text-amber-700 font-medium truncate">{name}</span>
                    </div>
                    <p className="text-xs text-amber-600 mb-0.5">Despesas Pagas</p>
                    <p className="text-lg font-bold text-amber-700">{formatCurrency(amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Monthly History */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Histórico Mensal</h2>
        {loading ? (
          <div className="text-center py-12 text-slate-400">Carregando...</div>
        ) : (
          <div className="space-y-2">
            {monthsData.map(md => (
              <div
                key={md.month}
                className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer group ${md.month === currentMonth ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'}`}
                onClick={() => setDetailMonth(md.month)}
              >
                <div className="flex items-center px-6 py-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{formatMonth(md.month)}</span>
                      {md.month === currentMonth && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Atual</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-8 text-right">
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Saldo Inicial</p>
                      <div className="flex items-center justify-end gap-1">
                        <p className="font-semibold text-slate-700 text-sm">{formatCurrency(md.initialBalance)}</p>
                        <button
                          onClick={e => { e.stopPropagation(); setEditingInitial(md.month); setEditValue(String(md.initialBalance)); }}
                          className="p-1 text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                      {editingInitial === md.month && (
                        <div className="flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
                          <input
                            type="number"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="w-24 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <button onClick={() => saveInitialBalance(md.month, parseFloat(editValue) || 0)} className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors">
                            <Check size={10} />
                          </button>
                          <button onClick={() => setEditingInitial(null)} className="p-1 border border-slate-300 text-slate-500 rounded hover:bg-slate-50 transition-colors">
                            <X size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Entradas</p>
                      <p className="font-semibold text-emerald-600 text-sm">{formatCurrency(md.income)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Despesas Pagas</p>
                      <p className="font-semibold text-red-600 text-sm">{formatCurrency(md.personalExpenses + md.externalExpenses)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Saldo Final</p>
                      <p className={`font-bold text-sm ${md.finalBalance >= 0 ? 'text-slate-800' : 'text-orange-600'}`}>{formatCurrency(md.finalBalance)}</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 ml-4 transition-colors flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {detailMonth && (
        <MonthDetail
          month={detailMonth}
          initialBalance={monthsData.find(m => m.month === detailMonth)?.initialBalance || 0}
          onClose={() => setDetailMonth(null)}
        />
      )}
    </div>
  );
}
