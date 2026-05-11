import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, Eye, EyeOff, LogIn } from 'lucide-react';

interface Props {
  onAccess: () => void;
}

export default function AccessScreen({ onAccess }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError('Email ou senha incorretos.');
      setLoading(false);
      return;
    }

    onAccess();
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'radial-gradient(circle at 25px 25px, white 2px, transparent 0)',
          backgroundSize: '50px 50px',
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-slate-800 px-8 pt-10 pb-8 text-center">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LayoutDashboard size={26} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white leading-tight">André Belchior</h1>
            <p className="text-slate-400 text-sm mt-1">Controle Financeiro</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="seuemail@email.com"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-slate-800 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 rounded-xl border-2 border-slate-200 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-slate-800 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-all duration-150 active:scale-[0.98]"
            >
              <LogIn size={18} />
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="px-8 pb-6 text-center">
            <p className="text-xs text-slate-300">Sistema Financeiro v1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
