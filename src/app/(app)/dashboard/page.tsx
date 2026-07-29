import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
};

/** Route shell reserved for Step 6. */
export default function DashboardPage() {
  return (
    <main id="main-content" className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground mt-2 text-sm">Implemented in Step 6.</p>
    </main>
  );
}
