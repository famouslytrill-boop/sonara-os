export type ExportBundleFile = Readonly<{
  path: string;
  kind: string;
  contentType: string;
  content: string;
}>;

export type ExportBundleInput = Readonly<{
  bundleId?: string;
  files?: readonly ExportBundleFile[];
  createdAt?: string;
}>;

export type ProvenanceInput = Readonly<{
  session?: unknown;
  analysis?: unknown;
  compose?: unknown;
  decisionResult?: unknown;
  generatedAt?: string;
}>;

export type ExportBundle = Readonly<{
  bundleId: string;
  files: readonly ExportBundleFile[];
  createdAt: string;
}>;

export function createProvenanceFiles({
  session,
  analysis,
  compose,
  decisionResult,
  generatedAt = new Date().toISOString()
}: ProvenanceInput = {}): readonly ExportBundleFile[] {
  return Object.freeze([
    createJsonFile("provenance/session.json", {
      kind: "session",
      generatedAt,
      data: session ?? null
    }),
    createJsonFile("provenance/analysis.json", {
      kind: "analysis",
      generatedAt,
      data: analysis ?? null
    }),
    createJsonFile("provenance/compose.json", {
      kind: "compose",
      generatedAt,
      data: compose ?? null
    }),
    createJsonFile("provenance/decision-result.json", {
      kind: "decision-result",
      generatedAt,
      data: decisionResult ?? null
    })
  ]);
}

export function attachProvenanceFiles<TBundle extends ExportBundleInput>(
  bundle: TBundle,
  provenanceInput: ProvenanceInput = {}
): Readonly<TBundle & { files: readonly ExportBundleFile[] }> {
  const files: readonly ExportBundleFile[] = Array.isArray(bundle?.files) ? bundle.files : [];
  const provenanceFiles = createProvenanceFiles(provenanceInput);
  const manifest = createJsonFile("provenance/manifest.json", {
    kind: "provenance-manifest",
    fileCount: files.length + provenanceFiles.length,
    files: [...files, ...provenanceFiles].map((file) => ({
      path: file.path,
      kind: file.kind
    }))
  });

  return Object.freeze({
    ...bundle,
    files: Object.freeze([...files, ...provenanceFiles, manifest])
  }) as Readonly<TBundle & { files: readonly ExportBundleFile[] }>;
}

export function createExportBundle({
  bundleId,
  files = [],
  provenance
}: ExportBundleInput & { bundleId: string; provenance?: ProvenanceInput }): ExportBundle {
  if (!bundleId) {
    throw new Error("Export bundle requires bundleId.");
  }

  return attachProvenanceFiles(
    {
      bundleId,
      files: Object.freeze(Array.from(files)),
      createdAt: new Date().toISOString()
    },
    provenance ?? {}
  );
}

function createJsonFile(path: string, value: unknown): ExportBundleFile {
  return Object.freeze({
    path,
    kind: "provenance",
    contentType: "application/json",
    content: JSON.stringify(value, null, 2)
  });
}
