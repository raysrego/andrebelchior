import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Wallet, LogOut, Menu, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import RosimarPayments from './RosimarPayments';

interface Props {
  onLogout: () => void;
}

export default function RosimarApp({ onLogout }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    onLogout();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
          <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Wallet size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm leading-tight">Rosimar</p>
            <p className="text-xs text-slate-400">Controle de Pagamentos</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden p-1 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3">
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium bg-slate-800 text-white shadow-sm"
          >
            <Wallet size={18} className="text-white" />
            Pagamentos
          </button>
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-slate-100 space-y-2">
          {user && (
            <p className="text-xs text-slate-500 px-3 truncate">{user.email}</p>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
          >
            <LogOut size={16} />
            Sair
          </button>
          <p className="text-xs text-slate-300 px-3">Rosimar v1.0</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Wallet size={20} className="text-rose-600" />
            <h1 className="font-semibold text-slate-800">Controle de Pagamentos</h1>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-5xl mx-auto">
            <RosimarPayments />
          </div>
        </main>
      </div>
    </div>
  );
}
