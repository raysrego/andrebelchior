import { useState, useEffect } from 'react';
import { LayoutDashboard, FileText, TrendingUp, Building2, BarChart3, Menu, X, CreditCard, LogOut, Wallet } from 'lucide-react';
import { supabase } from './lib/supabase';
import Dashboard from './components/Dashboard';
import Bills from './components/Bills';
import IncomeEntries from './components/IncomeEntries';
import CostCenters from './components/CostCenters';
import PaymentSources from './components/PaymentSources';
import Reports from './components/Reports';
import AccessScreen from './components/AccessScreen';
import RosimarModule from './components/rosimar/RosimarModule';

type Tab = 'dashboard' | 'bills' | 'income' | 'costcenters' | 'paymentsources' | 'reports' | 'rosimar';

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, color: 'text-slate-600' },
  { id: 'bills', label: 'Contas a Pagar', icon: <FileText size={20} />, color: 'text-blue-600' },
  { id: 'income', label: 'Entradas', icon: <TrendingUp size={20} />, color: 'text-emerald-600' },
  { id: 'costcenters', label: 'Centros de Custo', icon: <Building2 size={20} />, color: 'text-orange-600' },
  { id: 'paymentsources', label: 'Fontes Pagadoras', icon: <CreditCard size={20} />, color: 'text-amber-600' },
  { id: 'reports', label: 'Relatórios', icon: <BarChart3 size={20} />, color: 'text-teal-600' },
  { id: 'rosimar', label: 'Rosimar', icon: <Wallet size={20} />, color: 'text-rose-600' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasAccess(!!data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasAccess(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const current = NAV_ITEMS.find(n => n.id === activeTab)!;

  function navigate(tab: Tab) {
    setActiveTab(tab);
    setSidebarOpen(false);
  }

  function handleAccess() {
    setHasAccess(true);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setHasAccess(false);
  }

  if (hasAccess === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessScreen onAccess={handleAccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
          <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
            <LayoutDashboard size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm leading-tight">Financeiro</p>
            <p className="text-xs text-slate-400">Contas a Pagar</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden p-1 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                activeTab === item.id
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <span className={activeTab === item.id ? 'text-white' : item.color}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-slate-100 space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
          >
            <LogOut size={16} />
            Sair da Sessão
          </button>
          <p className="text-xs text-slate-400 px-3">Sistema Financeiro v1.0</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <span className={current.color}>{current.icon}</span>
            <h1 className="font-semibold text-slate-800">{current.label}</h1>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'bills' && <Bills />}
            {activeTab === 'income' && <IncomeEntries />}
            {activeTab === 'costcenters' && <CostCenters />}
            {activeTab === 'paymentsources' && <PaymentSources />}
            {activeTab === 'reports' && <Reports />}
            {activeTab === 'rosimar' && <RosimarModule />}
          </div>
        </main>
      </div>
    </div>
  );
}
