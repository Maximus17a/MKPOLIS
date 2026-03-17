'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface PlayerPosition {
  id: string;
  position_index: number;
}

// Synthesize a short "tick" sound using Web Audio API
let audioCtx: AudioContext | null = null;
function playTick(isLast: boolean) {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    // Higher pitch on the last step for a satisfying landing
    osc.frequency.value = isLast ? 880 : 600;
    osc.type = 'sine';

    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isLast ? 0.12 : 0.06));

    osc.start(now);
    osc.stop(now + (isLast ? 0.12 : 0.06));
  } catch {
    // Audio not available — silent fallback
  }
}

/**
 * Animates player tokens tile-by-tile instead of teleporting.
 * Returns a map of playerId -> current display position.
 */
export function useSteppingAnimation(
  players: PlayerPosition[],
  stepDuration = 120
) {
  const [displayPositions, setDisplayPositions] = useState<Record<string, number>>({});
  const animatingRef = useRef<Set<string>>(new Set());
  const prevPositionsRef = useRef<Record<string, number>>({});
  const initializedRef = useRef(false);

  // Initialize display positions on first render
  useEffect(() => {
    if (!initializedRef.current && players.length > 0) {
      initializedRef.current = true;
      const initial: Record<string, number> = {};
      for (const p of players) {
        initial[p.id] = p.position_index;
        prevPositionsRef.current[p.id] = p.position_index;
      }
      setDisplayPositions(initial);
    }
  }, [players]);

  // Watch for position changes and animate step by step
  useEffect(() => {
    for (const player of players) {
      const prevPos = prevPositionsRef.current[player.id];
      const targetPos = player.position_index;

      // Skip if no previous position, same position, or already animating
      if (prevPos === undefined || prevPos === targetPos || animatingRef.current.has(player.id)) {
        continue;
      }

      // Mark as animating
      animatingRef.current.add(player.id);
      prevPositionsRef.current[player.id] = targetPos;

      // Calculate step sequence (always move forward around the board)
      const steps: number[] = [];
      let pos = prevPos;
      // Safety: max 40 steps to prevent infinite loop
      let safety = 0;
      while (pos !== targetPos && safety < 40) {
        pos = (pos + 1) % 40;
        steps.push(pos);
        safety++;
      }

      // Animate each step with tick sound
      steps.forEach((step, i) => {
        setTimeout(() => {
          setDisplayPositions((prev) => ({ ...prev, [player.id]: step }));
          const isLast = i === steps.length - 1;
          playTick(isLast);
          if (isLast) {
            animatingRef.current.delete(player.id);
          }
        }, (i + 1) * stepDuration);
      });
    }
  }, [players, stepDuration]);

  // For players not yet in displayPositions, use their actual position
  const getDisplayPosition = useCallback(
    (playerId: string, fallback: number) => {
      return displayPositions[playerId] ?? fallback;
    },
    [displayPositions]
  );

  return { displayPositions, getDisplayPosition };
}
