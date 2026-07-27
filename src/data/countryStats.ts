/**
 * Baseline real-world figures, one row per country in `world.json`.
 *
 * Columns: ISO-numeric id | population (millions) | nominal GDP ($bn) |
 *          active military personnel (thousands) | defence budget ($bn)
 *
 * Approximate 2024/25 values compiled from the usual public sources
 * (Wikipedia's list of countries by population / GDP / military expenditure
 * and the IISS Military Balance figures those articles cite). They are here to
 * give each country a plausible relative weight, not to be authoritative — the
 * game only ever cares about the ratios between them.
 *
 * Three de-facto states carry synthetic ids (X01 Kosovo, X02 N. Cyprus,
 * X03 Somaliland) because Natural Earth gives them no ISO code.
 */
const TABLE = `
242 0.93 5.5 3.5 0.06
834 67 79 27 0.9
732 0.6 0.9 6 0.05
124 40 2240 68 30
840 335 29200 1330 916
398 20 262 39 1.6
860 36 102 48 1.4
598 10.3 31 3.6 0.1
360 281 1400 400 10.6
032 46 640 76 3.1
152 19.6 330 77 5.6
180 105 70 134 0.7
706 18 12 20 0.15
404 55 108 24 1.2
729 48 110 105 2.5
148 18 13 35 0.4
332 11.7 25 2 0.05
214 11.3 127 57 0.7
643 144 2180 1320 149
044 0.4 14 1.5 0.07
238 0.004 0.3 1.2 0.02
578 5.5 500 26 8.7
304 0.057 3.2 0.5 0.02
626 1.4 2 2.5 0.03
710 63 400 73 3.1
426 2.3 2.3 2 0.05
484 130 1850 262 9.5
858 3.4 82 22 0.9
076 213 2330 366 22.9
068 12.4 46 34 0.6
604 34 283 81 2.8
170 52 418 293 10.5
591 4.5 88 3 0.1
188 5.2 96 0.5 0.4
558 6.9 18 12 0.09
340 10.6 36 16 0.4
222 6.3 36 25 0.4
320 18.4 112 22 0.4
084 0.42 3.4 1.5 0.03
862 28.5 106 123 0.8
328 0.83 25 4 0.1
740 0.63 4.4 2 0.05
250 68.5 3170 205 64
218 18.1 121 40 2.4
630 3.2 117 1 0.05
388 2.8 20 4 0.15
192 11 107 49 0.1
716 16.6 35 29 0.35
072 2.7 20 9 0.5
516 3 13 12 0.5
686 18.4 31 19 0.5
466 23.6 21 33 0.6
478 5 11 16 0.2
204 14.5 20 12 0.1
562 27 17 30 0.3
566 229 199 223 3.2
120 29 51 45 0.4
768 9.5 9.5 9 0.1
288 34 76 16 0.25
384 32 86 25 0.6
324 14.8 24 12 0.4
624 2.2 2 4 0.03
430 5.5 4.4 2 0.02
694 8.9 6.9 8.5 0.05
854 23.5 21 28 0.4
140 5.7 2.8 8 0.05
178 6.1 15 12 0.3
266 2.5 21 5 0.25
226 1.8 12 2 0.15
894 21 28 16 0.35
454 21 14 11 0.1
508 34 22 11 0.15
748 1.2 5 3 0.08
024 37 92 107 1.5
108 13.6 3 30 0.06
376 9.9 530 170 27
422 5.8 25 60 0.6
450 31 17 14 0.1
275 5.5 19 30 0.1
270 2.8 2.5 2.5 0.02
788 12.3 52 36 1.2
012 47 260 130 21.6
400 11.5 53 100 2.1
784 11 545 63 25
634 3.1 221 17 6
414 5 162 17 8.2
368 46 265 193 8
512 5.3 110 42 8
548 0.33 1.1 0.5 0.01
116 17.4 47 124 0.6
764 71.7 545 361 5.8
418 7.7 16 29 0.02
104 54.5 65 406 2.7
704 101 476 470 6.5
408 26.5 28 1280 4
410 51.7 1870 500 47.9
496 3.5 23 9 0.13
356 1450 3890 1460 86
050 173 451 163 4.3
064 0.79 3.1 8 0.1
524 29.7 43 96 0.5
586 251 375 654 10.2
004 42 17 150 0.3
762 10.6 13 9.5 0.1
417 7.2 14 11 0.15
795 7.5 82 37 0.3
364 92 435 610 10.3
760 25 21 130 1.8
051 3 25 45 1.4
752 10.6 620 24 12
112 9.1 73 48 0.8
804 37 190 900 64.8
616 37 860 202 35
040 9.2 517 22 4.5
348 9.6 223 41 3.2
498 2.5 17 6 0.1
642 19 380 71 8.5
440 2.9 82 23 2.3
428 1.9 47 17 1.3
233 1.4 43 7.7 1.4
276 84 4660 181 88
100 6.4 108 37 2.5
300 10.4 250 142 8.2
792 86 1340 355 25
008 2.8 26 8 0.5
191 3.85 87 15 1.5
756 8.9 940 21 6.3
442 0.67 89 0.9 0.6
056 11.8 660 25 8.3
528 18 1220 40 24
620 10.6 300 27 4.7
724 48.8 1730 122 24
372 5.3 560 8.5 1.4
540 0.27 10 1 0.05
090 0.82 1.7 0.5 0.01
554 5.2 253 9.3 3.2
036 27 1790 59 34
144 22 75 260 1.2
156 1410 18700 2035 296
158 23.4 775 169 19
380 59 2380 165 33
208 6 410 17 8.1
826 69 3590 185 82
352 0.39 32 0.25 0.03
031 10.2 78 126 3.8
268 3.7 33 37 0.5
608 116 470 163 4.4
458 35 445 113 4.2
096 0.46 15 7 0.4
705 2.1 74 7 1
246 5.6 310 24 7.3
703 5.4 140 19 2.3
203 10.9 340 27 4.6
232 3.7 2.6 200 0.1
392 124 4070 247 55
600 6.9 45 14 0.4
887 35 21 40 0.2
682 33 1100 257 75
X02 0.38 4.2 3.5 0.05
196 1.3 33 12 0.5
504 38 152 196 13
818 116 380 438 5.9
434 7.4 45 32 3
231 132 205 162 1
262 1.2 4.4 10 0.06
X03 5.7 3 15 0.1
800 50 55 45 1
646 14.3 14 33 0.15
070 3.2 28 9 0.18
807 1.8 16 8 0.2
688 6.6 82 28 1.6
499 0.62 8 2.4 0.11
X01 1.8 11 5 0.1
780 1.4 29 4.5 0.35
728 11.5 6 185 0.6
`;

