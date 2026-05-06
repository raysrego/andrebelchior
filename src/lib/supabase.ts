import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Status = 'aberto' | 'pago' | 'vencido';
export type Classification = 'fixo' | 'fixo_variavel' | 'extra';

export interface CostCenter {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export type Bill = {
  id: string;
  status: 'aberto' | 'pago' | 'vencido';
  due_date: string;
  item: string;
  amount: number;
  cost_center_id: string;
  classification: 'fixo' | 'fixo_variavel' | 'extra';
  bank_info: string;
  reference_month: string;
  created_at?: string;
  updated_at?: string;
  cost_centers?: { id: string; name: string } | null;
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

export interface MonthlyBalance {
  id: string;
  reference_month: string;
  initial_balance: number;
  created_at: string;
  updated_at: string;
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonth(ym: string): string {
  const [year, month] = ym.split('-');
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
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
