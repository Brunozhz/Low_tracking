# Low Tracking

SaaS de tracking e otimização de campanhas para Meta Ads, com foco em atribuição real e recomendações com IA.

## Requisitos
- Node.js 22+
- Docker + Docker Compose

## Subida local
1. `docker compose up -d`
2. `npm install`
3. `cp .env.example .env` (ajuste secrets)
4. `npm run db:push`
5. `npm run seed`
6. `npm run dev`

Worker (em outro terminal):
- `npm run worker`

## Endpoints iniciais
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/track/event`
- `GET|POST /api/links`
- `POST /api/meta/sync`
- `POST /api/webhooks/events`
- `GET /r/:slug`

## Acesso inicial
Após seed, use as credenciais exibidas no terminal.

