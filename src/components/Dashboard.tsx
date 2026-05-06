import { useState, useEffect, useCallback } from 'react';
import { supabase, formatCurrency, formatMonth, getCurrentMonth, computeStatus } from '../lib/supabase';
import { Pencil, Check, X, ChevronRight, TrendingUp, TrendingDown, Wallet, DollarSign, AlertCircle } from 'lucide-react';
import MonthDetail from './MonthDetail';

interface MonthData {
  month: string;
  initialBalance: number;
  income: number;
  expenses: number;
  finalBalance: number;
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
  // Add next month
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

    const [{ data: balancesData }, { data: billsData }, { data: entriesData }, { data: pendingBills }] = await Promise.all([
      supabase.from('monthly_balances').select('*').in('reference_month', months),
      supabase.from('bills').select('amount, reference_month, due_date, status, external_payment').in('reference_month', months),
      supabase.from('income_entries').select('amount, reference_month').in('reference_month', months),
      supabase.from('bills').select('amount, due_date, status').neq('status', 'pago'),
    ]);

    // Projeção: todas as contas pendentes (independente de external_payment)
    const pendingTotal = (pendingBills || []).reduce((sum, b) => {
      const s = computeStatus(b.due_date, b.status);
      return s !== 'pago' ? sum + b.amount : sum;
    }, 0);
    setPendingProjection(pendingTotal);

    const balancesMap: Record<string, number> = {};
    (balancesData || []).forEach(b => { balancesMap[b.reference_month] = b.initial_balance; });

    const incomeMap: Record<string, number> = {};
    (entriesData || []).forEach(e => {
      incomeMap[e.reference_month] = (incomeMap[e.reference_month] || 0) + e.amount;
    });

    // expensesMap: apenas contas pagas e NÃO externas (afetam saldo)
    const expensesMap: Record<string, number> = {};
    (billsData || []).forEach(b => {
      const s = computeStatus(b.due_date, b.status);
      if (s === 'pago' && !b.external_payment) {
        expensesMap[b.reference_month] = (expensesMap[b.reference_month] || 0) + b.amount;
      }
    });

    // Track which months have any entries (bills or income)
    const monthsWithEntries = new Set<string>();
    (billsData || []).forEach(b => monthsWithEntries.add(b.reference_month));
    (entriesData || []).forEach(e => monthsWithEntries.add(e.reference_month));

    // Build months data: first month uses stored initial, subsequent months use previous final
    const result: MonthData[] = [];
    let prevFinal: number | null = null;

    for (const month of months) {
      let initialBalance: number;
      if (prevFinal !== null) {
        // Check if stored balance differs from computed; if it's been manually set, respect it
        const stored = balancesMap[month];
        // Always propagate previous final if no manual override
        if (stored !== undefined && stored !== 0) {
          initialBalance = stored;
        } else {
          initialBalance = prevFinal;
          // Auto-save if not already stored
          if (stored === undefined) {
            supabase.from('monthly_balances').upsert({ reference_month: month, initial_balance: prevFinal }, { onConflict: 'reference_month' });
          }
        }
      } else {
        initialBalance = balancesMap[month] ?? 0;
      }

      const income = incomeMap[month] || 0;
      const expenses = expensesMap[month] || 0;
      const finalBalance = initialBalance + income - expenses;

      result.push({ month, initialBalance, income, expenses, finalBalance });
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Visão geral financeira</p>
      </div>

      {/* Current Month Hero */}
      {current && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
          <p className="text-slate-400 text-sm font-medium mb-4">{formatMonth(current.month)} — Mês Atual</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={16} className="text-slate-300" />
                <span className="text-xs text-slate-300">Saldo Inicial</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold">{formatCurrency(current.initialBalance)}</p>
                {editingInitial === current.month ? (
                  <div className="flex items-center gap-1 ml-2">
                    <input
                      type="number"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="w-24 bg-white/20 text-white text-sm border border-white/30 rounded px-2 py-1 focus:outline-none"
                      autoFocus
                    />
                    <button onClick={() => saveInitialBalance(current.month, parseFloat(editValue) || 0)} className="p-1 bg-emerald-500 rounded hover:bg-emerald-600 transition-colors">
                      <Check size={12} />
                    </button>
                    <button onClick={() => setEditingInitial(null)} className="p-1 bg-white/20 rounded hover:bg-white/30 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setEditingInitial(current.month); setEditValue(String(current.initialBalance)); }} className="p-1 text-slate-400 hover:text-white transition-colors">
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="bg-emerald-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-emerald-300" />
                <span className="text-xs text-emerald-300">Entradas</span>
              </div>
              <p className="text-xl font-bold text-emerald-300">{formatCurrency(current.income)}</p>
            </div>
            <div className="bg-red-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown size={16} className="text-red-300" />
                <span className="text-xs text-red-300">Despesas Pagas</span>
              </div>
              <p className="text-xl font-bold text-red-300">{formatCurrency(current.expenses)}</p>
            </div>
            <div className="bg-amber-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={16} className="text-amber-300" />
                <span className="text-xs text-amber-300">Projeção de Despesas</span>
              </div>
              <p className="text-xl font-bold text-amber-300">{formatCurrency(pendingProjection)}</p>
            </div>
            <div className={`rounded-xl p-4 ${current.finalBalance >= 0 ? 'bg-blue-500/20' : 'bg-orange-500/20'}`}>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={16} className={current.finalBalance >= 0 ? 'text-blue-300' : 'text-orange-300'} />
                <span className={`text-xs ${current.finalBalance >= 0 ? 'text-blue-300' : 'text-orange-300'}`}>Saldo Final</span>
              </div>
              <p className={`text-xl font-bold ${current.finalBalance >= 0 ? 'text-blue-300' : 'text-orange-300'}`}>{formatCurrency(current.finalBalance)}</p>
            </div>
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
                      <p className="text-xs text-slate-400 mb-0.5">Despesas</p>
                      <p className="font-semibold text-red-600 text-sm">{formatCurrency(md.expenses)}</p>
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
