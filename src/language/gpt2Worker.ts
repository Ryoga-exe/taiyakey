import {
  AutoModelForCausalLM,
  AutoTokenizer,
  env,
  log_softmax,
} from "@huggingface/transformers";
import type { LanguageScore } from "./types";

type WorkerRequest = {
  id: number;
  type: "score";
  context: string;
  words: string[];
};

type TokenizerOutput = {
  input_ids: {
    data: ArrayLike<number | bigint>;
    dims: number[];
  };
  [key: string]: unknown;
};

type ModelOutput = {
  logits: {
    data: ArrayLike<number>;
    dims: number[];
  };
};

type WorkerGlobal = {
  postMessage(message: unknown): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<WorkerRequest>) => void,
  ): void;
};

const worker = self as unknown as WorkerGlobal;
const MODEL_ID = "Xenova/distilgpt2";
const MAX_CONTEXT_CHARS = 240;

env.allowLocalModels = false;

let tokenizerPromise: Promise<unknown> | undefined;
let modelPromise: Promise<unknown> | undefined;

worker.addEventListener("message", (event) => {
  void handleRequest(event.data);
});

async function handleRequest(request: WorkerRequest): Promise<void> {
  if (request.type !== "score") return;

  try {
    postStatus(request.id, "loading", "Loading GPT-2");
    const [tokenizer, model] = await Promise.all([getTokenizer(), getModel()]);
    postStatus(request.id, "ready", "GPT-2 ready");

    const context = trimContext(request.context);
    const scores: LanguageScore[] = [];

    for (const word of request.words) {
      scores.push(await scoreWord(tokenizer, model, context, word));
    }

    worker.postMessage({
      id: request.id,
      type: "scores",
      scores,
    });
  } catch (error) {
    worker.postMessage({
      id: request.id,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function getTokenizer(): Promise<unknown> {
  tokenizerPromise ??= AutoTokenizer.from_pretrained(MODEL_ID);
  return tokenizerPromise;
}

async function getModel(): Promise<unknown> {
  modelPromise ??= AutoModelForCausalLM.from_pretrained(MODEL_ID, {
    dtype: "q4",
  });
  return modelPromise;
}

async function scoreWord(
  tokenizer: unknown,
  model: unknown,
  context: string,
  word: string,
): Promise<LanguageScore> {
  const prefix = context.trimEnd();
  const candidateText = prefix.length > 0 ? ` ${word}` : word;
  const fullText = `${prefix}${candidateText}`;
  const prefixTokens = encode(tokenizer, prefix);
  const fullTokens = encode(tokenizer, fullText);
  const candidateTokenStart = prefixTokens.input_ids.data.length;
  const candidateTokenIds = Array.from(fullTokens.input_ids.data).slice(
    candidateTokenStart,
  );

  if (candidateTokenIds.length === 0 || fullTokens.input_ids.data.length < 2) {
    return { word, penalty: 20, model: "gpt2" };
  }

  const output = (await (model as (input: TokenizerOutput) => Promise<ModelOutput>)(
    fullTokens,
  )) as ModelOutput;
  const logits = output.logits;
  const vocabSize = logits.dims[2];
  let logProbability = 0;
  let countedTokens = 0;

  for (let fullTokenIndex = candidateTokenStart; fullTokenIndex < fullTokens.input_ids.data.length; fullTokenIndex += 1) {
    if (fullTokenIndex === 0) continue;
    const targetTokenId = Number(fullTokens.input_ids.data[fullTokenIndex]);
    const logitsOffset = (fullTokenIndex - 1) * vocabSize;
    const tokenLogits = Array.from(logits.data).slice(
      logitsOffset,
      logitsOffset + vocabSize,
    );
    const tokenLogProbs = log_softmax(tokenLogits as number[]);
    logProbability += Number(tokenLogProbs[targetTokenId]);
    countedTokens += 1;
  }

  const averageNegativeLogProbability =
    countedTokens > 0 ? -logProbability / countedTokens : 20;

  return {
    word,
    penalty: averageNegativeLogProbability,
    model: "gpt2",
  };
}

function encode(tokenizer: unknown, text: string): TokenizerOutput {
  return (tokenizer as (input: string) => TokenizerOutput)(text);
}

function trimContext(context: string): string {
  return context.slice(-MAX_CONTEXT_CHARS);
}

function postStatus(id: number, status: string, message: string): void {
  worker.postMessage({
    id,
    type: "status",
    status,
    message,
  });
}
