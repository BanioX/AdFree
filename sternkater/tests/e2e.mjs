import { runRetroE2E } from '../../lib/retro/tests/e2e-kit.mjs';
await runRetroE2E({ id: 'sternkater', port: process.env.PORT || 8765 });