export interface CountryStats {
  /** Population, in millions. */
  pop: number;
  /** Nominal GDP, in billions of USD. */
  gdp: number;
  /** Active-duty personnel, in thousands. */
  troops: number;
  /** Annual defence budget, in billions of USD. */
  budget: number;
}

export const COUNTRY_STATS: Record<string, CountryStats> = Object.fromEntries(
  TABLE.trim()
    .split('\n')
    .map((line) => {
      const [id, pop, gdp, troops, budget] = line.trim().split(/\s+/);
      return [id, { pop: +pop, gdp: +gdp, troops: +troops, budget: +budget }];
    }),
);

/**
 * A country's starting army size. Personnel and money both matter, but money
 * buys the equipment that actually decides fights, so it is weighted heavier.
 * Everyone keeps a token force so that no territory is a literal walkover.
 */
export function baseMilitary(s: CountryStats): number {
  return Math.max(2, s.troops * 0.5 + s.budget * 3);
}

/** Industrial output per second at game start. */
export function baseProduction(s: CountryStats): number {
  return Math.max(0.05, s.gdp / 100);
}

/**
 * Research output per second at game start. Driven by the size of the economy,
 * then scaled by how developed it is — a rich small country out-researches a
 * poor large one of the same total GDP.
 */
export function baseResearch(s: CountryStats): number {
  const perCapita = s.gdp / Math.max(0.01, s.pop); // $k per head
  const development = 0.5 + 0.5 * Math.min(2, perCapita / 20);
  return Math.max(0.01, (s.gdp / 600) * development);
}
