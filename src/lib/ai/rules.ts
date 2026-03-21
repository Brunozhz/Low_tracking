import { AlertType, PriorityLevel, RecommendationType } from "@prisma/client";

export type CampaignPerformanceSnapshot = {
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  conversionRate: number;
  frequency: number;
  conversionsMeta: number;
  conversionsReal: number;
  roas: number;
  trendCpa3d?: "up" | "stable" | "down";
};

export type GeneratedRecommendation = {
  type: RecommendationType;
  title: string;
  reason: string;
  impactSummary: string;
  actionSuggested: string;
  priority: PriorityLevel;
  priorityScore: number;
  confidenceScore: number;
  data: Record<string, unknown>;
};

export function evaluateCampaignSnapshot(input: CampaignPerformanceSnapshot) {
  const recommendations: GeneratedRecommendation[] = [];
  const alerts: Array<{
    type: AlertType;
    title: string;
    message: string;
    priority: PriorityLevel;
    metricName: string;
    metricValue: number;
    threshold: number;
  }> = [];

  if (input.ctr >= 1.5 && input.cpc <= 2.5 && input.conversionRate < 0.7) {
    recommendations.push({
      type: RecommendationType.FIX_FUNNEL,
      title: `CTR bom e conversão baixa em ${input.campaignName}`,
      reason: "O anúncio gera clique, mas o tráfego não avança no funil.",
      impactSummary: "Reduzir desperdício em tráfego com baixa intenção.",
      actionSuggested: "Revisar página de destino, oferta e eventos de tracking.",
      priority: PriorityLevel.HIGH,
      priorityScore: 86,
      confidenceScore: 0.82,
      data: input,
    });
  }

  if (input.trendCpa3d === "up" && input.frequency > 2.6) {
    recommendations.push({
      type: RecommendationType.REFRESH_CREATIVE,
      title: `CPA em alta e frequência elevada em ${input.campaignName}`,
      reason: "Sinal típico de saturação criativa e fadiga de público.",
      impactSummary: "Recuperar eficiência de aquisição em 3-7 dias.",
      actionSuggested: "Trocar criativo e testar novo público lookalike.",
      priority: PriorityLevel.HIGH,
      priorityScore: 88,
      confidenceScore: 0.84,
      data: input,
    });
  }

  if (input.roas >= 2.5 && input.cpa <= 70 && input.conversionRate >= 1.5) {
    recommendations.push({
      type: RecommendationType.SCALE_CAMPAIGN,
      title: `Campanha pronta para escalar: ${input.campaignName}`,
      reason: "Eficiência sustentada com ROAS e CPA saudáveis.",
      impactSummary: "Aumento de receita com risco controlado.",
      actionSuggested: "Subir orçamento de 20% a cada 72h.",
      priority: PriorityLevel.MEDIUM,
      priorityScore: 74,
      confidenceScore: 0.78,
      data: input,
    });
  }

  const conversionGap = input.conversionsMeta - input.conversionsReal;
  if (conversionGap >= Math.max(5, input.conversionsMeta * 0.25)) {
    recommendations.push({
      type: RecommendationType.FIX_TRACKING,
      title: `Divergência Meta x real em ${input.campaignName}`,
      reason: "A diferença sugere falha de atribuição, deduplicação ou evento perdido.",
      impactSummary: "Melhora de confiabilidade para decisões de verba.",
      actionSuggested: "Auditar deduplicação, event_id, fbp/fbc e webhook de compra.",
      priority: PriorityLevel.CRITICAL,
      priorityScore: 95,
      confidenceScore: 0.9,
      data: {
        ...input,
        conversionGap,
      },
    });

    alerts.push({
      type: AlertType.TRACKING_INCONSISTENCY,
      title: `Tracking inconsistente em ${input.campaignName}`,
      message: `Meta reporta ${input.conversionsMeta} conversões e o sistema real ${input.conversionsReal}.`,
      priority: PriorityLevel.CRITICAL,
      metricName: "conversion_gap",
      metricValue: conversionGap,
      threshold: 5,
    });
  }

  if (input.cpa > 150) {
    alerts.push({
      type: AlertType.CPA_SPIKE,
      title: `CPA elevado em ${input.campaignName}`,
      message: "O CPA ultrapassou o limite aceitável definido para o projeto.",
      priority: PriorityLevel.HIGH,
      metricName: "cpa",
      metricValue: input.cpa,
      threshold: 150,
    });
  }

  if (input.ctr < 0.7) {
    alerts.push({
      type: AlertType.CTR_DROP,
      title: `CTR baixo em ${input.campaignName}`,
      message: "Queda de interesse criativo e provável perda de qualidade de tráfego.",
      priority: PriorityLevel.MEDIUM,
      metricName: "ctr",
      metricValue: input.ctr,
      threshold: 0.7,
    });
  }

  return { recommendations, alerts };
}

