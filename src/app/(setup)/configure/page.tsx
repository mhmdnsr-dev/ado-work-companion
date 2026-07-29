import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Configure',
};

/**
 * Step 1 placeholder. The full configuration form lands in Step 2.
 */
export default function ConfigurePage() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-4 px-4 py-10"
    >
      <p className="text-muted-foreground text-sm tracking-wide uppercase">Azure DevOps</p>
      <h1 className="text-3xl font-semibold tracking-tight">API Explorer</h1>
      <p className="text-muted-foreground text-base leading-relaxed">
        Project structure is ready. Reply with <span className="text-foreground font-medium">Continue</span>{' '}
        to generate the configuration screen (Step 2).
      </p>
      <div
        className="border-border bg-card text-card-foreground rounded-lg border p-4 text-sm"
        role="status"
      >
        <p className="font-medium">Checkpoint: Step 1 complete</p>
        <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1">
          <li>Verified dependency matrix</li>
          <li>Feature-based + shared <code className="font-mono text-xs">src/core</code> layout</li>
          <li>Platform ports for HTTP and storage</li>
        </ul>
      </div>
    </main>
  );
}
