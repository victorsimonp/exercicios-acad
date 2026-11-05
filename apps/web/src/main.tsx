import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SetupPage } from './pages/setup';
import './styles.css';
const client = new QueryClient();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SetupPage />} />
          <Route
            path="*"
            element={
              <main className="p-10">
                <h1>Página não encontrada</h1>
                <Link to="/">Voltar ao início</Link>
              </main>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
