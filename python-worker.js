const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
let pyodide;

self.addEventListener("message", async ({ data }) => {
  if (data.type === "init") {
    try {
      importScripts(PYODIDE_URL);
      pyodide = await self.loadPyodide();
      self.postMessage({ type: "ready" });
    } catch (error) {
      self.postMessage({ type: "error", message: error.message });
    }
    return;
  }
  if (data.type !== "run" || !pyodide) return;

  const control = new Int32Array(data.inputBuffer, 0, 2);
  const bytes = new Uint8Array(data.inputBuffer, 8);
  const decoder = new TextDecoder();
  pyodide.setStdout({ raw: (code) => self.postMessage({ type: "stdout", text: String.fromCodePoint(code) }) });
  pyodide.setStderr({ raw: (code) => self.postMessage({ type: "stderr", text: String.fromCodePoint(code) }) });
  pyodide.setStdin({
    stdin: () => {
      Atomics.store(control, 0, 0);
      self.postMessage({ type: "input" });
      Atomics.wait(control, 0, 0);
      return decoder.decode(bytes.slice(0, Atomics.load(control, 1)));
    },
    isatty: true,
  });

  try {
    await pyodide.runPythonAsync(data.code);
    self.postMessage({ type: "done" });
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
});
