import { useState, useEffect, useCallback } from 'react';
import { supabase, Bill, CostCenter, PaymentSource, ColorTag, COLOR_TAGS, COLOR_ROW_STYLES, computeStatus, formatCurrency, formatDate, formatMonth, getCurrentMonth, todayLocal } from '../lib/supabase';
import { Plus, Pencil, Trash2, Copy, ChevronLeft, ChevronRight, FileText, ExternalLink, Bell, Paperclip, AlertTriangle, CopyCheck, Search, FileDown, Tag } from 'lucide-react';
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
  const [filterName, setFilterName] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterColor, setFilterColor] = useState<ColorTag | 'none' | ''>('');
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>([]);
  const [dismissedAlert, setDismissedAlert] = useState(false);
  const [dismissedOverdue, setDismissedOverdue] = useState(false);
  const [replicateMonthConfirm, setReplicateMonthConfirm] = useState(false);
  const [replicatingMonth, setReplicatingMonth] = useState(false);

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
      color_tag: bill.color_tag,
    });
    setReplicateConfirm(null);
    fetchBills();
  }

  async function handleReplicateMonth() {
    setReplicatingMonth(true);
    const nm = nextMonth(month);
    const [y, m] = nm.split('-').map(Number);
    const toReplicate = bills;
    await Promise.all(toReplicate.map(bill => {
      const dueDay = parseInt(bill.due_date.split('-')[2], 10);
      const newDue = `${y}-${String(m).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
      return supabase.from('bills').insert({
        status: 'aberto',
        due_date: newDue,
        item: bill.item,
        amount: bill.amount,
        cost_center_id: bill.cost_center_id,
        classification: bill.classification,
        bank_info: bill.bank_info,
        reference_month: nm,
        external_payment: bill.external_payment,
        external_payment_description: bill.external_payment_description,
        payment_source_id: bill.payment_source_id,
        color_tag: bill.color_tag,
      });
    }));
    setReplicatingMonth(false);
    setReplicateMonthConfirm(false);
    setMonth(nm);
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
  if (filterName) filtered = filtered.filter(b => b.item.toLowerCase().includes(filterName.toLowerCase()));
  if (filterDateFrom) filtered = filtered.filter(b => b.due_date >= filterDateFrom);
  if (filterDateTo) filtered = filtered.filter(b => b.due_date <= filterDateTo);
  if (filterColor) {
    if (filterColor === 'none') filtered = filtered.filter(b => !b.color_tag);
    else filtered = filtered.filter(b => b.color_tag === filterColor);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const total = bills.reduce((s, b) => s + b.amount, 0);
  const paid = bills.filter(b => b.status === 'pago').reduce((s, b) => s + b.amount, 0);
  const pending = bills.filter(b => b.status !== 'pago').reduce((s, b) => s + b.amount, 0);
  const filteredTotal = filtered.reduce((s, b) => s + b.amount, 0);
  const hasActiveFilter = !!(filterName || filterStatus || filterCostCenter || filterPaymentSource || filterDateFrom || filterDateTo || filterColor);

  const today = todayLocal();
  const dueTodayBills = bills.filter(b => b.due_date === today && b.status !== 'pago');
  const overdueBills = bills.filter(b => b.status === 'vencido');

  useEffect(() => { setPage(1); setDismissedAlert(false); setDismissedOverdue(false); }, [month]);
  useEffect(() => { setPage(1); }, [filterStatus, filterCostCenter, filterPaymentSource, filterName, filterDateFrom, filterDateTo, filterColor]);

  function handleExportPDF() {
    const genDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const periodLabel = formatMonth(month);
    const activeFilters: string[] = [];
    if (filterStatus) activeFilters.push(`Status: ${STATUS_LABELS[filterStatus]}`);
    if (filterCostCenter) {
      const cc = costCenters.find(c => c.id === filterCostCenter);
      if (cc) activeFilters.push(`Centro de Custo: ${cc.name}`);
    }
    if (filterPaymentSource) {
      if (filterPaymentSource === '__none__') activeFilters.push('Fonte: Sem fonte (pessoal)');
      else {
        const ps = paymentSources.find(p => p.id === filterPaymentSource);
        if (ps) activeFilters.push(`Fonte: ${ps.name}`);
      }
    }
    if (filterColor) {
      if (filterColor === 'none') activeFilters.push('Cor: Sem cor');
      else {
        const ct = COLOR_TAGS.find(c => c.value === filterColor);
        if (ct) activeFilters.push(`Cor: ${ct.label}`);
      }
    }
    if (filterName) activeFilters.push(`Busca: "${filterName}"`);
    if (filterDateFrom) activeFilters.push(`De: ${formatDate(filterDateFrom)}`);
    if (filterDateTo) activeFilters.push(`Até: ${formatDate(filterDateTo)}`);
    const filtersLabel = activeFilters.length ? activeFilters.join(' · ') : 'Nenhum filtro';

    const rows = filtered.length > 0 ? filtered : bills;

    const pw = window.open('', '_blank', 'width=900,height=700');
    if (!pw) return;

    pw.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Contas a Pagar — ${periodLabel}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;background:#fff;padding:36px}
  .header{border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end}
  .header-left h1{font-size:18px;font-weight:700;color:#0f172a}
  .header-left p{font-size:11px;color:#64748b;margin-top:2px}
  .header-right{text-align:right;font-size:11px;color:#64748b}
  .filters{font-size:11px;color:#64748b;margin-bottom:18px;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px}
  .legend{margin-bottom:18px;font-size:11px;color:#475569}
  .legend-item{display:inline-flex;align-items:center;gap:6px;margin-right:16px}
  .swatch{width:12px;height:12px;border-radius:3px;display:inline-block;border:1px solid #cbd5e1}
  .summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px}
  .summary-card{border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px}
  .summary-card .label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px}
  .summary-card .value{font-size:15px;font-weight:700}
  table{width:100%;border-collapse:collapse}
  thead tr{background:#f8fafc}
  th{text-align:left;padding:7px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;border-bottom:1px solid #e2e8f0}
  th.right{text-align:right}
  td{padding:7px 10px;font-size:11px;border-bottom:1px solid #f1f5f9;color:#334155}
  td.right{text-align:right;font-weight:600}
  .row-orange{background:#ffedd5}
  .row-blue{background:#dbeafe}
  .row-yellow{background:#fef9c3}
  .row-orange td{border-bottom-color:#fed7aa}
  .row-blue td{border-bottom-color:#bfdbfe}
  .row-yellow td{border-bottom-color:#fde68a}
  .row-orange td:first-child{border-left:5px solid #f97316}
  .row-blue td:first-child{border-left:5px solid #3b82f6}
  .row-yellow td:first-child{border-left:5px solid #eab308}
  .row-pad td:first-child{border-left:5px solid transparent}
  .badge{display:inline-block;padding:2px 7px;border-radius:99px;font-size:10px;font-weight:600}
  .badge-pago{background:#d1fae5;color:#065f46}
  .badge-aberto{background:#dbeafe;color:#1e40af}
  .badge-vencido{background:#fee2e2;color:#991b1b}
  .color-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;font-size:9.5px;font-weight:700}
  .cp-orange{background:#f97316;color:#fff}
  .cp-blue{background:#3b82f6;color:#fff}
  .cp-yellow{background:#eab308;color:#1e293b}
  .total-row td{font-weight:700;background:#f8fafc;border-top:2px solid #e2e8f0}
  .ext-badge{background:#fef3c7;color:#92400e;display:inline-block;padding:1px 6px;border-radius:99px;font-size:10px;margin-left:4px}
  .footer{margin-top:28px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}
  @media print{body{padding:20px}}
</style>
</head>
<body>
<div class="header">
  <div class="header-left">
    <h1>Contas a Pagar</h1>
    <p>${periodLabel}</p>
  </div>
  <div class="header-right">
    <p>Emitido em ${genDate}</p>
  </div>
</div>
<div class="filters"><strong>Filtros:</strong> ${filtersLabel}</div>
<div class="legend">
  <span class="legend-item"><span class="swatch" style="background:#f97316"></span>Laranja — Pagar na lotérica 8 dias antes</span>
  <span class="legend-item"><span class="swatch" style="background:#3b82f6"></span>Azul — Enviar para André e cobrar até ele pagar</span>
  <span class="legend-item"><span class="swatch" style="background:#eab308"></span>Amarelo Neon — Pagar da Nubank</span>
</div>
<div class="summary-grid">
  <div class="summary-card"><div class="label">Total</div><div class="value">${formatCurrency(rows.reduce((s,b)=>s+b.amount,0))}</div></div>
  <div class="summary-card"><div class="label">Pago</div><div class="value" style="color:#059669">${formatCurrency(rows.filter(b=>b.status==='pago').reduce((s,b)=>s+b.amount,0))}</div></div>
  <div class="summary-card"><div class="label">Em Aberto</div><div class="value" style="color:#ea580c">${formatCurrency(rows.filter(b=>b.status!=='pago').reduce((s,b)=>s+b.amount,0))}</div></div>
</div>
<table>
  <thead><tr>
    <th>Status</th>
    <th>Item</th>
    <th>Vencimento</th>
    <th>Dt. Pagamento</th>
    <th class="right">Valor</th>
  </tr></thead>
  <tbody>
    ${rows.map(b => {
      const rowClass = b.color_tag === 'orange' ? 'row-orange'
        : b.color_tag === 'blue' ? 'row-blue'
        : b.color_tag === 'yellow' ? 'row-yellow' : 'row-pad';
      const ext = b.external_payment ? `<span class="ext-badge">${(b.payment_sources as any)?.name || 'Externo'}</span>` : '';
      return `<tr class="${rowClass}">
        <td><span class="badge badge-${b.status}">${STATUS_LABELS[b.status]}</span></td>
        <td>${b.item}${ext}</td>
        <td>${formatDate(b.due_date)}</td>
        <td>${b.payment_date ? formatDate(b.payment_date) : '—'}</td>
        <td class="right">${formatCurrency(b.amount)}</td>
      </tr>`;
    }).join('')}
  </tbody>
  <tfoot><tr class="total-row">
    <td colspan="4">Total (${rows.length} ${rows.length === 1 ? 'item' : 'itens'})</td>
    <td class="right">${formatCurrency(rows.reduce((s,b)=>s+b.amount,0))}</td>
  </tr></tfoot>
</table>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Contas a Pagar</h1>
          <p className="text-slate-500 mt-1">Gerencie suas despesas mensais</p>
        </div>
        <div className="flex items-center gap-2">
          {replicateMonthConfirm ? (
            <div className="flex items-center gap-2 bg-teal-50 border border-teal-300 rounded-lg px-3 py-2">
              <span className="text-sm text-teal-800 font-medium">
                Replicar {bills.length} conta(s) para {formatMonth(nextMonth(month))}?
              </span>
              <button
                onClick={handleReplicateMonth}
                disabled={replicatingMonth}
                className="px-3 py-1 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {replicatingMonth ? 'Replicando...' : 'Sim'}
              </button>
              <button
                onClick={() => setReplicateMonthConfirm(false)}
                className="px-3 py-1 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
              >
                Não
              </button>
            </div>
          ) : (
            <button
              onClick={() => setReplicateMonthConfirm(true)}
              disabled={bills.length === 0}
              className="flex items-center gap-2 border border-teal-300 text-teal-700 bg-teal-50 px-4 py-2 rounded-lg hover:bg-teal-100 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              title={`Replicar contas em aberto para ${formatMonth(nextMonth(month))}`}
            >
              <CopyCheck size={16} />
              Replicar Mês
            </button>
          )}
          <button
            onClick={() => { setEditBill(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus size={18} />
            Nova Conta
          </button>
          <button
            onClick={handleExportPDF}
            disabled={bills.length === 0}
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar PDF conforme filtros"
          >
            <FileDown size={16} />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Alerts row */}
      {(dueTodayBills.length > 0 || overdueBills.length > 0) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {dueTodayBills.length > 0 && !dismissedAlert && (
            <div className="flex-1 bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
              <Bell size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800">
                  {dueTodayBills.length} conta{dueTodayBills.length > 1 ? 's vencem' : ' vence'} hoje!
                </p>
                <ul className="mt-1 space-y-0.5">
                  {dueTodayBills.map(b => (
                    <li key={b.id} className="text-xs text-amber-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                      <span className="font-medium truncate">{b.item}</span>
                      <span className="text-amber-600 flex-shrink-0">— {formatCurrency(b.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button onClick={() => setDismissedAlert(true)} className="text-amber-400 hover:text-amber-600 transition-colors flex-shrink-0">
                <ChevronRight size={16} className="rotate-90" />
              </button>
            </div>
          )}
          {overdueBills.length > 0 && !dismissedOverdue && (
            <div className="flex-1 bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800">
                  {overdueBills.length} conta{overdueBills.length > 1 ? 's vencidas' : ' vencida'}!
                </p>
                <ul className="mt-1 space-y-0.5">
                  {overdueBills.map(b => (
                    <li key={b.id} className="text-xs text-red-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                      <span className="font-medium truncate">{b.item}</span>
                      <span className="text-red-500 flex-shrink-0">— {formatCurrency(b.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button onClick={() => setDismissedOverdue(true)} className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
                <ChevronRight size={16} className="rotate-90" />
              </button>
            </div>
          )}
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

      {/* Color legend */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mr-2">
            <Tag size={13} /> Legenda:
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-3 h-3 rounded-sm bg-orange-400" />
            <span>Laranja — Pagar na lotérica 8 dias antes</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-3 h-3 rounded-sm bg-blue-400" />
            <span>Azul — Enviar para André e cobrar até ele pagar</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-3 h-3 rounded-sm bg-yellow-300" />
            <span>Amarelo Neon — Pagar da Nubank</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Buscar por item</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                placeholder="Nome do item..."
                className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
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
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Vencimento de</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Vencimento até</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Categoria de Cor</label>
            <select value={filterColor} onChange={e => setFilterColor(e.target.value as ColorTag | 'none' | '')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas</option>
              {COLOR_TAGS.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
              <option value="none">Sem cor</option>
            </select>
          </div>
        </div>
        {(filterName || filterStatus || filterCostCenter || filterPaymentSource || filterDateFrom || filterDateTo || filterColor) && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => { setFilterName(''); setFilterStatus(''); setFilterCostCenter(''); setFilterPaymentSource(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterColor(''); }}
              className="border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              Limpar filtros
            </button>
          </div>
        )}
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cor</th>
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
                {paginated.map(bill => {
                  const colorStyle = bill.color_tag ? COLOR_ROW_STYLES[bill.color_tag] : null;
                  const rowBg = colorStyle
                    ? colorStyle.row
                    : bill.status === 'pago'
                      ? 'bg-emerald-50/40 hover:bg-emerald-50'
                      : bill.due_date === today
                        ? 'bg-amber-50/60 hover:bg-amber-50'
                        : 'hover:bg-slate-50';
                  return (
                  <tr key={bill.id} className={`transition-colors ${rowBg}`}>
                    <td className="px-4 py-3">
                      {bill.color_tag === 'orange' && <span className="inline-block w-4 h-4 rounded-full bg-orange-400" title="Laranja — Pagar na lotérica 8 dias antes" />}
                      {bill.color_tag === 'blue' && <span className="inline-block w-4 h-4 rounded-full bg-blue-400" title="Azul — Enviar para André e cobrar até ele pagar" />}
                      {bill.color_tag === 'yellow' && <span className="inline-block w-4 h-4 rounded-full bg-yellow-300" title="Amarelo Neon — Pagar da Nubank" />}
                      {!bill.color_tag && <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[bill.status]}`}>
                        {STATUS_LABELS[bill.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${bill.status === 'pago' ? 'text-emerald-700' : colorStyle ? colorStyle.cellText : 'text-slate-800'}`}>{bill.item}</span>
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
                    <td className={`px-4 py-3 text-right font-semibold ${bill.status === 'pago' ? 'text-emerald-700' : colorStyle ? colorStyle.cellText : 'text-slate-800'}`}>{formatCurrency(bill.amount)}</td>
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
                  );
                })}
              </tbody>
              {hasActiveFilter && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-300">
                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-slate-600 text-right">
                      Total filtrado ({filtered.length} {filtered.length === 1 ? 'item' : 'itens'}):
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800 text-base">
                      {formatCurrency(filteredTotal)}
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              )}
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
