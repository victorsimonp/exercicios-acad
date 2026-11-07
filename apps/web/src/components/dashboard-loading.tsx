import { PageTitle } from './common';

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function LoadingRows({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Carregando registros">
      {Array.from({ length: count }, (_, index) => (
        <div className="plan-row" key={index}>
          <Skeleton className="skeleton-icon" />
          <div className="skeleton-row-copy">
            <Skeleton />
            <Skeleton className="skeleton-short" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The existing dashboard grid, without account data or protected actions. */
export function DashboardLoading({ status }: { status?: React.ReactNode }) {
  return (
    <div className="dashboard-loading">
      <PageTitle
        eyebrow="SEU PROGRESSO, UM DIA DE CADA VEZ"
        title="Seu treinamento"
        description="Um bom treino começa com um plano. O seu está aqui."
      />
      {status}
      <section className="hero-panel" aria-label="Carregando próximo treino">
        <div className="hero-copy">
          <Skeleton className="skeleton-short" />
          <p className="hero-kicker">SEU PRÓXIMO TREINO</p>
          <Skeleton className="skeleton-heading" />
          <Skeleton />
          <div className="hero-meta">
            <Skeleton className="skeleton-short" />
          </div>
          <Skeleton className="skeleton-button" />
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <Skeleton className="skeleton-focus" />
          <span className="hero-visual-label">FOCO DA SEMANA</span>
        </div>
      </section>
      <section className="stats-grid">
        {[
          'Treinos na semana',
          'Séries de trabalho',
          'Volume acumulado',
          'Tempo médio',
        ].map((label) => (
          <article className="stat-card" key={label}>
            <div>
              <span>{label}</span>
            </div>
            <strong>
              <Skeleton className="skeleton-value" />
            </strong>
            <Skeleton className="skeleton-short" />
          </article>
        ))}
      </section>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-heading">
            <h2>Seu plano da semana</h2>
          </div>
          <LoadingRows count={4} />
        </section>
        <section className="panel focus-panel">
          <div className="section-heading">
            <h2>Foco da semana</h2>
          </div>
          <Skeleton className="skeleton-heading" />
          <LoadingRows count={2} />
        </section>
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-heading">
            <h2>Últimas atividades</h2>
          </div>
          <LoadingRows />
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Suas conquistas</h2>
          </div>
          <LoadingRows />
        </section>
      </div>
    </div>
  );
}
