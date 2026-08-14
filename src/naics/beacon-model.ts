/**
 * TS port of BeaconModel's fitted-inference path (beacon/beacon.py L823-1100):
 * clean_text -> n-combs -> ensemble scoring -> hierarchical conditional
 * probability. Ported line-for-line against the Python source for §V6 parity.
 */
import { cleanText } from "./stem.ts";

export interface BeaconParams {
  freq_thresh: number;
  wt_umb: number;
  wt_exact: number;
  naics: string[];
  sectors: string[];
  sample_sizes: Record<string, number>;
  sector_naics: Record<string, string[]>;
  // sparse: {sector: {ngram: {naicsCode: proportion}}}, nonzero entries only
  dict_ncombs_props: Record<string, Record<string, Record<string, number>>>;
  dict_ncombs_weights: Record<string, Record<string, number>>;
  dict_ems_props: Record<string, Record<string, Record<string, number>>>;
  dict_ems_weights: Record<string, Record<string, number>>;
}

export interface NaicsScore {
  naics: string;
  score: number;
}

function getNcombs(tokens: string[], n: 1 | 2 | 3): string[] {
  const uniq = [...new Set(tokens)].sort();
  const ncombs: string[] = [];
  if (n === 1 && uniq.length >= 1 && uniq[0] !== "") {
    ncombs.push(...uniq);
  } else if (n === 2 && uniq.length >= 2) {
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) ncombs.push(`${uniq[i]}_${uniq[j]}`);
    }
  } else if (n === 3 && uniq.length >= 3) {
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        for (let k = j + 1; k < uniq.length; k++) ncombs.push(`${uniq[i]}_${uniq[j]}_${uniq[k]}`);
      }
    }
  }
  return ncombs;
}

function isProperSubset(a: Set<string>, b: Set<string>): boolean {
  if (a.size >= b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function getFeatsUmb(nc1s: string[], nc2s: string[], nc3s: string[]): string[] {
  const nc2Sets = nc2s.map((nc) => new Set(nc.split("_")));
  const nc3Sets = nc3s.map((nc) => new Set(nc.split("_")));
  const nc1sUmb = nc1s.filter((nc1) => nc2Sets.every((s) => !isProperSubset(new Set([nc1]), s)));
  const nc2sUmb = nc2s.filter((_, i) => nc3Sets.every((s) => !isProperSubset(nc2Sets[i], s)));
  return [...nc1sUmb, ...nc2sUmb, ...nc3s];
}

function normScores(scoresRaw: Record<string, number>): Record<string, number> {
  const total = Object.values(scoresRaw).reduce((a, b) => a + b, 0);
  if (total <= 0.0) return scoresRaw;
  const out: Record<string, number> = {};
  for (const naics in scoresRaw) out[naics] = scoresRaw[naics] / total;
  return out;
}

export class BeaconModel {
  private readonly params: BeaconParams;

  constructor(params: BeaconParams) {
    this.params = params;
  }

  private calcScoresNonexact(feats: string[], sector: string): Record<string, number> {
    const { sector_naics, dict_ncombs_weights, dict_ncombs_props } = this.params;
    const scores: Record<string, number> = {};
    for (const naics of sector_naics[sector]) scores[naics] = 0.0;
    for (const nc of feats) {
      const weight = dict_ncombs_weights[sector][nc];
      const props = dict_ncombs_props[sector][nc];
      for (const naics in props) scores[naics] += weight * props[naics];
    }
    return normScores(scores);
  }

  private calcScoresExact(feats: string[], xExact: string, sector: string): Record<string, number> {
    const { sector_naics, dict_ems_weights, dict_ems_props } = this.params;
    const scores: Record<string, number> = {};
    for (const naics of sector_naics[sector]) scores[naics] = 0.0;
    if (xExact in dict_ems_weights[sector]) {
      const props = dict_ems_props[sector][xExact];
      for (const naics in props) scores[naics] = props[naics];
    } else {
      for (const em of feats) {
        if (em in dict_ems_weights[sector]) {
          const weight = dict_ems_weights[sector][em];
          const props = dict_ems_props[sector][em];
          for (const naics in props) scores[naics] += weight * props[naics];
        }
      }
    }
    return normScores(scores);
  }

  private calcScoresEnsemble(tokens: string[], sector: string): Record<string, number> {
    const props = this.params.dict_ncombs_props[sector];
    const nc1s = getNcombs(tokens, 1).filter((nc) => nc in props);
    const nc2s = getNcombs(tokens, 2).filter((nc) => nc in props);
    const nc3s = getNcombs(tokens, 3).filter((nc) => nc in props);
    const xExact = [...new Set(nc1s)].sort().join("_");
    const featsStand = [...nc1s, ...nc2s, ...nc3s];
    const featsUmb = getFeatsUmb(nc1s, nc2s, nc3s);

    const scoresStand = this.calcScoresNonexact(featsStand, sector);
    const scoresUmb = this.calcScoresNonexact(featsUmb, sector);
    const scoresExact = this.calcScoresExact(featsStand, xExact, sector);

    const { wt_umb, wt_exact } = this.params;
    const scoresEnsemble: Record<string, number> = {};
    for (const naics in scoresStand) {
      scoresEnsemble[naics] =
        (1.0 - wt_umb - wt_exact) * scoresStand[naics] +
        wt_umb * scoresUmb[naics] +
        wt_exact * scoresExact[naics];
    }
    return normScores(scoresEnsemble);
  }

  private calcScoresHier(x: string): Record<string, number> {
    const tokens = cleanText(x).split(" ");
    const scoresDict: Record<string, Record<string, number>> = {};
    scoresDict["00"] = this.calcScoresEnsemble(tokens, "00");
    for (const sector of this.params.sectors) {
      scoresDict[sector] =
        scoresDict["00"][sector] > 0.0
          ? this.calcScoresEnsemble(tokens, sector)
          : Object.fromEntries(this.params.sector_naics[sector].map((n) => [n, 0.0]));
    }
    const scoresHier: Record<string, number> = {};
    for (const sector of this.params.sectors) {
      for (const naics in scoresDict[sector]) {
        scoresHier[naics] = scoresDict["00"][sector] * scoresDict[sector][naics];
      }
    }
    return normScores(scoresHier);
  }

  /** Full score distribution over all 6-digit NAICS codes, matching predict_proba(). */
  predictProba(text: string): Record<string, number> {
    return this.calcScoresHier(text);
  }

  /** Top-N codes with positive score, descending. */
  predictTopN(text: string, n = 10): NaicsScore[] {
    const scores = this.predictProba(text);
    return Object.entries(scores)
      .filter(([, score]) => score > 0.0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([naics, score]) => ({ naics, score }));
  }
}
