'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase-client';
import type { Game } from '@/lib/database.types';

export default function LobbyPage() {
  const [games, setGames] = useState<(Game & { playerCount?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [demoMode] = useState(!isSupabaseConfigured);
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setUserId('demo-user');
      return;
    }

    const supabase = createClient();

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);
        setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || null);
        setUserAvatar(user.user_metadata?.avatar_url || null);
      }

      // Load waiting games
      const { data: gamesData } = await supabase
        .from('games')
        .select('*')
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })
        .limit(20);

      if (gamesData) {
        const enriched = await Promise.all(
          gamesData.map(async (g) => {
            const { count } = await supabase
              .from('players')
              .select('*', { count: 'exact', head: true })
              .eq('game_id', g.id);
            return { ...g, playerCount: count ?? 0 };
          })
        );
        setGames(enriched);
      }
      setLoading(false);
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUserId(null);
    setUserName(null);
    setUserAvatar(null);
  };

  const handleCreate = async () => {
    if (!userId || creating) return;
    setCreating(true);

    try {
      const res = await fetch('/api/game/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostUserId: userId }),
      });
      const data = await res.json();
      if (data.gameId) {
        router.push(`/game/${data.gameId}`);
      }
    } catch (err) {
      console.error('Create failed:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (gameId: string) => {
    if (!userId) return;

    try {
      const res = await fetch('/api/game/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, userId }),
      });
      const data = await res.json();
      if (data.playerId || data.error === 'Already in this game' || data.error === 'Game already started') {
        router.push(`/game/${gameId}`);
      }
    } catch (err) {
      console.error('Join failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[300px] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-6xl font-black mb-2">
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              MKpolis
            </span>
          </h1>
          <p className="text-cyan-400/60 text-sm tracking-[0.3em] uppercase">
            Online Game — Monopoly de Videojuegos
          </p>
          <div className="mt-4 w-32 h-0.5 mx-auto bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
        </motion.div>

        {/* Demo mode banner */}
        {demoMode && (
          <motion.div
            className="mb-8 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-yellow-400/80 text-sm font-medium">
              Modo Demo — Configura Supabase en <code className="text-yellow-300">.env.local</code> para multijugador online
            </p>
            <p className="text-yellow-500/50 text-xs mt-1">
              Copia <code>.env.local.example</code> y agrega tus credenciales de Supabase
            </p>
          </motion.div>
        )}

        {/* Auth Section */}
        {!demoMode && !userId && !loading && (
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.button
              onClick={handleSignIn}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-white text-gray-800 font-bold text-base shadow-xl hover:bg-gray-100 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Iniciar sesion con Google
            </motion.button>
          </motion.div>
        )}

        {/* User info bar */}
        {userId && !demoMode && (
          <motion.div
            className="flex items-center justify-center gap-3 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {userAvatar && (
              <img
                src={userAvatar}
                alt=""
                className="w-8 h-8 rounded-full border border-cyan-500/30"
                referrerPolicy="no-referrer"
              />
            )}
            <span className="text-sm text-cyan-300">{userName || 'Jugador'}</span>
            <button
              onClick={handleSignOut}
              className="text-xs text-cyan-500/40 hover:text-cyan-400 transition-colors ml-2"
            >
              Cerrar sesion
            </button>
          </motion.div>
        )}

        {/* Create Game — only when signed in */}
        {userId && (
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <motion.button
              onClick={handleCreate}
              disabled={creating}
              className="px-10 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-lg shadow-xl shadow-cyan-500/20 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {creating ? 'Creando...' : 'Crear Partida'}
            </motion.button>
          </motion.div>
        )}

        {/* Games List */}
        <div>
          <h2 className="text-xs font-bold text-cyan-500/60 uppercase tracking-widest mb-4">
            Partidas Disponibles
          </h2>

          {loading ? (
            <div className="text-center text-cyan-500/30 py-12">Cargando...</div>
          ) : games.length === 0 ? (
            <div className="text-center text-cyan-500/30 py-12 border border-dashed border-cyan-900/20 rounded-2xl">
              No hay partidas disponibles. Crea una!
            </div>
          ) : (
            <div className="space-y-3">
              {games.map((game, i) => (
                <motion.div
                  key={game.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-cyan-900/20 bg-slate-900/60 hover:border-cyan-500/30 transition-all cursor-pointer group"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleJoin(game.id)}
                >
                  <div>
                    <div className="text-sm font-semibold text-cyan-100">
                      Partida #{game.id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-cyan-500/40 mt-0.5">
                      {new Date(game.created_at).toLocaleTimeString('es')} — {game.playerCount}/6
                      jugadores
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-1">
                      {Array.from({ length: game.playerCount ?? 0 }, (_, j) => (
                        <div
                          key={j}
                          className="w-6 h-6 rounded-full border-2 border-slate-900"
                          style={{
                            background: ['#00ffcc', '#ff3d71', '#ffaa00', '#7c4dff', '#00e676', '#ff6e40'][j],
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Unirse
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
