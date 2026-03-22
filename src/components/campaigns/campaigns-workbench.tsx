"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type CampaignRow = {
  campaignId: string;
  campaignExternalId: string;
  campaignName: string;
  status: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  purchasesMeta: number;
  conversionsReal: number;
  revenueReal: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
  frequency: number;
  conversionGap: number;
};

type AutomationRow = {
  id: string;
  name: string;
  enabled: boolean;
  timezone: string;
  runTimes: string[];
  scope: "ALL_ACTIVE" | "SELECTED";
  preset: "BALANCED" | "AGGRESSIVE" | "DEFENSIVE" | "CREATIVE_RESCUE" | "ROAS_GUARD";
  selectedCampaignIds: string[];
  lastRunAt: string | null;
  maxBudgetIncreasePercent: number;
  maxBudgetDecreasePercent: number;
};

const presetOptions = [
  {
    value: "BALANCED",
    label: "Balanced",
    description: "Escala vencedoras e corta desperdicio com equilibrio.",
  },
  {
    value: "AGGRESSIVE",
    label: "Aggressive",
    description: "Acelera budget em campanhas boas e assume maior variacao de risco.",
  },
  {
    value: "DEFENSIVE",
    label: "Defensive",
    description: "Protege caixa com limites mais conservadores de CPA e ROAS.",
  },
  {
    value: "CREATIVE_RESCUE",
    label: "Creative Rescue",
    description: "Prioriza alertas de fadiga criativa e troca de anuncios.",
  },
  {
    value: "ROAS_GUARD",
    label: "ROAS Guard",
    description: "Foco em manter ROAS alvo e reduzir rapidamente campanhas fora da meta.",
  },
] as const;

