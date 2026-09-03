const editor = document.querySelector("#codeInput");
const highlighting = document.querySelector("#highlighting");
const output = document.querySelector("#output");
const runButton = document.querySelector("#runButton");
const runLabel = document.querySelector("#runLabel");
const fileInput = document.querySelector("#fileInput");
const resizeHandle = document.querySelector("#resizeHandle");
const terminal = document.querySelector("#terminal");

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function colorize(line) {
  const strings = [];
  let safe = escapeHtml(line).replace(/(""".*?"""|".*?"|'.*?')/g, (match) => {
    strings.push(match);
    return `@@STRING${strings.length - 1}@@`;
  });
  safe = safe.replace(/(#.*)$/g, '<span class="tok-comment">$1</span>');
  safe = safe.replace(/\b(def|return|if|else|elif|for|while|in|import|from|as|class|try|except|with|and|or|not|True|False|None)\b/g, '<span class="tok-keyword">$1</span>');
  safe = safe.replace(/\b(print|sum|len|range|str|int|list|dict|set|tuple)\b/g, '<span class="tok-builtin">$1</span>');
  safe = safe.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-number">$1</span>');
  safe = safe.replace(/\b([A-Za-z_]\w*)(?=\()/g, '<span class="tok-function">$1</span>');
  return safe.replace(/@@STRING(\d+)@@/g, (_, index) => `<span class="tok-string">${strings[Number(index)]}</span>`);
}

function updateHighlighting() {
  highlighting.innerHTML = editor.value.split("\n").map((line) => `<span class="line">${colorize(line) || " "}</span>`).join("");
  localStorage.setItem("python-editor-code", editor.value);
}

function addTerminalLines(message, type = "") {
  output.innerHTML = "";
  String(message).split("\n").forEach((line) => {
    const row = document.createElement("div");
    row.className = `terminal-line ${type}`;
    const prompt = document.createElement("span");
    prompt.className = "prompt";
    prompt.textContent = type === "error" ? "!" : "›";
    row.append(prompt, document.createTextNode(` ${line || " "}`));
    output.append(row);
  });
}

async function loadPythonRuntime() {
  if (window.pyodideInstance) return window.pyodideInstance;
  if (!window.loadPyodide) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Die Python-Laufzeit konnte nicht geladen werden. Bitte prüfe deine Internetverbindung."));
      document.head.append(script);
    });
  }
  window.pyodideInstance = await window.loadPyodide();
  return window.pyodideInstance;
}

async function runPython() {
  if (runButton.disabled) return;
  runButton.disabled = true;
  runLabel.textContent = "Lädt …";
  addTerminalLines("Python wird vorbereitet …", "muted");
  try {
    const pyodide = await loadPythonRuntime();
    const lines = [];
    pyodide.setStdout({ batched: (text) => lines.push(text) });
    pyodide.setStderr({ batched: (text) => lines.push(text) });
    await pyodide.runPythonAsync(editor.value);
    addTerminalLines(lines.join("\n") || "Programm erfolgreich beendet.");
  } catch (error) {
    addTerminalLines(error.message || "Der Code konnte nicht ausgeführt werden.", "error");
  } finally {
    runButton.disabled = false;
    runLabel.textContent = "Ausführen";
  }
}

function downloadCode() {
  const url = URL.createObjectURL(new Blob([editor.value], { type: "text/x-python;charset=utf-8" }));
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
}

editor.addEventListener("input", updateHighlighting);
editor.addEventListener("scroll", () => {
  highlighting.scrollTop = editor.scrollTop;
  highlighting.scrollLeft = editor.scrollLeft;
});
editor.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    editor.setRangeText("    ", editor.selectionStart, editor.selectionEnd, "end");
    updateHighlighting();
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    runPython();
  }
});
document.querySelector("#runButton").addEventListener("click", runPython);
document.querySelector("#downloadButton").addEventListener("click", downloadCode);
document.querySelector("#uploadButton").addEventListener("click", () => fileInput.click());
document.querySelector("#clearButton").addEventListener("click", () => addTerminalLines("Bereit.", "muted"));
fileInput.addEventListener("change", async () => {
  const [file] = fileInput.files;
  if (!file) return;
  editor.value = await file.text();
  updateHighlighting();
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
  if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  const change = event.key === "ArrowUp" ? 16 : -16;
  document.documentElement.style.setProperty("--terminal-height", `${Math.max(92, terminal.offsetHeight + change)}px`);
});

const savedCode = localStorage.getItem("python-editor-code");
if (savedCode) editor.value = savedCode;
updateHighlighting();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}
