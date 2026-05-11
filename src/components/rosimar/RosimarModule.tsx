import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import RosimarLogin from './RosimarLogin';
import RosimarApp from './RosimarApp';

export default function RosimarModule() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(!!data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return <RosimarLogin onLogin={() => setAuthenticated(true)} />;
  }

  return <RosimarApp onLogout={() => setAuthenticated(false)} />;
}
