"use client";

import Link from "next/link";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { exportReleasePackage } from "../lib/api";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase";
import { deleteSonaraProject, listSonaraProjects, type SavedSonaraProject } from "../lib/sonara/projects/projectStore";
import { Button } from "./ui/Button";

export function ProjectLibrary() {
  const [projects, setProjects] = useState<SavedSonaraProject[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const configured = isSupabaseConfigured();

  async function loadProjects() {
    setIsLoading(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const session = await supabase?.auth.getSession();
      setSignedIn(Boolean(session?.data.session));
      setProjects(await listSonaraProjects());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load projects.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadProjects();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  async function downloadProject(project: SavedSonaraProject) {
    setMessage("Preparing export.");
    const blob = await exportReleasePackage(project.analysis);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.fingerprint_id.toLowerCase()}-release-kit.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Export downloaded.");
  }

  async function removeProject(projectId: string) {
    await deleteSonaraProject(projectId);
    await loadProjects();
  }

  if (!configured) {
    return (
      <div className="mt-6 rounded-lg border border-[#2A2A35] bg-[#111118] p-4 text-sm leading-6 text-[#A1A1AA]">
        Supabase is not configured yet. Saved projects will appear here after the Supabase project is connected and the launch schema is applied.
      </div>
    );
  }

  if (!signedIn && !isLoading) {
    return (
      <div className="mt-6 rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
        <p className="text-sm font-black text-[#F8FAFC]">Sign in to view saved projects.</p>
        <Link href="/login?redirect=/library" className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#8B5CF6] px-4 text-sm font-bold text-white">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-[#2A2A35] bg-[#111118] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[#F8FAFC]">Saved projects</p>
          <p className="mt-1 text-sm text-[#A1A1AA]">Private fingerprints, release plans, and export-ready bundles.</p>
        </div>
        <Button type="button" tone="secondary" onClick={loadProjects} disabled={isLoading}>
          <RefreshCw className={isLoading ? "animate-spin" : ""} size={16} />
          Refresh
        </Button>
      </div>

      <div className="mt-4 grid gap-3">
        {projects.length ? (
          projects.map((project) => (
            <div key={project.id} className="rounded-lg border border-[#2A2A35] bg-[#171720] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#F8FAFC]">{project.title}</p>
                  <p className="mt-1 text-xs font-bold uppercase text-[#22D3EE]">{project.fingerprint_id}</p>
                  <p className="mt-2 text-sm text-[#A1A1AA]">
                    {Math.round(project.readiness_score)}/100 · {project.launch_state}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" tone="secondary" onClick={() => downloadProject(project)}>
                    <Download size={16} />
                    Export
                  </Button>
                  <Button type="button" tone="ghost" onClick={() => removeProject(project.id)}>
                    <Trash2 size={16} />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-[#2A2A35] bg-[#171720] p-4 text-sm text-[#A1A1AA]">
            No saved projects yet. Run SONARA Core on the Create page, then save the result.
          </p>
        )}
      </div>

      {message ? <p className="mt-4 text-sm font-bold text-[#22C55E]">{message}</p> : null}
    </div>
  );
}
