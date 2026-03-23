/**
 * Whisper Web Worker — runs transformers.js ASR pipeline entirely in the browser.
 *
 * Protocol:
 *   Main → Worker:  { type: "transcribe", audio: Float32Array }
 *   Worker → Main:  { type: "progress", status: string, progress?: number }
 *                   { type: "result", text: string }
 *                   { type: "error", message: string }
 */

let transcriber = null;
let busy = false;

const MODEL_ID = "Xenova/whisper-tiny.en";

self.onerror = (e) => {
  self.postMessage({ type: "error", message: e.message || "Worker error" });
};

async function loadPipeline() {
  if (transcriber) return transcriber;

  self.postMessage({ type: "progress", status: "Loading speech model...", progress: 0 });

  const { pipeline: createPipeline, env } = await import(
    "https://esm.sh/@huggingface/transformers@3.4.1"
  );

  env.allowLocalModels = false;

  transcriber = await createPipeline("automatic-speech-recognition", MODEL_ID, {
    dtype: "q8",
    progress_callback: (progress) => {
      if (progress.status === "download" || progress.status === "progress") {
        const pct = progress.progress != null ? Math.round(progress.progress) : null;
        self.postMessage({
          type: "progress",
          status: pct != null ? `Downloading voice model... ${pct}%` : "Downloading voice model...",
          progress: pct,
        });
      }
      if (progress.status === "ready") {
        self.postMessage({ type: "progress", status: "Model ready", progress: 100 });
      }
    },
  });

  return transcriber;
}

self.onmessage = async (event) => {
  const { type, audio } = event.data;

  if (type !== "transcribe") return;
  if (busy) {
    self.postMessage({ type: "error", message: "Already processing a transcription" });
    return;
  }

  busy = true;
  try {
    const pipe = await loadPipeline();

    self.postMessage({ type: "progress", status: "Transcribing..." });

    const result = await pipe(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
    });

    const text = (result.text || "").trim();
    self.postMessage({ type: "result", text });
  } catch (err) {
    self.postMessage({ type: "error", message: err?.message || "Transcription failed" });
  } finally {
    busy = false;
  }
};
