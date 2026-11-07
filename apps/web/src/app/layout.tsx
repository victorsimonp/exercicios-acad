import { NavLink, Link } from 'react-router';
import {
  Activity,
  LayoutDashboard,
  Dumbbell,
  Play,
  Library,
  CalendarRange,
  History,
  TrendingUp,
  Settings,
  LogOut,
  ChevronDown,
  ArrowUpRight,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { Program, User, Session } from '@ht/shared';
import { Skeleton } from '../components/dashboard-loading';
const links = [
  { path: '/', name: 'Dashboard', icon: LayoutDashboard },
  { path: '/treinos', name: 'Meus treinos', icon: Dumbbell },
  { path: '/iniciar', name: 'Iniciar treino', icon: Play },
  { path: '/exercicios', name: 'Exercícios', icon: Library },
  { path: '/periodizacao', name: 'Periodização', icon: CalendarRange },
  { path: '/historico', name: 'Histórico', icon: History },
  { path: '/evolucao', name: 'Evolução', icon: TrendingUp },
  { path: '/configuracoes', name: 'Configurações', icon: Settings },
];
type ShellAccount = {
  user: User;
  program?: Program;
  weekNumber: number;
  setWeekNumber: (week: number) => void;
  logout: () => Promise<void>;
  activeSession?: Pick<Session, 'id'> | null;
};
export function Layout({
  account,
  children,
}: {
  account?: ShellAccount;
  children: ReactNode;
}) {
  const { user, program, weekNumber, setWeekNumber, logout, activeSession } =
    account ?? {};
  const startPath = activeSession ? `/sessao/${activeSession.id}` : '/iniciar';
  const week = program?.weeks.find((w) => w.weekNumber === weekNumber);
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Activity size={22} />
          </span>
          <span>
            hypertrophy<small>TRACKER</small>
          </span>
        </Link>
        <p className="nav-caption">SEU TREINAMENTO</p>
        <nav>
          {links.map((l) => (
            <NavLink
              key={l.path}
              to={l.path === '/iniciar' ? startPath : l.path}
              end={l.path === '/'}
              className={({ isActive }) =>
                isActive ? 'nav-item active' : 'nav-item'
              }
            >
              <l.icon size={18} />
              {l.path === '/iniciar' && activeSession
                ? 'Continuar treino'
                : l.name}
              {l.path === '/iniciar' && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="cycle-card">
            <span className="eyebrow">CICLO ATUAL</span>
            <strong>Construindo sua melhor versão.</strong>
            <div className="progress">
              <span
                style={{
                  width: `${((weekNumber ?? 0) / (program?.totalWeeks ?? 8)) * 100}%`,
                }}
              />
            </div>
            <small>
              {account ? (
                <>
                  Semana {weekNumber} de {program?.totalWeeks ?? 8}
                </>
              ) : (
                <Skeleton />
              )}
            </small>
            <Link to="/periodizacao">
              Ver periodização <ArrowUpRight size={14} />
            </Link>
          </div>
          <button
            className="profile"
            disabled={!account}
            onClick={() => void logout?.()}
            title="Sair da conta"
          >
            <span className="avatar">
              {user ? (
                user.name.slice(0, 2).toUpperCase()
              ) : (
                <Skeleton className="skeleton-avatar" />
              )}
            </span>
            <span>
              <strong>{user?.name ?? <Skeleton />}</strong>
              <small>Seu espaço pessoal</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Meu espaço <span>/</span> <strong>Treinamento</strong>
          </div>
          <div className="topbar-right">
            <span className="status-dot" />
            <span className="topbar-status">
              Programa{' '}
              {!account ? (
                <Skeleton className="skeleton-inline" />
              ) : program?.status === 'active' ? (
                'ativo'
              ) : (
                'sem ciclo ativo'
              )}
            </span>
            <label className="week-select">
              <span>Semana</span>
              <select
                aria-label="Semana do ciclo"
                disabled={!account}
                value={weekNumber ?? ''}
                onChange={(e) => setWeekNumber?.(Number(e.target.value))}
              >
                {!account && <option value="">—</option>}
                {program?.weeks
                  .filter((w) => w.weekNumber <= program.totalWeeks)
                  .map((w) => (
                    <option value={w.weekNumber} key={w.id}>
                      {w.weekNumber} · {w.focus}
                      {w.isDeload ? ' · Deload' : ''}
                    </option>
                  ))}
              </select>
              <ChevronDown size={14} />
            </label>
            <span className="focus-badge">
              {account ? (
                (week?.focus ?? '—')
              ) : (
                <Skeleton className="skeleton-inline" />
              )}
            </span>
          </div>
        </header>
        <main className="content">{children}</main>
        <footer className="footer">
          CADA SÉRIE CONTA.<span>Hypertrophy Tracker</span>
        </footer>
      </div>
      <nav className="mobile-nav">
        {[links[0], links[1], links[2], links[5], links[7]].map((l) => (
          <NavLink
            key={l.path}
            to={l.path === '/iniciar' ? startPath : l.path}
            end={l.path === '/'}
          >
            <l.icon size={20} />
            <span>
              {l.path === '/'
                ? 'Início'
                : l.path === '/iniciar'
                  ? activeSession
                    ? 'Continuar'
                    : 'Iniciar'
                  : l.path === '/configuracoes'
                    ? 'Perfil'
                    : l.name.replace('Meus ', '')}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
