import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountGate } from './app/context';
import { Layout } from './app/layout';
import { LoginPage } from './pages/login';
import { Dashboard } from './pages/dashboard';
import { Workouts, WorkoutDetail } from './pages/workouts';
import { SessionPage } from './pages/session';
import { CatalogPage } from './pages/catalog';
import { PeriodizationPage } from './pages/periodization';
import { HistoryPage } from './pages/history';
import { SettingsPage } from './pages/settings';
import './styles.css';
const client = new QueryClient();
const AnalyticsPage = lazy(() =>
  import('./pages/analytics').then((module) => ({
    default: module.AnalyticsPage,
  })),
);
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <AccountGate login={<LoginPage />}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/treinos" element={<Workouts />} />
              <Route path="/treinos/:id" element={<WorkoutDetail />} />
              <Route path="/iniciar" element={<Workouts start />} />
              <Route path="/sessao/:id" element={<SessionPage />} />
              <Route path="/exercicios" element={<CatalogPage />} />
              <Route path="/periodizacao" element={<PeriodizationPage />} />
              <Route path="/historico" element={<HistoryPage />} />
              <Route
                path="/evolucao"
                element={
                  <Suspense fallback={<p>Carregando gráficos…</p>}>
                    <AnalyticsPage />
                  </Suspense>
                }
              />
              <Route path="/configuracoes" element={<SettingsPage />} />
              <Route
                path="*"
                element={
                  <main className="p-10">
                    <h1>Página não encontrada</h1>
                    <Link to="/">Voltar ao início</Link>
                  </main>
                }
              />
            </Route>
          </Routes>
        </AccountGate>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
