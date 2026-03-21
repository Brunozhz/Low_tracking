# Arquitetura - Low Tracking

## Visão Geral
Plataforma SaaS multi-workspace para tracking de campanhas, atribuição, conciliação Meta Ads x dados reais e otimização orientada por IA.

## Stack Final
- Frontend + Backend: Next.js 16 (App Router + Route Handlers)
- Banco: PostgreSQL
- ORM: Prisma
- Auth: NextAuth (Auth.js) com Credentials + Adapter Prisma
- UI: Tailwind CSS + componentes utilitários estilo shadcn
- Gráficos: Recharts (base instalada)
- Fila/Jobs: BullMQ + Redis
- IA: OpenAI SDK (fallback em regras determinísticas)
- Deploy: Docker (local/prod), compatível com Vercel para web/API e worker separado

## Módulos
1. Auth + RBAC
2. Workspace / Project multi-tenant
3. Link Manager (UTM + custom params + slug curto)
4. Tracking Ingestion (API key, evento, sessão, visitante)
5. Atribuição (first-touch / last-touch)
6. Meta Connector (sync em fila)
7. Rule Engine + Insight Engine (recomendações e alertas)
8. Dashboards e Central de Otimizações
9. Auditoria, logs, webhooks e feature flags

## Fluxo de Dados
1. Link curto (`/r/:slug`) captura parâmetros de origem e registra clique.
2. API de eventos (`/api/track/event`) recebe eventos server-side via API key.
3. Serviço de tracking consolida visitante, sessão, touchpoint, evento e conversão.
4. Worker sincroniza métricas Meta Ads por conta/anúncio diariamente.
5. Worker de insights avalia regras e grava alertas/recomendações/insights.
6. Dashboard e Otimizações consomem dados consolidados no PostgreSQL.

## Segurança e Observabilidade
- API key com hash SHA-256 e escopo por projeto
- Webhook assinado via HMAC
- Session auth via NextAuth
- Logs estruturados com Pino
- Tabela de `AuditLog`, `SyncLog` e `WebhookDelivery`

## Escalabilidade
- Prisma schema orientado a índices por `projectId`/tempo
- Jobs assíncronos para sync e IA
- Domínio desacoplado para integração Meta e regras IA
- Feature flags por workspace para habilitar módulos premium

