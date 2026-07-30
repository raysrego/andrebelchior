import { createClient } from '@supabase/supabase-js';

// Garantir que a URL não contenha barras extras ou /rest/v1
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, ''); // remove barra final se houver
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set');
}

// Verificação extra: a URL não deve conter "/rest/v1"
if (supabaseUrl.includes('/rest/v1')) {
  console.warn('Supabase URL contains /rest/v1, removing it...');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Status = 'aberto' | 'pago' | 'vencido';
export type Classification = 'fixo' | 'fixo_variavel' | 'extra';
export type ColorTag = 'orange' | 'blue' | 'yellow' | null;

export const COLOR_TAGS: { value: NonNullable<ColorTag>; label: string; legend: string; swatch: string }[] = [
  { value: 'orange', label: 'Laranja', legend: 'Pagar na lotérica 8 dias antes', swatch: 'bg-orange-400' },
  { value: 'blue', label: 'Azul', legend: 'Enviar para André e cobrar até ele pagar', swatch: 'bg-blue-400' },
  { value: 'yellow', label: 'Amarelo Neon', legend: 'Pagar da Nubank', swatch: 'bg-yellow-300' },
];

export const COLOR_ROW_STYLES: Record<NonNullable<ColorTag>, { row: string; cellText: string }> = {
  orange: { row: 'bg-orange-100/70 hover:bg-orange-100', cellText: 'text-orange-900' },
  blue: { row: 'bg-blue-100/70 hover:bg-blue-100', cellText: 'text-blue-900' },
  yellow: { row: 'bg-yellow-100/80 hover:bg-yellow-200/80', cellText: 'text-yellow-900' },
};

export interface CostCenter {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface PaymentSource {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export type Bill = {
  id: string;
  status: Status;
  due_date: string;         // formato YYYY-MM-DD
  item: string;
  amount: number;
  cost_center_id: string;
  classification: Classification;
  bank_info: string;
  reference_month: string;  // formato YYYY-MM
  external_payment: boolean;
  external_payment_description: string;
  payment_source_id: string | null;
  payment_date: string | null;
  color_tag: ColorTag;
  created_at?: string;
  updated_at?: string;
  cost_centers?: { id: string; name: string } | null;
  payment_sources?: { id: string; name: string } | null;
  _attachment_count?: number;
};

export interface IncomeEntry {
  id: string;
  description: string;
  amount: number;
  date: string;
  origin: string;
  reference_month: string;
  created_at: string;
  updated_at: string;
}

export interface BillAttachment {
  id: string;
  bill_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface MonthlyBalance {
  id: string;
  reference_month: string;
  initial_balance: number;
  created_at: string;
  updated_at: string;
}

// ---------- Funções auxiliares ----------

/** Returns today's date as YYYY-MM-DD in local timezone. */
export function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonth(ym: string): string {
  const [year, month] = ym.split('-');
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${months[parseInt(month) - 1]} ${year}`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(date: string): string {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

export function computeStatus(dueDate: string, currentStatus: Status): Status {
  if (currentStatus === 'pago') return 'pago';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  return due < today ? 'vencido' : 'aberto';
}
