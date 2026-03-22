"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type IntegrationResponse = {
  connected: boolean;
  integration: {
    id: string;
    name: string;
    status: string;
    updatedAt: string;
    adAccounts: Array<{
      id: string;
      externalId: string;
      name: string;
      currency: string;
      timezone: string;
      isActive: boolean;
    }>;
  } | null;
  syncLogs: Array<{
    id: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    recordsRead: number;
    recordsWritten: number;
    error: string | null;
  }>;
};

function todayMinus(days: number) {
  const base = new Date();
  base.setDate(base.getDate() - days);
  return base.toISOString().slice(0, 10);
}

export function MetaIntegrationPanel({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [data, setData] = useState<IntegrationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [accessToken, setAccessToken] = useState("");
  const [adAccountExternalId, setAdAccountExternalId] = useState("");
  const [adAccountName, setAdAccountName] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");

  const [selectedAdAccountId, setSelectedAdAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState(todayMinus(7));
  const [dateTo, setDateTo] = useState(todayMinus(0));

  const loadState = useCallback(async () => {
    const response = await fetch(`/api/integrations/meta?projectId=${projectId}`, { cache: "no-store" });
    const payload = (await response.json()) as IntegrationResponse | { error?: string };

    if (!response.ok) {
      throw new Error((payload as { error?: string }).error ?? "Erro ao carregar integracao.");
    }

    const state = payload as IntegrationResponse;
    setData(state);

    const firstAccountId = state.integration?.adAccounts[0]?.id;
    if (firstAccountId) {
      setSelectedAdAccountId((current) => current || firstAccountId);
    }
  }, [projectId]);

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);
        setError(null);
        await loadState();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar integracao Meta.");
      } finally {
        setLoading(false);
      }
    }

    void bootstrap();
  }, [loadState]);

  const activeAccount = useMemo(() => {
    return data?.integration?.adAccounts.find((account) => account.id === selectedAdAccountId) ?? null;
  }, [data, selectedAdAccountId]);

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/integrations/meta", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          accessToken: accessToken.trim(),
          adAccountExternalId: adAccountExternalId.trim(),
          adAccountName: adAccountName.trim() || undefined,
          currency: currency.trim().toUpperCase(),
          timezone: timezone.trim(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Nao foi possivel conectar Meta Ads.");
      }

      setMessage("Integracao Meta atualizada com sucesso.");
      setAccessToken("");
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar integracao.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    if (!selectedAdAccountId) {
      setError("Selecione uma conta de anuncios.");
      return;
    }

    setSyncing(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/meta/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          adAccountId: selectedAdAccountId,
          rangeStart: new Date(`${dateFrom}T00:00:00.000Z`).toISOString(),
          rangeEnd: new Date(`${dateTo}T23:59:59.999Z`).toISOString(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao enfileirar sync.");
      }

      setMessage(`Sync enfileirado. Job: ${String(payload?.jobId ?? "sem-id")}`);
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sincronizar Meta.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-zinc-300">Carregando integracao Meta...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Media</p>
        <h1 className="text-3xl font-bold text-zinc-100">Integracoes Meta Ads</h1>
        <p className="text-sm text-zinc-400">Projeto ativo: {projectName}</p>
      </section>

      {message ? (
        <Card className="border-emerald-400/30 bg-emerald-900/20 text-emerald-100">
          <p className="text-sm">{message}</p>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-400/30 bg-red-900/20 text-red-100">
          <p className="text-sm">{error}</p>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">Status</h2>
            <Badge variant={data?.connected ? "good" : "warn"}>{data?.connected ? "Conectado" : "Pendente"}</Badge>
          </div>

          <p className="mt-3 text-sm text-zinc-400">
            Token de acesso com permissoes para leitura de insights da conta de anuncios.
          </p>

          <form className="mt-4 space-y-3" onSubmit={handleConnect}>
            <input
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              placeholder="Access Token Meta"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              required
            />
            <input
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              placeholder="ID da conta (sem act_, ex: 1234567890)"
              value={adAccountExternalId}
              onChange={(event) => setAdAccountExternalId(event.target.value)}
              required
            />
            <input
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              placeholder="Nome da conta"
              value={adAccountName}
              onChange={(event) => setAdAccountName(event.target.value)}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="h-10 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                placeholder="Moeda (BRL)"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              />
              <input
                className="h-10 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                placeholder="Timezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar conexao Meta"}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">Sync de insights</h2>
          <p className="mt-3 text-sm text-zinc-400">Enfileira importacao no worker com periodo customizado.</p>

          <div className="mt-4 space-y-3">
            <select
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              value={selectedAdAccountId}
              onChange={(event) => setSelectedAdAccountId(event.target.value)}
            >
              {data?.integration?.adAccounts.length ? null : <option value="">Nenhuma conta conectada</option>}
              {data?.integration?.adAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} (act_{account.externalId})
                </option>
              ))}
            </select>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs text-zinc-400">
                <span>Data inicial</span>
                <input
                  type="date"
                  className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>

              <label className="space-y-1 text-xs text-zinc-400">
                <span>Data final</span>
                <input
                  type="date"
                  className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
            </div>

            <Button onClick={handleSync} disabled={!activeAccount || syncing}>
              {syncing ? "Enfileirando..." : "Sincronizar agora"}
            </Button>
          </div>

          {activeAccount ? (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
              Conta ativa: <span className="font-semibold text-zinc-100">{activeAccount.name}</span> | act_{activeAccount.externalId}
            </div>
          ) : null}
        </Card>
      </section>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">Historico de sincronizacao</h2>
        {!data?.syncLogs?.length ? (
          <p className="mt-3 text-sm text-zinc-400">Nenhum sync registrado ainda.</p>
        ) : (
          <div className="mt-4 space-y-2 text-sm">
            {data.syncLogs.map((log) => (
              <div key={log.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={log.status === "SUCCESS" ? "good" : log.status === "FAILED" ? "danger" : "warn"}>{log.status}</Badge>
                  <span className="text-zinc-200">{new Date(log.startedAt).toLocaleString("pt-BR")}</span>
                  <span className="text-zinc-500">read {log.recordsRead} | write {log.recordsWritten}</span>
                </div>
                {log.error ? <p className="mt-2 text-xs text-red-300">{log.error}</p> : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
