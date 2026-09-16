// Client-side glue for Kyte Data Studio. Today this is just the Monaco editor island
// for the SQL panel. The Monaco AMD loader is pulled from cdnjs in the page head; this
// file configures it and (re)creates the editor whenever the query panel is swapped in.
//
// Monaco is loaded from a CDN, so its language workers must be fetched cross-origin.
// We hand it a tiny data-URI worker that importScripts the real worker from the CDN,
// which keeps the editor happy without any same-origin worker file. This will be
// replaced by a vendored, offline copy before the desktop (webview) build (see W2).

var MONACO_BASE = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min";

window.MonacoEnvironment = {
  getWorkerUrl: function () {
    var src =
      "self.MonacoEnvironment={baseUrl:'" + MONACO_BASE + "/'};" +
      "importScripts('" + MONACO_BASE + "/vs/base/worker/workerMain.min.js');";
    return "data:text/javascript;charset=utf-8," + encodeURIComponent(src);
  },
};

// Turn the current #editor div into a Monaco SQL editor. Idempotent: if an editor
// already exists (for example the panel was reopened) the old one is disposed first,
// so we never leak instances or attach to a detached DOM node.
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
    var seed = hidden && hidden.value ? hidden.value : "SELECT name FROM sys.tables;";
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
    // Mirror the editor text into the hidden textarea so htmx's hx-include picks it up.
    var sync = function () { if (hidden) hidden.value = window.__ed.getValue(); };
    window.__ed.onDidChangeModelContent(sync);
    sync();
    // Cmd/Ctrl+Enter runs the query (clicks the Run button, which htmx handles).
    window.__ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function () {
      sync();
      var btn = document.getElementById("run-btn");
      if (btn) btn.click();
    });
  });
}

// The query panel arrives via an htmx swap, so (re)initialise the editor whenever a
// fresh #editor appears in swapped-in content. We listen on `document`, not
// `document.body`: this script runs from the page <head>, before <body> exists, and
// htmx events bubble all the way up to document anyway.
document.addEventListener("htmx:afterSwap", function () {
  if (document.getElementById("editor")) initSqlEditor();
});