export function CampaignsWorkbench({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [automations, setAutomations] = useState<AutomationRow[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("Otimizacao automatica principal");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [runTimes, setRunTimes] = useState<string[]>(["09:00"]);
  const [scope, setScope] = useState<"ALL_ACTIVE" | "SELECTED">("ALL_ACTIVE");
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [preset, setPreset] = useState<(typeof presetOptions)[number]["value"]>("BALANCED");
  const [minSpend, setMinSpend] = useState("100");
  const [targetRoas, setTargetRoas] = useState("2");
  const [maxCpa, setMaxCpa] = useState("150");
  const [maxBudgetIncreasePercent, setMaxBudgetIncreasePercent] = useState("20");
  const [maxBudgetDecreasePercent, setMaxBudgetDecreasePercent] = useState("20");
  const [pauseLosers, setPauseLosers] = useState(true);
  const [scaleWinners, setScaleWinners] = useState(true);
  const [refreshCreativeAlerts, setRefreshCreativeAlerts] = useState(true);
  const [trackingConsistencyCheck, setTrackingConsistencyCheck] = useState(true);

  const loadCampaigns = useCallback(async () => {
    const response = await fetch(`/api/campaigns?projectId=${projectId}&days=${days}`, { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error ?? "Falha ao carregar campanhas.");
    }

    setCampaigns((payload.campaigns ?? []) as CampaignRow[]);
  }, [days, projectId]);

  const loadAutomations = useCallback(async () => {
    const response = await fetch(`/api/automations/campaigns?projectId=${projectId}`, { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error ?? "Falha ao carregar automacoes.");
    }

    setAutomations((payload.automations ?? []) as AutomationRow[]);
  }, [projectId]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([loadCampaigns(), loadAutomations()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar modulo de campanhas.");
    } finally {
      setLoading(false);
    }
    }, [loadAutomations, loadCampaigns]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const totals = useMemo(() => {
    const spend = campaigns.reduce((acc, item) => acc + item.spend, 0);
    const revenue = campaigns.reduce((acc, item) => acc + item.revenueReal, 0);
    const conversions = campaigns.reduce((acc, item) => acc + item.conversionsReal, 0);
    const roas = spend > 0 ? revenue / spend : 0;

    return {
      spend,
      revenue,
      conversions,
      roas,
    };
  }, [campaigns]);

  function updateRunTime(index: number, value: string) {
    setRunTimes((current) => current.map((item, idx) => (idx === index ? value : item)));
  }

  function addRunTime() {
    setRunTimes((current) => [...current, "14:00"]);
  }

  function removeRunTime(index: number) {
    setRunTimes((current) => current.filter((_, idx) => idx !== index));
  }

  function toggleCampaignSelection(campaignId: string) {
    setSelectedCampaignIds((current) =>
      current.includes(campaignId) ? current.filter((id) => id !== campaignId) : [...current, campaignId],
    );
  }

  async function handleCreateAutomation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/automations/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          name: name.trim(),
          timezone: timezone.trim(),
          runTimes: runTimes.map((time) => time.trim()).filter(Boolean),
          scope,
          selectedCampaignIds,
          preset,
          minSpend: Number(minSpend),
          targetRoas: Number(targetRoas),
          maxCpa: Number(maxCpa),
          maxBudgetIncreasePercent: Number(maxBudgetIncreasePercent),
          maxBudgetDecreasePercent: Number(maxBudgetDecreasePercent),
          pauseLosers,
          scaleWinners,
          refreshCreativeAlerts,
          trackingConsistencyCheck,
          enabled: true,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Nao foi possivel criar automacao.");
      }

      setShowModal(false);
      setMessage("Automacao criada com sucesso.");
      await loadAutomations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar automacao.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAutomation(automation: AutomationRow) {
    try {
      const response = await fetch("/api/automations/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          automationId: automation.id,
          enabled: !automation.enabled,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao atualizar automacao.");
      }

      await loadAutomations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar automacao.");
    }
  }

  async function deleteAutomation(automationId: string) {
    try {
      const response = await fetch("/api/automations/campaigns", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, automationId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao remover automacao.");
      }

      await loadAutomations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover automacao.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Media</p>
          <h1 className="text-3xl font-bold text-zinc-100">Campanhas</h1>
          <p className="text-sm text-zinc-400">Projeto: {projectName}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400">
            Janela
            <select
              className="ml-2 h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-100"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            >
              <option value={3}>3 dias</option>
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </label>
          <Button onClick={() => setShowModal(true)}>Otimizar campanhas automatico</Button>
        </div>
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

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Investimento</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">R$ {totals.spend.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Receita real</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">R$ {totals.revenue.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Conversoes reais</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{totals.conversions.toLocaleString("pt-BR")}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">ROAS real</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{totals.roas.toFixed(2)}</p>
        </Card>
      </section>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">Campanhas conectadas</h2>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-400">Carregando campanhas...</p>
        ) : campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">
            Nenhuma campanha encontrada. Conecte Meta em Integracoes e rode um sync para importar dados.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-400">
                  <th className="px-2 py-2">Campanha</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Spend</th>
                  <th className="px-2 py-2 text-right">CTR</th>
                  <th className="px-2 py-2 text-right">CPA</th>
                  <th className="px-2 py-2 text-right">ROAS</th>
                  <th className="px-2 py-2 text-right">Gap</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.campaignId} className="border-b border-zinc-900 text-zinc-200">
                    <td className="px-2 py-2">
                      <p>{campaign.campaignName}</p>
                      <p className="text-xs text-zinc-500">act_{campaign.campaignExternalId}</p>
                    </td>
                    <td className="px-2 py-2">{campaign.status ?? "-"}</td>
                    <td className="px-2 py-2 text-right">R$ {campaign.spend.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-2 text-right">{campaign.ctr.toFixed(2)}%</td>
                    <td className="px-2 py-2 text-right">R$ {campaign.cpa.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-2 text-right">{campaign.roas.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{campaign.conversionGap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">Automacoes de campanha</h2>
        {automations.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">Nenhuma automacao criada ainda.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {automations.map((automation) => (
              <div key={automation.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{automation.name}</p>
                    <p className="text-xs text-zinc-400">
                      {automation.runTimes.join(", ")} | {automation.scope} | {automation.preset}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={automation.enabled ? "good" : "warn"}>{automation.enabled ? "Ativa" : "Pausada"}</Badge>
                    <Button size="sm" variant="secondary" onClick={() => void toggleAutomation(automation)}>
                      {automation.enabled ? "Pausar" : "Ativar"}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void deleteAutomation(automation.id)}>
                      Excluir
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Ultima execucao: {automation.lastRunAt ? new Date(automation.lastRunAt).toLocaleString("pt-BR") : "Nunca"}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4">
          <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto border-cyan-400/30">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-zinc-100">Otimizar campanhas automatico</h3>
              <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>
                Fechar
              </Button>
            </div>

            <form className="mt-4 space-y-5" onSubmit={handleCreateAutomation}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-xs text-zinc-400">
                  <span>Nome da automacao</span>
                  <input
                    className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </label>
                <label className="space-y-1 text-xs text-zinc-400">
                  <span>Timezone</span>
                  <input
                    className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                  />
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Horarios do dia</p>
                <div className="space-y-2">
                  {runTimes.map((time, index) => (
                    <div key={`${time}-${index}`} className="flex items-center gap-2">
                      <input
                        type="time"
                        className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                        value={time}
                        onChange={(event) => updateRunTime(index, event.target.value)}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => removeRunTime(index)}
                        disabled={runTimes.length <= 1}
                      >
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={addRunTime}>
                  + Adicionar horario
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Qual estilo de otimizacao voce quer?</p>
                <select
                  className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                  value={preset}
                  onChange={(event) => setPreset(event.target.value as (typeof presetOptions)[number]["value"])}
                >
                  {presetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} - {option.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Escopo</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-left text-sm ${scope === "ALL_ACTIVE" ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-zinc-700 bg-zinc-950 text-zinc-300"}`}
                    onClick={() => setScope("ALL_ACTIVE")}
                  >
                    Otimizar todas as campanhas ativas
                  </button>
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-left text-sm ${scope === "SELECTED" ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-zinc-700 bg-zinc-950 text-zinc-300"}`}
                    onClick={() => setScope("SELECTED")}
                  >
                    Otimizar campanhas selecionadas
                  </button>
                </div>

                {scope === "SELECTED" ? (
                  <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                    {campaigns.map((campaign) => (
                      <label key={campaign.campaignId} className="flex items-center gap-2 text-sm text-zinc-200">
                        <input
                          type="checkbox"
                          checked={selectedCampaignIds.includes(campaign.campaignId)}
                          onChange={() => toggleCampaignSelection(campaign.campaignId)}
                        />
                        <span>{campaign.campaignName}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-xs text-zinc-400">
                  <span>Min spend (R$)</span>
                  <input
                    type="number"
                    className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                    value={minSpend}
                    onChange={(event) => setMinSpend(event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-xs text-zinc-400">
                  <span>ROAS alvo</span>
                  <input
                    type="number"
                    step="0.1"
                    className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                    value={targetRoas}
                    onChange={(event) => setTargetRoas(event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-xs text-zinc-400">
                  <span>CPA maximo (R$)</span>
                  <input
                    type="number"
                    className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                    value={maxCpa}
                    onChange={(event) => setMaxCpa(event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-xs text-zinc-400">
                  <span>Max aumento budget (%)</span>
                  <input
                    type="number"
                    className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                    value={maxBudgetIncreasePercent}
                    onChange={(event) => setMaxBudgetIncreasePercent(event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-xs text-zinc-400">
                  <span>Max reducao budget (%)</span>
                  <input
                    type="number"
                    className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                    value={maxBudgetDecreasePercent}
                    onChange={(event) => setMaxBudgetDecreasePercent(event.target.value)}
                  />
                </label>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200">
                  <input type="checkbox" checked={pauseLosers} onChange={(event) => setPauseLosers(event.target.checked)} />
                  Pausar/reduzir campanhas ruins
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200">
                  <input type="checkbox" checked={scaleWinners} onChange={(event) => setScaleWinners(event.target.checked)} />
                  Escalar campanhas vencedoras
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    checked={refreshCreativeAlerts}
                    onChange={(event) => setRefreshCreativeAlerts(event.target.checked)}
                  />
                  Alertar fadiga criativa
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    checked={trackingConsistencyCheck}
                    onChange={(event) => setTrackingConsistencyCheck(event.target.checked)}
                  />
                  Detectar inconsistencia de tracking
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Criar automacao"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}



