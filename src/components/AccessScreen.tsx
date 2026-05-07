import { useState } from 'react';
import { LayoutDashboard, ShieldCheck, X } from 'lucide-react';

const CORRECT = '22/09/1987';

const OPTIONS = [
  '21/09/1986',
  '22/09/1987',
  '23/09/1988',
];

interface Props {
  onAccess: () => void;
}

export default function AccessScreen({ onAccess }: Props) {
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  function handleSelect(date: string) {
    if (date === CORRECT) {
      onAccess();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background subtle pattern */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'radial-gradient(circle at 25px 25px, white 2px, transparent 0)',
        backgroundSize: '50px 50px',
      }} />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className={`bg-white rounded-3xl shadow-2xl overflow-hidden transition-transform duration-150 ${shake ? 'animate-shake' : ''}`}>
          {/* Header stripe */}
          <div className="bg-slate-800 px-8 pt-10 pb-8 text-center">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LayoutDashboard size={26} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white leading-tight">Sistema Financeiro</h1>
            <p className="text-slate-400 text-sm mt-1">Controle de Contas</p>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={16} className="text-slate-500" />
              <p className="text-sm font-semibold text-slate-700">Tela de Acesso</p>
            </div>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Selecione a data de nascimento correta para acessar o sistema.
            </p>

            <div className="space-y-3">
              {OPTIONS.map(date => (
                <button
                  key={date}
                  onClick={() => handleSelect(date)}
                  className="w-full text-left px-5 py-3.5 rounded-xl border-2 border-slate-200 text-slate-700 font-medium text-sm hover:border-slate-800 hover:bg-slate-800 hover:text-white transition-all duration-150 active:scale-[0.98]"
                >
                  {date}
                </button>
              ))}
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <X size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">Data incorreta. Tente novamente.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 text-center">
            <p className="text-xs text-slate-300">v1.0</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
}
