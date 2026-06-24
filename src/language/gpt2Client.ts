import type { Candidate } from "../types";
import type { LanguageScore, LanguageStatus } from "./types";

type WorkerRequest = {
  id: number;
  type: "score";
  context: string;
  words: string[];
};

type WorkerResponse =
  | {
      id: number;
      type: "scores";
      scores: LanguageScore[];
    }
  | {
      id: number;
      type: "status";
      status: LanguageStatus;
      message?: string;
    }
  | {
      id: number;
      type: "error";
      message: string;
    };

export class Gpt2LanguageClient {
  private worker: Worker | undefined;
  private nextId = 1;
  private pending = new Map<
    number,
    {
      resolve: (scores: LanguageScore[]) => void;
      reject: (error: Error) => void;
    }
  >();

  status: LanguageStatus = "idle";
  message = "GPT-2 idle";

  scoreCandidates(context: string, candidates: Candidate[]): Promise<LanguageScore[]> {
    const words = candidates.map((candidate) => candidate.word);
    if (words.length === 0) return Promise.resolve([]);

    const worker = this.ensureWorker();
    const id = this.nextId;
    this.nextId += 1;

    const request: WorkerRequest = {
      id,
      type: "score",
      context,
      words,
    };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage(request);
    });
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    this.status = "loading";
    this.message = "Loading GPT-2";
    this.worker = new Worker(new URL("./gpt2Worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      this.handleMessage(event.data);
    });
    this.worker.addEventListener("error", (event) => {
      this.status = "error";
      this.message = event.message;
      for (const pending of this.pending.values()) {
        pending.reject(new Error(event.message));
      }
      this.pending.clear();
    });

    return this.worker;
  }

  private handleMessage(response: WorkerResponse): void {
    if (response.type === "status") {
      this.status = response.status;
      this.message = response.message ?? response.status;
      return;
    }

    const pending = this.pending.get(response.id);
    if (!pending) return;

    this.pending.delete(response.id);

    if (response.type === "error") {
      this.status = "error";
      this.message = response.message;
      pending.reject(new Error(response.message));
      return;
    }

    this.status = "ready";
    this.message = "GPT-2 ready";
    pending.resolve(response.scores);
  }
}
