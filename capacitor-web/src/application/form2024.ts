/** 2024-12-03 form only. Snapshot of measured answer rectangles on the
 * 778 x 1100 reference grid; changes from 2019 were checked against page renders.
 * Pages 3 and 12 differ. Never substitute another PDF revision silently. */
import layout from './form2024Placements.json' with { type: 'json' };
import type { Placement } from '../export/placements.ts';
export const formRevision = '2024-12-03';
export const placements = layout as unknown as Record<string, Placement>;
/** Printed rule positions checked on pages 19 and 20 of the 2024 form. */
export const statementSlots = [
  ...Array.from({length:8},(_,i)=>({page:19,row:5+i,bottom:551.28+i*31.56})),
  ...[99.12,129.48,159.72,190.08,220.32,250.56,280.92,311.16,341.52,371.76,402.12,432.36,462.6,492.96,523.2,553.56,583.8,614.04,644.4,674.64,705,735.24]
    .map((bottom,i)=>({page:20,row:1+i,bottom})),
];
