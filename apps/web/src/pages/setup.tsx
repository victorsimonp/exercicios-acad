import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowUpRight, Check, RefreshCw } from 'lucide-react';
import { getHealth } from '@/services/api';
import { Button } from '@/components/ui/button';
export function SetupPage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => getHealth(signal),
    retry: 1,
    refetchInterval: 30000,
  });
  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:py-16">
      <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <span className="flex items-center gap-3 font-bold tracking-tight">
          <Activity className="text-lime-300" aria-hidden="true" /> HYPERTROPHY
          <span className="font-normal text-zinc-500">/ TRACKER</span>
        </span>
        <span className="text-xs text-zinc-400">AMBIENTE LOCAL</span>
      </header>
      <section className="py-20">
        <p className="mb-5 text-xs font-semibold tracking-[.25em] text-lime-300">
          01 / CONFIGURAÇÃO INICIAL
        </p>
        <h1 className="max-w-2xl text-5xl font-semibold leading-tight tracking-tight md:text-7xl">
          A base da sua
          <br />
          <span className="text-zinc-500">próxima evolução.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
          O primeiro passo é conectar tudo. Este painel verifica a comunicação
          entre a interface e a API do projeto.
        </p>
      </section>
      <section
        className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-7"
        aria-labelledby="connection-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-zinc-500">
              Conexão com o backend
            </p>
            <h2
              id="connection-title"
              className="text-2xl font-medium"
              role="status"
              aria-live="polite"
            >
              {health.isPending
                ? 'Verificando conexão…'
                : health.isError
                  ? 'API indisponível'
                  : 'API conectada'}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              {health.isError
                ? 'Confirme se o backend está iniciado na porta 3333.'
                : 'GET /api/v1/health'}
            </p>
          </div>
          <Button
            onClick={() => void health.refetch()}
            disabled={health.isFetching}
          >
            <RefreshCw
              size={15}
              className={health.isFetching ? 'mr-2 animate-spin' : 'mr-2'}
              aria-hidden="true"
            />
            Verificar novamente
          </Button>
        </div>
      </section>
      <section className="grid gap-4 py-6 sm:grid-cols-3">
        {[
          ['Interface', 'React + TypeScript'],
          ['Servidor', 'Fastify + Prisma'],
          ['Persistência', 'PostgreSQL via Docker'],
        ].map(([title, detail]) => (
          <div key={title} className="rounded-xl border border-zinc-800 p-5">
            <ArrowUpRight
              size={18}
              className="mb-5 text-zinc-500"
              aria-hidden="true"
            />
            <h2 className="font-medium">{title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{detail}</p>
          </div>
        ))}
      </section>
      <footer className="mt-10 flex gap-2 text-sm text-zinc-500">
        <Check size={18} aria-hidden="true" />
        Estrutura inicial. Funcionalidades de treino serão adicionadas na
        próxima etapa.
      </footer>
    </main>
  );
}
