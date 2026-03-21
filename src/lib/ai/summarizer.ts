import OpenAI from "openai";

import { env } from "@/lib/env";

export async function buildExecutiveSummary(input: {
  periodLabel: string;
  highlights: string[];
  risks: string[];
  actions: string[];
}) {
  if (!env.OPENAI_API_KEY) {
    return [
      `Resumo ${input.periodLabel}`,
      `Pontos fortes: ${input.highlights.join(" | ") || "Sem dados suficientes"}`,
      `Riscos: ${input.risks.join(" | ") || "Sem riscos críticos no período"}`,
      `Ações recomendadas: ${input.actions.join(" | ") || "Nenhuma ação prioritária"}`,
    ].join("\n");
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: env.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content:
          "Você é um analista de mídia de performance. Gere um resumo executivo curto, objetivo e acionável.",
      },
      {
        role: "user",
        content: `Período: ${input.periodLabel}\nDestaques: ${input.highlights.join("; ")}\nRiscos: ${input.risks.join("; ")}\nAções: ${input.actions.join("; ")}`,
      },
    ],
  });

  return response.output_text || "Sem resumo disponível";
}

