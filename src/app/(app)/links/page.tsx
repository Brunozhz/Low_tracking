"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type WorkspaceItem = {
  id: string;
  name: string;
  slug: string;
  role: string;
  plan: string;
  projectCount: number;
};

type ProjectItem = {
  id: string;
  name: string;
  slug: string;
  attributionModel: "FIRST_TOUCH" | "LAST_TOUCH";
};

type LinkItem = {
  id: string;
  name: string;
  slug: string;
  finalUrl: string;
  destinationUrl: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  createdAt: string;
};

function parseCustomParams(input: string) {
  const output: Record<string, string> = {};
  const parts = input
    .split("&")
    .map((item) => item.trim())
    .filter(Boolean);

  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    const cleanKey = (key ?? "").trim();
    const cleanValue = rest.join("=").trim();

    if (cleanKey && cleanValue) {
      output[cleanKey] = cleanValue;
    }
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

export default function LinksPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [workspaceName, setWorkspaceName] = useState("");
  const [projectName, setProjectName] = useState("");

  const [name, setName] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const [utmTerm, setUtmTerm] = useState("");
  const [tags, setTags] = useState("");
  const [customParams, setCustomParams] = useState("");
  const [search, setSearch] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkspaces() {
    const response = await fetch("/api/workspaces", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error ?? "Falha ao carregar workspaces.");
    }

    const items = (data.workspaces ?? []) as WorkspaceItem[];
    setWorkspaces(items);

    if (items.length > 0) {
      setSelectedWorkspaceId((current) => current || items[0].id);
    }
  }

  async function loadProjects(workspaceId: string) {
    const response = await fetch(`/api/projects?workspaceId=${workspaceId}`, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error ?? "Falha ao carregar projetos.");
    }

    const items = (data.projects ?? []) as ProjectItem[];
    setProjects(items);

    if (items.length > 0) {
      setSelectedProjectId((current) => {
        if (!current) {
          return items[0].id;
        }

        const exists = items.some((item) => item.id === current);
        return exists ? current : items[0].id;
      });
      return;
    }

    setSelectedProjectId("");
    setLinks([]);
  }

  async function loadLinks(projectId: string) {
    const response = await fetch(`/api/links?projectId=${projectId}`, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error ?? "Falha ao carregar links.");
    }

    setLinks((data.links ?? []) as LinkItem[]);
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        setError(null);
        await loadWorkspaces();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dados iniciais.");
      } finally {
        setIsLoading(false);
      }
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      return;
    }

    async function syncProjects() {
      try {
        setError(null);
        await loadProjects(selectedWorkspaceId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar projetos.");
      }
    }

    void syncProjects();
  }, [selectedWorkspaceId]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    async function syncLinks() {
      try {
        setError(null);
        await loadLinks(selectedProjectId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar links.");
      }
    }

    void syncLinks();
  }, [selectedProjectId]);

  const filteredLinks = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return links;
    }

    return links.filter((link) => {
      const values = [link.name, link.slug, link.utmCampaign ?? "", link.utmSource ?? "", link.utmMedium ?? ""];
      return values.some((value) => value.toLowerCase().includes(term));
    });
  }, [links, search]);

  async function handleCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceName.trim()) {
      return;
    }

    setIsCreatingWorkspace(true);
    setError(null);

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "N?o foi poss?vel criar workspace.");
      }

      setWorkspaceName("");
      await loadWorkspaces();

      if (data.workspace?.id) {
        setSelectedWorkspaceId(data.workspace.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar workspace.");
    } finally {
      setIsCreatingWorkspace(false);
    }
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!projectName.trim() || !selectedWorkspaceId) {
      return;
    }

    setIsCreatingProject(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: selectedWorkspaceId,
          name: projectName.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "N?o foi poss?vel criar projeto.");
      }

      setProjectName("");
      await loadProjects(selectedWorkspaceId);

      if (data.project?.id) {
        setSelectedProjectId(data.project.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar projeto.");
    } finally {
      setIsCreatingProject(false);
    }
  }

  async function handleCreateLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProjectId) {
      setError("Selecione um projeto antes de criar links.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          name: name.trim(),
          destinationUrl: destinationUrl.trim(),
          utmSource: utmSource.trim() || undefined,
          utmMedium: utmMedium.trim() || undefined,
          utmCampaign: utmCampaign.trim() || undefined,
          utmContent: utmContent.trim() || undefined,
          utmTerm: utmTerm.trim() || undefined,
          customParams: parseCustomParams(customParams),
          tags: tags
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "N?o foi poss?vel criar o link.");
      }

      setName("");
      setDestinationUrl("");
      setUtmSource("");
      setUtmMedium("");
      setUtmCampaign("");
      setUtmContent("");
      setUtmTerm("");
      setTags("");
      setCustomParams("");

      await loadLinks(selectedProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar link.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <p className="text-sm text-zinc-300">Carregando opera??o...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Gestor de links</p>
        <h1 className="text-3xl font-bold text-zinc-100">UTM Builder + Tracking Links</h1>
        <p className="text-sm text-zinc-400">Crie links rastre?veis, organize por projeto e filtre rapidamente.</p>
      </section>

      {error ? (
        <Card className="border-red-400/40 bg-red-900/20 text-red-100">
          <p className="text-sm">{error}</p>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">Workspace</h2>
          <div className="mt-3 space-y-3">
            <select
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              value={selectedWorkspaceId}
              onChange={(event) => setSelectedWorkspaceId(event.target.value)}
            >
              {workspaces.length === 0 ? <option value="">Nenhum workspace</option> : null}
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name} ({workspace.projectCount} projetos)
                </option>
              ))}
            </select>

            <form className="flex gap-2" onSubmit={handleCreateWorkspace}>
              <input
                className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                placeholder="Novo workspace"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
              />
              <Button type="submit" size="sm" disabled={isCreatingWorkspace}>
                {isCreatingWorkspace ? "Criando..." : "Criar"}
              </Button>
            </form>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">Projeto</h2>
          <div className="mt-3 space-y-3">
            <select
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
            >
              {projects.length === 0 ? <option value="">Nenhum projeto</option> : null}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.attributionModel})
                </option>
              ))}
            </select>

            <form className="flex gap-2" onSubmit={handleCreateProject}>
              <input
                className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                placeholder="Novo projeto"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                disabled={!selectedWorkspaceId}
              />
              <Button type="submit" size="sm" disabled={!selectedWorkspaceId || isCreatingProject}>
                {isCreatingProject ? "Criando..." : "Criar"}
              </Button>
            </form>
          </div>
        </Card>
      </section>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">Criar link rastre?vel</h2>

        <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleCreateLink}>
          <input
            className="h-10 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
            placeholder="Nome do link"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <input
            className="h-10 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 md:col-span-2"
            placeholder="URL destino (https://...)"
            value={destinationUrl}
            onChange={(event) => setDestinationUrl(event.target.value)}
            required
          />
          <input
            className="h-10 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
            placeholder="utm_source"
            value={utmSource}
            onChange={(event) => setUtmSource(event.target.value)}
          />
          <input
            className="h-10 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
            placeholder="utm_medium"
            value={utmMedium}
            onChange={(event) => setUtmMedium(event.target.value)}
          />
          <input
            className="h-10 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
            placeholder="utm_campaign"
            value={utmCampaign}
            onChange={(event) => setUtmCampaign(event.target.value)}
          />
          <input
            className="h-10 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
            placeholder="utm_content"
            value={utmContent}
            onChange={(event) => setUtmContent(event.target.value)}
          />
          <input
            className="h-10 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
            placeholder="utm_term"
            value={utmTerm}
            onChange={(event) => setUtmTerm(event.target.value)}
          />
          <input
            className="h-10 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
            placeholder="tags (separadas por v?rgula)"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
          <input
            className="h-10 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 md:col-span-2"
            placeholder="params custom (ex: aff=bruno&canal=meta)"
            value={customParams}
            onChange={(event) => setCustomParams(event.target.value)}
          />

          <div className="md:col-span-2 xl:col-span-3">
            <Button type="submit" disabled={!selectedProjectId || isSaving}>
              {isSaving ? "Criando link..." : "Criar link"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">Links criados</h2>
          <input
            className="h-10 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 md:w-80"
            placeholder="Filtrar por nome, slug, campanha..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="mt-4 space-y-3">
          {filteredLinks.length === 0 ? (
            <p className="text-sm text-zinc-400">Nenhum link encontrado para esse projeto.</p>
          ) : (
            filteredLinks.map((link) => (
              <div key={link.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{link.name}</p>
                    <p className="text-xs text-zinc-400">slug: {link.slug}</p>
                    <p className="mt-1 text-xs text-zinc-500">destino: {link.destinationUrl}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void navigator.clipboard.writeText(link.finalUrl);
                    }}
                  >
                    Copiar URL final
                  </Button>
                </div>
                <p className="mt-2 break-all text-xs text-cyan-300">{link.finalUrl}</p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

