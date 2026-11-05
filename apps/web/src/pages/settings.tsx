import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ExternalLink, Save } from 'lucide-react';
import { useTraining } from '../app/context';
import { api } from '../services/api';
import { ErrorMessage, PageTitle } from '../components/common';
export function SettingsPage() {
  const { user, refresh, logout } = useTraining();
  const [name, setName] = useState(user.name);
  const [settings, setSettings] = useState({
    theme: user.settings.theme ?? 'dark',
    warmupSets: user.settings.warmupSets ?? 2,
    feederSets: user.settings.feederSets ?? 1,
  });
  const mutation = useMutation({
    mutationFn: () => api('/auth/me', 'PATCH', { name, settings }),
    onSuccess: refresh,
  });
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3333';
  return (
    <>
      <PageTitle
        eyebrow="DO SEU JEITO"
        title="Configurações"
        description="Ajuste seu perfil e suas preferências de treinamento."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <section className="panel settings-panel">
          <h2>Seu perfil</h2>
          <label>
            Nome
            <input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Email
            <input disabled value={user.email} />
          </label>
          <label>
            Aparência
            <select
              value={settings.theme}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  theme: e.target.value as 'dark' | 'light',
                })
              }
            >
              <option value="dark">Escuro</option>
              <option value="light">Claro</option>
            </select>
          </label>
        </section>
        <section className="panel settings-panel">
          <h2>Preparação do treino</h2>
          <p className="muted">Sugestões aplicadas ao iniciar novas sessões.</p>
          <label>
            Séries de aquecimento no primeiro exercício
            <input
              type="number"
              min="0"
              max="5"
              value={settings.warmupSets}
              onChange={(e) =>
                setSettings({ ...settings, warmupSets: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Séries de aproximação nos multiarticulares
            <input
              type="number"
              min="0"
              max="3"
              value={settings.feederSets}
              onChange={(e) =>
                setSettings({ ...settings, feederSets: Number(e.target.value) })
              }
            />
          </label>
          <p className="muted">
            Aquecimento: 15–20 reps leves, referência de 20–40% da carga de
            trabalho. Aproximação: 4–6 reps com aumento gradual sem fadiga
            excessiva.
          </p>
          <ErrorMessage error={mutation.error} />
          {mutation.isSuccess && (
            <p className="accent" role="status">
              Preferências salvas.
            </p>
          )}
          <button className="primary" disabled={mutation.isPending}>
            <Save size={17} />
            {mutation.isPending ? 'Salvando…' : 'Salvar preferências'}
          </button>
        </section>
      </form>
      <section className="panel settings-panel">
        <h2>Sua conta</h2>
        <a
          className="subtle-link"
          href={`${apiUrl}/docs`}
          target="_blank"
          rel="noreferrer"
        >
          Documentação da API <ExternalLink size={16} />
        </a>
        <p className="muted">
          Suas cargas são registradas por você. Nenhuma sugestão altera seus
          resultados automaticamente.
        </p>
        <button onClick={() => void logout()}>Sair da conta</button>
      </section>
    </>
  );
}
