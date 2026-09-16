// Client-side glue for Kyte Data Studio: the Monaco editor island, the Results/Messages
// tab toggle, and closing the connection modal. Monaco is loaded from cdnjs (a vendored
// offline copy comes before the desktop build); its cross-origin language workers are
// satisfied with a tiny data-URI proxy that importScripts the real worker.

var MONACO_BASE = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min";

window.MonacoEnvironment = {
  getWorkerUrl: function () {
    var src =
      "self.MonacoEnvironment={baseUrl:'" + MONACO_BASE + "/'};" +
      "importScripts('" + MONACO_BASE + "/vs/base/worker/workerMain.min.js');";
    return "data:text/javascript;charset=utf-8," + encodeURIComponent(src);
  },
};

// Turn the #editor div into a Monaco SQL editor. Idempotent (disposes any prior editor).
function initSqlEditor() {
  var el = document.getElementById("editor");
  if (!el || typeof require === "undefined") return;
  require.config({ paths: { vs: MONACO_BASE + "/vs" } });
  require(["vs/editor/editor.main"], function () {
    if (window.__ed) {
      try { window.__ed.dispose(); } catch (e) {}
      window.__ed = null;
    }
    var hidden = document.getElementById("sql-src");
    var seed = hidden && hidden.value
      ? hidden.value
      : "-- Write SQL and press Run (or Cmd/Ctrl+Enter)\nSELECT name FROM sys.tables;";
    window.__ed = monaco.editor.create(el, {
      value: seed,
      language: "sql",
      theme: "vs-dark",
      minimap: { enabled: false },
      automaticLayout: true,
      fontSize: 13,
      scrollBeyondLastLine: false,
      lineNumbersMinChars: 3,
    });
    var sync = function () { if (hidden) hidden.value = window.__ed.getValue(); };
    window.__ed.onDidChangeModelContent(sync);
    sync();
    window.__ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function () {
      sync();
      var btn = document.getElementById("run-btn");
      if (btn) btn.click();
    });
  });
}

// Switch the results pane between the Results and Messages views.
function studioResultsTab(which) {
  document.querySelectorAll(".results-tab").forEach(function (b) {
    b.classList.toggle("active", b.getAttribute("data-tab") === which);
  });
  document.querySelectorAll("#results-body .tabview").forEach(function (v) {
    v.classList.toggle("hidden", v.getAttribute("data-view") !== which);
  });
}

// The editor is part of the shell, so build it once the page is ready.
document.addEventListener("DOMContentLoaded", function () {
  if (document.getElementById("editor")) initSqlEditor();
});

// Delegated clicks: results tabs, and closing the connection modal.
document.addEventListener("click", function (e) {
  var tab = e.target.closest ? e.target.closest(".results-tab") : null;
  if (tab) { studioResultsTab(tab.getAttribute("data-tab")); return; }
  // Close the modal on the × / Cancel buttons (they carry data-close-modal) or a click
  // on the backdrop ITSELF. We must not use closest() against the backdrop, since it is
  // the ancestor of the whole dialog and would swallow the Connect click.
  var onBtn = e.target.closest && e.target.closest("[data-close-modal]");
  var onBackdrop = e.target.classList && e.target.classList.contains("modal-backdrop");
  if (onBtn || onBackdrop) {
    var root = document.getElementById("modal-root");
    if (root) root.innerHTML = "";
  }
});

// After a query runs, jump to Messages on error, Results otherwise.
document.addEventListener("htmx:afterSwap", function (e) {
  if (e.target && e.target.id === "results-body") {
    var wrap = e.target.querySelector(".tabwrap");
    var isErr = wrap && wrap.getAttribute("data-error") === "1";
    studioResultsTab(isErr ? "messages" : "results");
  }
});
