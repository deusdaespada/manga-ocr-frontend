import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cloud, KeyRound, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { api } from "../lib/api";
import type { Project, Stats } from "../lib/types";
import { Button } from "../components/ui/button";
import StatsCards from "../components/dashboard/StatsCards";
import FolderView from "../components/dashboard/FolderView";
import MangaLibTokenModal from "../components/project/MangaLibTokenModal";

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncingR2, setSyncingR2] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [tokenConnected, setTokenConnected] = useState(false);

  useEffect(() => {
    api
      .getMangaLibToken()
      .then((res) => setTokenConnected(res.connected === true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;

    api
      .getProjects()
      .then((projectsData) => {
        if (!active) return;
        setProjects(projectsData);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Erro ao carregar projetos");
      });

    api
      .getStats()
      .then((statsData) => {
        if (!active) return;
        setStats(statsData);
      })
      .catch(() => {
        /* erro de estatísticas não bloqueia a lista de mangás */
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleR2Sync() {
    setSyncingR2(true);
    try {
      const preview = await api.syncR2({
        mode: "all",
        dry_run: true,
        overwrite_local: false,
      });
      const skipped = preview.skipped_local_chapters.length;
      const warnings = preview.warnings.slice(0, 3).join("\n");
      const ok = confirm(
        [
          `Prévia R2: ${preview.scanned_projects} mangás, ${preview.created_projects} novo(s) projeto(s), ${preview.created_chapters} novo(s) capítulo(s).`,
          `${preview.updated_chapters} capítulo(s) serão atualizados, ${skipped} capítulo(s) locais serão mantidos.`,
          warnings ? `\nAvisos:\n${warnings}` : "",
          "\nDeseja iniciar a sincronização real?",
        ].join("\n")
      );
      if (!ok) return;

      const result = await api.syncR2({
        mode: "all",
        dry_run: false,
        overwrite_local: false,
      });
      const [statsData, projectsData] = await Promise.all([
        api.getStats(),
        api.getProjects(),
      ]);
      setStats(statsData);
      setProjects(projectsData);
      toast.success(
        `Sync R2: ${result.created_projects} projeto(s), ${result.created_chapters} capítulo(s) adicionados`
      );
      if (result.warnings.length > 0) {
        toast.info(`${result.warnings.length} aviso(s) encontrado(s)`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSyncingR2(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Painel</h1>
          <p className="page-description">Status do pipeline e estatísticas dos projetos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setTokenOpen(true)}
            title={
              tokenConnected
                ? "Token MangaLib conectado (18+)"
                : "Token MangaLib não conectado"
            }
          >
            <KeyRound className="h-3.5 w-3.5" />
            Token MangaLib
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                tokenConnected ? "bg-emerald-500" : "bg-muted-foreground/40"
              }`}
            />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={syncingR2}
            onClick={handleR2Sync}
          >
            {syncingR2 ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Cloud className="h-3.5 w-3.5" />
            )}
            Sync R2
          </Button>
          <Link to="/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Novo mangá
            </Button>
          </Link>
        </div>
      </div>

      <StatsCards stats={stats} />
      <FolderView projects={projects} error={error} />

      <MangaLibTokenModal
        open={tokenOpen}
        onClose={() => setTokenOpen(false)}
        onChanged={(s) => setTokenConnected(s.connected === true)}
      />
    </div>
  );
}
