import { useState, useEffect, useRef } from 'react';
import { supabase, Bill, IncomeEntry, formatCurrency, formatDate, formatMonth, computeStatus } from '../lib/supabase';
import { X, TrendingUp, TrendingDown, FileDown, ExternalLink } from 'lucide-react';

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
  const printRef = useRef<HTMLDivElement>(null);

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
  // Saldo final: descontar apenas contas NÃO externas
  const billsAffectingBalance = bills.filter(b => !b.external_payment).reduce((s, b) => s + b.amount, 0);
  const finalBalance = initialBalance + totalIncome - billsAffectingBalance;

  function handleExportPDF() {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Relatório — ${formatMonth(month)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; background: #fff; padding: 32px; }
    .report-header { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
    .report-header h1 { font-size: 22px; font-weight: 700; color: #0f172a; }
    .report-header p { font-size: 12px; color: #64748b; margin-top: 4px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
    .summary-card .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .summary-card .value { font-size: 17px; font-weight: 700; }
    .summary-card.income .value { color: #059669; }
    .summary-card.expense .value { color: #dc2626; }
    .summary-card.balance .value { color: #1d4ed8; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 14px; font-weight: 700; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f8fafc; }
    th { text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #e2e8f0; }
    th.right { text-align: right; }
    td { padding: 8px 10px; font-size: 12px; color: #334155; border-bottom: 1px solid #f1f5f9; }
    td.right { text-align: right; font-weight: 600; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 500; }
    .badge-pago { background: #d1fae5; color: #065f46; }
    .badge-aberto { background: #dbeafe; color: #1e40af; }
    .badge-vencido { background: #fee2e2; color: #991b1b; }
    .total-row td { font-weight: 700; background: #f8fafc; border-top: 2px solid #e2e8f0; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
    @media print {
      body { padding: 20px; }
      button { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>Relatório Financeiro — ${formatMonth(month)}</h1>
    <p>Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Saldo Inicial</div>
      <div class="value">${formatCurrency(initialBalance)}</div>
    </div>
    <div class="summary-card income">
      <div class="label">Total de Entradas</div>
      <div class="value">${formatCurrency(totalIncome)}</div>
    </div>
    <div class="summary-card expense">
      <div class="label">Total de Despesas</div>
      <div class="value">${formatCurrency(totalBills)}</div>
    </div>
    <div class="summary-card balance">
      <div class="label">Saldo Final</div>
      <div class="value" style="color:${finalBalance >= 0 ? '#1d4ed8' : '#ea580c'}">${formatCurrency(finalBalance)}</div>
    </div>
  </div>

  ${entries.length > 0 ? `
  <div class="section">
    <div class="section-title">Entradas</div>
    <table>
      <thead>
        <tr>
          <th>Descrição</th>
          <th class="right">Valor</th>
          <th>Data</th>
          <th>Origem</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map(e => `
        <tr>
          <td>${e.description}</td>
          <td class="right" style="color:#059669">${formatCurrency(e.amount)}</td>
          <td>${formatDate(e.date)}</td>
          <td>${e.origin || '—'}</td>
        </tr>`).join('')}
        <tr class="total-row">
          <td>Total</td>
          <td class="right" style="color:#059669">${formatCurrency(totalIncome)}</td>
          <td></td><td></td>
        </tr>
      </tbody>
    </table>
  </div>` : ''}

  ${bills.length > 0 ? `
  <div class="section">
    <div class="section-title">Despesas</div>
    <table>
      <thead>
        <tr>
          <th>Status</th>
          <th>Item</th>
          <th class="right">Valor</th>
          <th>Vencimento</th>
          <th>Centro de Custo</th>
        </tr>
      </thead>
      <tbody>
        ${bills.map(b => `
        <tr>
          <td><span class="badge badge-${b.status}">${STATUS_LABELS[b.status]}</span></td>
          <td>${b.item}${b.external_payment ? ` <span class="badge" style="background:#fef3c7;color:#92400e;margin-left:4px">Externo${b.external_payment_description ? ': ' + b.external_payment_description : ''}</span>` : ''}</td>
          <td class="right" style="color:#dc2626">${formatCurrency(b.amount)}</td>
          <td>${formatDate(b.due_date)}</td>
          <td>${(b.cost_centers as any)?.name || '—'}</td>
        </tr>`).join('')}
        <tr class="total-row">
          <td></td>
          <td>Total</td>
          <td class="right" style="color:#dc2626">${formatCurrency(totalBills)}</td>
          <td></td><td></td>
        </tr>
      </tbody>
    </table>
  </div>` : ''}

  <div class="footer">Relatório gerado automaticamente pelo sistema financeiro.</div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
    printWindow.document.close();
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" ref={printRef}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{formatMonth(month)}</h2>
            <p className="text-sm text-slate-500 mt-0.5">Detalhamento do mês</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
            >
              <FileDown size={15} />
              Exportar PDF
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
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
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-800">{b.item}</span>
                                {b.external_payment && (
                                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full" title={b.external_payment_description || 'Pagamento Externo'}>
                                    <ExternalLink size={9} />
                                    Externo
                                  </span>
                                )}
                              </div>
                              {b.external_payment && b.external_payment_description && (
                                <p className="text-xs text-slate-400 mt-0.5">{b.external_payment_description}</p>
                              )}
                            </td>
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
