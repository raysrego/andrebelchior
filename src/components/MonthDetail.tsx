import { useState, useEffect } from 'react';
import { supabase, Bill, IncomeEntry, formatCurrency, formatDate, formatMonth, computeStatus } from '../lib/supabase';
import { X, TrendingUp, TrendingDown } from 'lucide-react';

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

export default function MonthDetail({ month, initialBalance, onClose }: Props) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [tab, setTab] = useState<'all' | 'income' | 'bills'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: billsData }, { data: entriesData }] = await Promise.all([
        supabase.from('bills').select('*, cost_centers(id, name)').eq('reference_month', month).order('due_date'),
        supabase.from('income_entries').select('*').eq('reference_month', month).order('date'),
      ]);
      setBills((billsData || []).map(b => ({ ...b, status: computeStatus(b.due_date, b.status) })) as Bill[]);
      setEntries(entriesData || []);
      setLoading(false);
    }
    load();
  }, [month]);

  const totalIncome = entries.reduce((s, e) => s + e.amount, 0);
  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const finalBalance = initialBalance + totalIncome - totalBills;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{formatMonth(month)}</h2>
            <p className="text-sm text-slate-500 mt-0.5">Detalhamento do mês</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4 p-6 border-b border-slate-100 flex-shrink-0">
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">Saldo Inicial</p>
            <p className="font-bold text-slate-700 text-lg">{formatCurrency(initialBalance)}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 text-center">
            <p className="text-xs text-emerald-600 mb-1">Entradas</p>
            <p className="font-bold text-emerald-700 text-lg">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <p className="text-xs text-red-600 mb-1">Despesas</p>
            <p className="font-bold text-red-700 text-lg">{formatCurrency(totalBills)}</p>
          </div>
          <div className={`rounded-xl p-4 text-center ${finalBalance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
            <p className={`text-xs mb-1 ${finalBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo Final</p>
            <p className={`font-bold text-lg ${finalBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{formatCurrency(finalBalance)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 py-3 border-b border-slate-100 flex-shrink-0">
          {(['all', 'income', 'bills'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {t === 'all' ? 'Todos' : t === 'income' ? 'Entradas' : 'Despesas'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {loading ? <div className="text-center py-8 text-slate-400">Carregando...</div> : (
            <>
              {(tab === 'all' || tab === 'income') && entries.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={18} className="text-emerald-600" />
                    <h3 className="font-semibold text-slate-700">Entradas</h3>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Descrição</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Valor</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Data</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Origem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {entries.map(e => (
                          <tr key={e.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 text-slate-800">{e.description}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{formatCurrency(e.amount)}</td>
                            <td className="px-4 py-2.5 text-slate-500">{formatDate(e.date)}</td>
                            <td className="px-4 py-2.5 text-slate-500">{e.origin || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(tab === 'all' || tab === 'bills') && bills.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown size={18} className="text-red-600" />
                    <h3 className="font-semibold text-slate-700">Despesas</h3>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Item</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Valor</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Vencimento</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Centro de Custo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {bills.map(b => (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[b.status]}`}>
                                {STATUS_LABELS[b.status]}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-800">{b.item}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-red-600">{formatCurrency(b.amount)}</td>
                            <td className="px-4 py-2.5 text-slate-500">{formatDate(b.due_date)}</td>
                            <td className="px-4 py-2.5 text-slate-500">{(b.cost_centers as any)?.name || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'all' && entries.length === 0 && bills.length === 0 && (
                <div className="text-center py-12 text-slate-400">Nenhum lançamento neste mês.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
