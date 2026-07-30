function Placeholder({ title, step }: { title: string; step: number }) {
  return (
    <main id="main-content" className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Implemented in Step {step}.</p>
    </main>
  );
}

export default function MetadataPage() {
  return <Placeholder title="Metadata" step={11} />;
}
