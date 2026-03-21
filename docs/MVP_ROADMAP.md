# Roadmap Técnico do MVP

## Fase 1 - Planejamento Técnico (concluída)
- Definição da arquitetura multi-tenant
- Definição da stack final
- Modelagem de dados para tracking + Meta + IA + auditoria
- Estratégia de filas, segurança e escalabilidade

## Fase 2 - Estrutura do Projeto (concluída)
- Scaffold Next.js + Tailwind
- Prisma + schema completo
- NextAuth + cadastro/login
- Docker Compose (Postgres + Redis)
- API routes base (health, links, tracking, webhook, sync)
- Workers (meta sync e insights)

## Fase 3 - Implementação Core (próxima)
1. Fechar módulo de recuperação de senha
2. CRUD completo de workspace/projeto
3. UI completa de gerador/gestor de links
4. Captura client-side de UTM + script opcional de pixel próprio
5. Dashboard com Recharts e filtros por período/campanha
6. Conector OAuth Meta Ads e import completo de entities

## Fase 4 - IA e Otimização
1. Aprimorar regras e scores dinâmicos
2. Painel "O que fazer agora"
3. Resumo diário/semanal automatizado
4. Alertas inteligentes com deduplicação
5. Sugestão de redistribuição de orçamento

## Fase 5 - Produção
1. Hardening de segurança
2. Otimização de performance SQL
3. Rate limiting e idempotência avançada
4. Observabilidade com tracing
5. Documentação de operação e deploy

