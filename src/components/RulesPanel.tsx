'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameRules } from '@/lib/database.types';
import { parseRules } from '@/lib/game/rules';

interface RuleToggleProps {
  label: string;
  description: string;
  icon: string;
  checked: boolean;
  disabled: boolean;
  onChange: (val: boolean) => void;
}

function RuleToggle({ label, description, icon, checked, disabled, onChange }: RuleToggleProps) {
  return (
    <div
      className={[
        'flex items-start gap-3 p-3 rounded-xl border transition-all',
        checked
          ? 'border-cyan-500/50 bg-cyan-500/10'
          : 'border-cyan-900/25 bg-slate-900/40',
        disabled ? 'opacity-60' : '',
      ].join(' ')}
    >
      <span className="text-xl leading-none mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-cyan-200 leading-tight">{label}</p>
        <p className="text-[11px] text-cyan-500/60 mt-0.5 leading-snug">{description}</p>
      </div>
      {/* Toggle switch */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={[
          'relative shrink-0 mt-0.5 w-10 h-5 rounded-full transition-colors duration-200',
          checked ? 'bg-cyan-500' : 'bg-slate-700',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
        aria-pressed={checked}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  );
}

interface RulesPanelProps {
  gameId: string;
  rules: GameRules;
  isHost: boolean;
}

export default function RulesPanel({ gameId, rules, isHost }: RulesPanelProps) {
  const parsed = parseRules(rules);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (key: keyof GameRules, value: boolean) => {
    if (!isHost || saving) return;
    setSaving(true);
    try {
      await fetch('/api/game/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, rules: { ...parsed, [key]: value } }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="space-y-4 text-left"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <p className="text-xs text-cyan-500/60 uppercase tracking-widest font-semibold">
            Configuración de Reglas
          </p>
          {!isHost && (
            <span className="ml-auto text-[10px] text-cyan-500/40 italic">Solo el host puede editar</span>
          )}
        </div>

        {/* Reglas de la Casa */}
        <div className="space-y-2">
          <p className="text-[10px] text-yellow-400/80 uppercase tracking-widest font-bold px-1">
            🏠 Reglas de la Casa
          </p>

          <RuleToggle
            icon="🅿️"
            label="Bote del Lounge de Servidor"
            description="Todo el dinero retirado del juego (impuestos) se acumula en el Lounge. El jugador que caiga ahí se lleva el bote."
            checked={parsed.lounge_pot}
            disabled={!isHost || saving}
            onChange={(v) => handleToggle('lounge_pot', v)}
          />

          <RuleToggle
            icon="⛓️"
            label="Bancarrota por Reincidencia en el LAG"
            description="Si un jugador cae al LAG 5 veces en la misma partida, queda en bancarrota de inmediato."
            checked={parsed.jail_bankruptcy}
            disabled={!isHost || saving}
            onChange={(v) => handleToggle('jail_bankruptcy', v)}
          />
        </div>

        {/* Reglas para Ganar */}
        <div className="space-y-2">
          <p className="text-[10px] text-green-400/80 uppercase tracking-widest font-bold px-1">
            🏆 Reglas para Ganar
          </p>

          <RuleToggle
            icon="🎨"
            label="Línea Entera de Propiedades"
            description="El primer jugador en comprar todas las propiedades de un mismo grupo de color gana la partida."
            checked={parsed.win_color_line}
            disabled={!isHost || saving}
            onChange={(v) => handleToggle('win_color_line', v)}
          />

          <RuleToggle
            icon="👑"
            label="Tres Monopolios o Cuatro Estaciones"
            description="El primer jugador en completar 3 grupos de color distintos, o en adquirir las 4 estaciones, gana la partida."
            checked={parsed.win_monopoly_or_stations}
            disabled={!isHost || saving}
            onChange={(v) => handleToggle('win_monopoly_or_stations', v)}
          />
        </div>

        {/* No rules selected notice */}
        {!parsed.lounge_pot && !parsed.jail_bankruptcy && !parsed.win_color_line && !parsed.win_monopoly_or_stations && (
          <p className="text-[11px] text-cyan-500/30 text-center pt-1 italic">
            Sin reglas especiales — partida estándar
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
