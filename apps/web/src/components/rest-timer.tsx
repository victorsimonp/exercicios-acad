import { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, Timer, X } from 'lucide-react';
export function RestTimer({
  endsAt,
  persist,
  storageKey = 'ht-rest',
  duration = 90,
}: {
  endsAt: string | null;
  persist: (endsAt: string | null) => void;
  storageKey?: string;
  duration?: number;
}) {
  const [now, setNow] = useState(Date.now());
  const [paused, setPaused] = useState<number | null>(() => {
    const stored = localStorage.getItem(storageKey);
    return stored === null ? null : Number(stored);
  });
  useEffect(() => {
    if (paused === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, String(paused));
  }, [paused, storageKey]);
  useEffect(() => {
    if (endsAt !== null) setPaused(null);
  }, [endsAt]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  if (!endsAt && paused === null) return null;
  const remaining =
    paused ??
    Math.max(0, Math.ceil((new Date(endsAt!).getTime() - now) / 1000));
  const change = (seconds: number) => {
    if (paused !== null) setPaused(Math.max(0, paused + seconds));
    else
      persist(
        new Date(
          Date.now() + Math.max(0, remaining + seconds) * 1000,
        ).toISOString(),
      );
  };
  return (
    <section
      className={`rest-timer ${remaining === 0 ? 'timer-finished' : ''}`}
      role="status"
    >
      <Timer size={22} />
      <div>
        <small>
          {remaining === 0 ? 'DESCANSO CONCLUÍDO' : 'DESCANSO ENTRE SÉRIES'}
        </small>
        <strong>
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
        </strong>
      </div>
      <button onClick={() => change(-15)} aria-label="Diminuir 15 segundos">
        −15s
      </button>
      <button onClick={() => change(15)} aria-label="Acrescentar 15 segundos">
        +15s
      </button>
      <button
        aria-label={paused !== null ? 'Continuar descanso' : 'Pausar descanso'}
        onClick={() => {
          if (paused !== null) {
            persist(new Date(Date.now() + paused * 1000).toISOString());
            setPaused(null);
          } else {
            setPaused(remaining);
            persist(null);
          }
        }}
      >
        {paused !== null ? <Play size={18} /> : <Pause size={18} />}
      </button>
      <button
        aria-label="Reiniciar descanso"
        onClick={() => {
          setPaused(null);
          persist(new Date(Date.now() + duration * 1000).toISOString());
        }}
      >
        <RotateCcw size={17} />
      </button>
      <button
        aria-label="Fechar descanso"
        onClick={() => {
          setPaused(null);
          persist(null);
        }}
      >
        <X size={17} />
      </button>
    </section>
  );
}
