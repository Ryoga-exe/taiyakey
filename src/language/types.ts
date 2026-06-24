import type { Candidate } from "../types";

export type LanguageMode = "off" | "unigram" | "gpt2";

export type LanguageScore = {
  word: string;
  penalty: number;
  model: string;
};

export type LanguageStatus = "idle" | "loading" | "ready" | "error";

export type LanguageScoringOptions = {
  mode: LanguageMode;
  context: string;
  candidates: Candidate[];
  languageWeight: number;
};
