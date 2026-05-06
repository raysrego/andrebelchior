import { useState, useEffect, useCallback } from 'react';
import { supabase, Bill, IncomeEntry, CostCenter, formatCurrency, formatDate, computeStatus } from '../lib/supabase';
import { Search, Filter, FileBarChart, TrendingUp, TrendingDown } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    costCenterId: '',
    classification: '',
    search: '',
    type: 'all' as 'all' | 'bills' | 'income',
  });

  useEffect(() => {
    supabase.from('cost_centers').select('*').order('name').then(({ data }) => setCostCenters(data || []));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);

    let billsQuery = supabase.from('bills').select('*, cost_centers(id, name)');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Relatórios</h1>
        <p className="text-slate-500 mt-1">Análise detalhada de receitas e despesas</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-slate-600" />
          <h2 className="font-semibold text-slate-800">Filtros</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
          <div>
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
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Centro de Custo</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Classificação</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Ref. Mês</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {bills.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[b.status]}`}>
                            {STATUS_LABELS[b.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-800">{b.item}</td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(b.amount)}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(b.due_date)}</td>
                        <td className="px-4 py-3 text-slate-500">{(b.cost_centers as any)?.name || '—'}</td>
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
