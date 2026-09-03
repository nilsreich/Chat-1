const editor = document.querySelector("#codeInput");
const highlighting = document.querySelector("#highlighting");
const output = document.querySelector("#output");
const runButton = document.querySelector("#runButton");
const runLabel = document.querySelector("#runLabel");
const consolePanel = document.querySelector(".console-panel");

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
  safe = safe.replace(/\b(print|sum|len|range|str|int|list|dict|set)\b/g, '<span class="tok-builtin">$1</span>');
  safe = safe.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-number">$1</span>');
  safe = safe.replace(/\b([A-Za-z_]\w*)(?=\()/g, '<span class="tok-function">$1</span>');
  return safe.replace(/@@STRING(\d+)@@/g, (_, index) => `<span class="tok-string">${strings[Number(index)]}</span>`);
}

function updateHighlighting() {
  highlighting.innerHTML = editor.value.split("\n").map((line) => `<span class="line">${colorize(line) || " "}</span>`).join("");
}

function syncScroll() {
  highlighting.scrollTop = editor.scrollTop;
  highlighting.scrollLeft = editor.scrollLeft;
}

function addOutput(message, type = "") {
  output.innerHTML = "";
  String(message).split("\n").forEach((line) => {
    const row = document.createElement("div");
    row.className = `output-line ${type}`;
    row.textContent = line || " ";
    output.append(row);
  });
}

async function runPython() {
  if (runButton.classList.contains("running")) return;
  runButton.classList.add("running");
  runLabel.textContent = "Wird geladen…";
  consolePanel.classList.remove("collapsed");
  addOutput("Python-Laufzeit wird vorbereitet …", "muted");
  try {
    if (!window.loadPyodide) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
    }
    window.pyodideInstance ||= await window.loadPyodide();
    const lines = [];
    window.pyodideInstance.setStdout({ batched: (text) => lines.push(text) });
    window.pyodideInstance.setStderr({ batched: (text) => lines.push(text) });
    await window.pyodideInstance.runPythonAsync(editor.value);
    addOutput(lines.join("\n") || "Programm erfolgreich beendet.");
  } catch (error) {
    addOutput(error.message || "Der Code konnte nicht ausgeführt werden.", "error");
  } finally {
    runButton.classList.remove("running");
    runLabel.textContent = "Ausführen";
  }
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

editor.addEventListener("input", updateHighlighting);
editor.addEventListener("scroll", syncScroll);
editor.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    const start = editor.selectionStart;
    editor.setRangeText("    ", start, editor.selectionEnd, "end");
    updateHighlighting();
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    runPython();
  }
});
runButton.addEventListener("click", runPython);
document.querySelector("#clearButton").addEventListener("click", () => addOutput("Ausgabe geleert.", "muted"));
document.querySelector("#collapseButton").addEventListener("click", () => consolePanel.classList.toggle("collapsed"));
document.querySelector("#shareButton").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast("Projektlink wurde kopiert");
  } catch {
    showToast("Projekt ist bereit zum Teilen");
  }
});
document.querySelector("#newFileButton").addEventListener("click", () => showToast("Neue Datei erstellt"));
document.querySelector("#addTabButton").addEventListener("click", () => showToast("Neuer Tab geöffnet"));

updateHighlighting();
