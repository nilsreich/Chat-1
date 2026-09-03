const source = document.querySelector("#codeInput");
const runButton = document.querySelector("#runButton");
const runLabel = document.querySelector("#runLabel");
const fileInput = document.querySelector("#fileInput");
const resizeHandle = document.querySelector("#resizeHandle");
const terminalPanel = document.querySelector("#terminal");

const editor = window.CodeMirror.fromTextArea(source, {
  mode: "python",
  lineNumbers: true,
  indentUnit: 4,
  tabSize: 4,
  indentWithTabs: false,
  lineWrapping: false,
  autofocus: true,
  extraKeys: {
    Tab: (instance) => instance.replaceSelection("    ", "end"),
    "Ctrl-Enter": () => runPython(),
    "Cmd-Enter": () => runPython(),
  },
});

const terminal = new window.Terminal({
  cursorBlink: true,
  convertEol: true,
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  fontSize: 13,
  lineHeight: 1.35,
  theme: { background: "#f7f8fa", foreground: "#2e3742", cursor: "#2869e8", selectionBackground: "#cddcff" },
});
const fitAddon = new window.FitAddon.FitAddon();
terminal.loadAddon(fitAddon);
terminal.open(document.querySelector("#terminalOutput"));
fitAddon.fit();
terminal.writeln("\x1b[90m› Bereit.\x1b[0m");

let inputBuffer;
let inputControl;
let inputBytes;
const encoder = new TextEncoder();
let worker;
let waitingForInput = false;
let currentInput = "";

function writeOutput(text, error = false) {
  const color = error ? "\x1b[31m" : "";
  terminal.write(`${color}${String(text).replaceAll("\n", "\r\n")}\x1b[0m`);
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker("python-worker.js");
  worker.addEventListener("message", ({ data }) => {
    if (data.type === "ready") {
      runLabel.textContent = "Ausführen";
      worker.postMessage({ type: "run", code: editor.getValue(), inputBuffer });
    } else if (data.type === "stdout") {
      writeOutput(data.text);
    } else if (data.type === "stderr") {
      writeOutput(data.text, true);
    } else if (data.type === "input") {
      waitingForInput = true;
      currentInput = "";
      terminal.focus();
    } else if (data.type === "done") {
      finishRun();
    } else if (data.type === "error") {
      writeOutput(`\r\n${data.message}\r\n`, true);
      finishRun();
    }
  });
  worker.addEventListener("error", () => {
    writeOutput("\r\nDie Python-Laufzeit konnte nicht gestartet werden.\r\n", true);
    finishRun();
  });
  runLabel.textContent = "Lädt …";
  worker.postMessage({ type: "init" });
  return worker;
}

function finishRun() {
  waitingForInput = false;
  runButton.disabled = false;
  runLabel.textContent = "Ausführen";
  terminal.write("\r\n\x1b[90m› Prozess beendet.\x1b[0m\r\n");
}

function runPython() {
  if (runButton.disabled) return;
  if (!window.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
    writeOutput("\r\nFür Terminal-Eingaben wird die sichere PWA-Umgebung vorbereitet. Bitte lade die Seite neu.\r\n", true);
    return;
  }
  inputBuffer ||= new SharedArrayBuffer(4104);
  inputControl ||= new Int32Array(inputBuffer, 0, 2);
  inputBytes ||= new Uint8Array(inputBuffer, 8);
  runButton.disabled = true;
  terminal.clear();
  const runtime = getWorker();
  if (runLabel.textContent !== "Lädt …") runtime.postMessage({ type: "run", code: editor.getValue(), inputBuffer });
}

terminal.onData((data) => {
  if (!waitingForInput) return;
  if (data === "\r") {
    const bytes = encoder.encode(currentInput.slice(0, inputBytes.length - 1));
    inputBytes.fill(0);
    inputBytes.set(bytes);
    Atomics.store(inputControl, 1, bytes.length);
    Atomics.store(inputControl, 0, 1);
    Atomics.notify(inputControl, 0);
    terminal.write("\r\n");
    waitingForInput = false;
  } else if (data === "\u007f" && currentInput.length) {
    currentInput = currentInput.slice(0, -1);
    terminal.write("\b \b");
  } else if (data >= " " && data !== "\u007f") {
    currentInput += data;
    terminal.write(data);
  }
});

function downloadCode() {
  const url = URL.createObjectURL(new Blob([editor.getValue()], { type: "text/x-python;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "main.py";
  link.click();
  URL.revokeObjectURL(url);
  showToast("main.py wurde heruntergeladen");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function resizeTerminal(clientY) {
  const height = Math.min(window.innerHeight - 180, Math.max(92, window.innerHeight - clientY));
  document.documentElement.style.setProperty("--terminal-height", `${height}px`);
  requestAnimationFrame(() => fitAddon.fit());
}

editor.on("change", () => localStorage.setItem("python-editor-code", editor.getValue()));
document.querySelector("#runButton").addEventListener("click", runPython);
document.querySelector("#downloadButton").addEventListener("click", downloadCode);
document.querySelector("#uploadButton").addEventListener("click", () => fileInput.click());
document.querySelector("#clearButton").addEventListener("click", () => terminal.clear());
fileInput.addEventListener("change", async () => {
  const [file] = fileInput.files;
  if (!file) return;
  editor.setValue(await file.text());
  showToast(`${file.name} wurde geöffnet`);
  fileInput.value = "";
});

resizeHandle.addEventListener("pointerdown", (event) => {
  resizeHandle.setPointerCapture(event.pointerId);
  document.body.style.userSelect = "none";
});
resizeHandle.addEventListener("pointermove", (event) => {
  if (resizeHandle.hasPointerCapture(event.pointerId)) resizeTerminal(event.clientY);
});
resizeHandle.addEventListener("pointerup", (event) => {
  resizeHandle.releasePointerCapture(event.pointerId);
  document.body.style.userSelect = "";
});
resizeHandle.addEventListener("keydown", (event) => {
  if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  const change = event.key === "ArrowUp" ? 16 : -16;
  document.documentElement.style.setProperty("--terminal-height", `${Math.max(92, terminalPanel.offsetHeight + change)}px`);
  fitAddon.fit();
});
window.addEventListener("resize", () => fitAddon.fit());

const savedCode = localStorage.getItem("python-editor-code");
if (savedCode) editor.setValue(savedCode);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    await navigator.serviceWorker.register("./service-worker.js");
    if (!window.crossOriginIsolated) {
      if (navigator.serviceWorker.controller) window.location.reload();
      else navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    }
  });
}
