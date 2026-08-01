import { ImageResponse } from 'next/og';

import { APP_INFO } from '@core/constants';

export const alt = APP_INFO.name;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 72,
          background: 'linear-gradient(135deg, #0B1F3A 0%, #0078D4 55%, #4FC3F7 100%)',
          color: '#ffffff',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 96,
            height: 96,
            borderRadius: 24,
            background: 'rgba(255,255,255,0.95)',
            color: '#0078D4',
            fontSize: 42,
            fontWeight: 800,
            marginBottom: 36,
          }}
        >
          ADO
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>{APP_INFO.name}</div>
        <div
          style={{
            marginTop: 20,
            fontSize: 28,
            maxWidth: 900,
            lineHeight: 1.35,
            opacity: 0.95,
          }}
        >
          Daily companion for Azure DevOps tasks
        </div>
      </div>
    ),
    { ...size },
  );
}
