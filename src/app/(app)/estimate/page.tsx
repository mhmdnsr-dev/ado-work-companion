import type { Metadata } from 'next';

import { EstimateView } from '@/features/estimate';

export const metadata: Metadata = {
  title: 'Estimate',
  description:
    'Planning poker sessions for Azure DevOps work items, with a link to the Estimate hub.',
};

export default function EstimatePage() {
  return <EstimateView />;
}
