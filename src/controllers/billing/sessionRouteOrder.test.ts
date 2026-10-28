import { expect, it } from 'vitest';
import fs from 'fs';
import express from 'express';

it('routes endsession to the static close handler rather than the ID handler', () => {
    const source = fs.readFileSync('src/controllers/billing/index.ts', 'utf8');
    const router = express.Router();
    for (const match of source.matchAll(/router\.put\("(\/api\/v1\/billing\/sales\/session\/(?:\:sessionId|endsession))",/g)) {
        router.put(match[1], () => {});
    }
    const matching = (router as any).stack.filter((layer: any) =>
        layer.route.methods.put && layer.match('/api/v1/billing/sales/session/endsession'));
    expect(matching[0].route.path).toBe('/api/v1/billing/sales/session/endsession');
    expect(matching[1].route.path).toBe('/api/v1/billing/sales/session/:sessionId');
});
