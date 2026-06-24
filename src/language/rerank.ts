import type { WordEntry, Candidate } from "../types";
import type { LanguageMode, LanguageScore } from "./types";

export function applyLanguageScores(
  candidates: Candidate[],
  scores: LanguageScore[],
  languageWeight: number,
): Candidate[] {
  const scoreByWord = new Map(scores.map((score) => [score.word, score]));
  const withGestureRanks = candidates.map((candidate, index) => ({
    ...candidate,
    gestureRank: index + 1,
  }));

  return withGestureRanks
    .map((candidate) => {
      const languageScore = scoreByWord.get(candidate.word) ?? {
        word: candidate.word,
        penalty: 0,
        model: "off",
      };

      return {
        ...candidate,
        score: candidate.gestureScore + languageWeight * languageScore.penalty,
        languagePenalty: languageScore.penalty,
        languageModel: languageScore.model,
      };
    })
    .sort((a, b) => a.score - b.score)
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
      rankDelta: candidate.gestureRank - (index + 1),
    }));
}

export function scoreWithUnigram(
  candidates: Candidate[],
  entriesByWord: Map<string, WordEntry>,
): LanguageScore[] {
  return candidates.map((candidate) => ({
    word: candidate.word,
    penalty: -(entriesByWord.get(candidate.word)?.logFrequency ?? 0),
    model: "unigram",
  }));
}

export function languageModeLabel(mode: LanguageMode): string {
  switch (mode) {
    case "off":
      return "Off";
    case "unigram":
      return "Unigram";
    case "gpt2":
      return "GPT-2";
  }
}
