import { describe, expect, it, vi } from 'vitest';

import type { AdoTransport } from '../transport';
import { getWorkItems } from './work-items';

describe('getWorkItems', () => {
  it('drops null entries returned by errorPolicy=omit', async () => {
    const request = vi.fn().mockResolvedValue({
      data: {
        count: 3,
        value: [{ id: 1, fields: {} }, null, { id: 3, fields: {} }],
      },
      inspection: undefined,
    });
    const transport = {
      getProject: () => 'Project',
      request,
    } as unknown as AdoTransport;

    const result = await getWorkItems(transport, { ids: [1, 2, 3] });

    expect(request).toHaveBeenCalledOnce();
    expect(result.data.map((item) => item.id)).toEqual([1, 3]);
  });
});
