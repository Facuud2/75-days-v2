import { localChallengeDate } from '../src/utils/challengeDate';

const cases: Array<{ desc: string; offset?: number; iso: string; expected: string }> = [
  { desc: 'Argentina 23:30 (UTC 02:30 del día siguiente)', offset: 180, iso: '2026-11-14T02:30:00Z', expected: '2026-11-13' },
  { desc: 'Argentina 21:30 (UTC 00:30 del día siguiente)', offset: 180, iso: '2026-11-14T00:30:00Z', expected: '2026-11-13' },
  { desc: 'Argentina 10:00 (UTC 13:00 mismo día)', offset: 180, iso: '2026-11-13T13:00:00Z', expected: '2026-11-13' },
  { desc: 'UTC exacto', offset: 0, iso: '2026-11-14T00:30:00Z', expected: '2026-11-14' },
  { desc: 'Kiritimati UTC+14 (14:00 local del 14)', offset: -840, iso: '2026-11-14T00:00:00Z', expected: '2026-11-14' },
  { desc: 'Los Ángeles UTC-8 (16:30 del 13)', offset: 480, iso: '2026-11-14T00:30:00Z', expected: '2026-11-13' },
  { desc: 'sin offset = UTC', offset: undefined, iso: '2026-11-14T00:30:00Z', expected: '2026-11-14' },
];

let pass = 0;
for (const c of cases) {
  const got = localChallengeDate(c.offset, new Date(c.iso));
  const ok = got === c.expected;
  if (ok) pass += 1;
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${c.desc}: ${got} (esperado ${c.expected})`);
}
console.log(`\n${pass}/${cases.length} casos correctos`);
