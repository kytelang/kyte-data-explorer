// Client-side glue for Kyte Data Explorer: the Monaco editor island, the Results/Messages
// tab toggle, and closing the connection modal. Monaco is loaded from cdnjs (a vendored
// offline copy comes before the desktop build); its cross-origin language workers are
// satisfied with a tiny data-URI proxy that importScripts the real worker.

// ---- Theme (light / dark) ----------------------------------------------------------
// Apply the saved theme synchronously (this script is in <head>, so it runs before the
// body paints and there is no flash of the wrong theme). The CSS treats the bare :root
// as dark and only overrides tokens under [data-theme="light"], so "dark" is a no-op
// attribute that we still set for clarity and future themes.
(function () {
  try {
    var t = localStorage.getItem("kde-theme") || "dark";
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
})();

// The toggle button shows the theme you'd switch TO: a sun while dark, a moon while light.
function studioThemeIcon() {
  var t = document.documentElement.getAttribute("data-theme") || "dark";
  var btn = document.getElementById("theme-toggle");
  if (btn) {
    var i = btn.querySelector("i");
    if (i) i.className = "ic " + (t === "light" ? "ic-moon" : "ic-sun");
  }
}

function studioToggleTheme() {
  var cur = document.documentElement.getAttribute("data-theme") || "dark";
  var next = cur === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("kde-theme", next); } catch (e) {}
  studioThemeIcon();
  // Keep the Monaco editor in step with the app theme.
  if (window.monaco && window.__ed) {
    try { monaco.editor.setTheme(next === "light" ? "vs" : "vs-dark"); } catch (e) {}
  }
}

function studioMonacoTheme() {
  return (document.documentElement.getAttribute("data-theme") || "dark") === "light" ? "vs" : "vs-dark";
}

var MONACO_BASE = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min";

window.MonacoEnvironment = {
  getWorkerUrl: function () {
    var src =
      "self.MonacoEnvironment={baseUrl:'" + MONACO_BASE + "/'};" +
      "importScripts('" + MONACO_BASE + "/vs/base/worker/workerMain.min.js');";
    return "data:text/javascript;charset=utf-8," + encodeURIComponent(src);
  },
};

// ---- Query tabs -------------------------------------------------------------------
// Multiple query buffers backed by ONE Monaco editor: each tab stores its own SQL text;
// switching saves the current editor content to the active tab and loads the target's.
// The active tab's text is what the hidden #sql-src (and therefore Run) submits.
window.__tabs = [];
window.__activeTab = null;
var __tabSeq = 0;

function studioActiveTabObj() {
  for (var i = 0; i < window.__tabs.length; i++) if (window.__tabs[i].id === window.__activeTab) return window.__tabs[i];
  return null;
}
function studioRenderTabs() {
  var row = document.getElementById("tabrow");
  if (!row) return;
  row.innerHTML = "";
  window.__tabs.forEach(function (t) {
    var el = document.createElement("div");
    el.className = "tab" + (t.id === window.__activeTab ? " active" : "");
    el.setAttribute("data-tab-id", t.id);
    el.innerHTML =
      '<span class="tab-label"><i class="ic ic-doc"></i> ' + t.name + "</span>" +
      '<span class="close" data-close-tab="' + t.id + '" title="Close"><i class="ic ic-x"></i></span>';
    row.appendChild(el);
  });
}
function studioSaveActiveTab() {
  var t = studioActiveTabObj();
  if (t && window.__ed) t.sql = window.__ed.getValue();
}
function studioSwitchTab(id) {
  if (id === window.__activeTab) return;
  studioSaveActiveTab();
  window.__activeTab = id;
  var t = studioActiveTabObj();
  if (window.__ed && t) window.__ed.setValue(t.sql || "");
  studioRenderTabs();
}
function studioNewTab(seed) {
  __tabSeq++;
  var id = "t" + __tabSeq;
  window.__tabs.push({ id: id, name: "Query " + __tabSeq + ".sql", sql: seed || "" });
  studioSaveActiveTab();
  window.__activeTab = id;
  if (window.__ed) window.__ed.setValue(seed || "");
  studioRenderTabs();
}
function studioCloseTab(id) {
  var i = -1;
  for (var k = 0; k < window.__tabs.length; k++) if (window.__tabs[k].id === id) { i = k; break; }
  if (i < 0) return;
  var wasActive = window.__activeTab === id;
  window.__tabs.splice(i, 1);
  if (window.__tabs.length === 0) { studioNewTab(""); return; }
  if (wasActive) {
    window.__activeTab = window.__tabs[Math.max(0, i - 1)].id;
    var t = studioActiveTabObj();
    if (window.__ed && t) window.__ed.setValue(t.sql || "");
  }
  studioRenderTabs();
}

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
    // Seed the first tab once, then always drive the editor from the active tab.
    if (window.__tabs.length === 0) {
      studioNewTab("-- Write SQL and press Run (or Cmd/Ctrl+Enter)\nSELECT name FROM sys.tables");
    }
    var active = studioActiveTabObj();
    window.__ed = monaco.editor.create(el, {
      value: (active && active.sql) || "",
      language: "sql",
      theme: studioMonacoTheme(),
      minimap: { enabled: false },
      automaticLayout: true,
      fontSize: 13,
      scrollBeyondLastLine: false,
      lineNumbersMinChars: 3,
    });
    // Keep the hidden field (what Run submits) and the active tab's buffer in step.
    var sync = function () {
      if (hidden) hidden.value = window.__ed.getValue();
      var t = studioActiveTabObj();
      if (t) t.sql = window.__ed.getValue();
    };
    window.__ed.onDidChangeModelContent(sync);
    sync();
    studioRenderTabs();
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

// ---- Explorer action gating -------------------------------------------------------
// "New Table" is enabled only when a SQL database is connected (a `data-engine="sql"`
// connection root is present); "New Index" only when a table row is selected in that
// tree. The active table is tracked on window.__selTable and prefilled into the Create
// Index dialog. Any explorer refresh (reconnect / manual refresh) replaces the tree DOM,
// so selection is cleared and the buttons re-evaluated.
window.__selTable = null;

function studioSyncExplorerButtons() {
  // Gate on the ACTIVE connection (the one whose tree is expanded and that queries run
  // against), not just the first connection in the list.
  var conn = document.querySelector("#explorer-body .oe-conn.active") ||
             document.querySelector("#explorer-body .oe-conn");
  var isSql = !!(conn && conn.getAttribute("data-engine") === "sql");
  var tbtn = document.getElementById("btn-new-table");
  var ibtn = document.getElementById("btn-new-index");
  if (tbtn) tbtn.disabled = !isSql;
  // A stored selection only stays valid if that table still exists in the current tree.
  var stillThere = window.__selTable &&
    document.querySelector('#explorer-body .oe-row.table[data-table="' + window.__selTable + '"]');
  if (!stillThere) window.__selTable = null;
  if (ibtn) ibtn.disabled = !(isSql && window.__selTable);
}

// ---- Create Table field grid ------------------------------------------------------
// The grid rows do not post their own inputs; this serialises them into the hidden
// `columns` textarea ("name TYPE [NOT NULL]" per line) and the hidden `pk` input that the
// server binds. Kept in sync on every edit so a submit always sends the current grid.
function studioSerializeColumns() {
  var rows = document.getElementById("ct-rows");
  if (!rows) return;
  var lines = [], pk = "";
  rows.querySelectorAll(".col-row").forEach(function (r) {
    var name = (r.querySelector(".col-name").value || "").trim();
    if (!name) return;
    var type = r.querySelector(".col-type").value;
    var notNull = r.querySelector(".col-null").checked;
    lines.push(name + " " + type + (notNull ? " NOT NULL" : ""));
    if (r.querySelector(".col-pk").checked) pk = name;
  });
  var cols = document.getElementById("ct-columns");
  if (cols) cols.value = lines.join("\n");
  var pkf = document.getElementById("ct-pk");
  if (pkf) pkf.value = pk;
}

function studioAddField() {
  var rows = document.getElementById("ct-rows");
  if (!rows) return;
  // Clone an existing row (there is always at least one — delete keeps a minimum of one),
  // then reset it to defaults. No hidden prototype, so Add can never be left with nothing
  // to clone and there is no stray row to leak onto the page.
  var src = rows.querySelector(".col-row");
  if (!src) return;
  var row = src.cloneNode(true);
  row.querySelector(".col-name").value = "";
  var sel = row.querySelector(".col-type");
  if (sel) sel.selectedIndex = 0;
  row.querySelector(".col-null").checked = false;
  row.querySelector(".col-pk").checked = false;
  rows.appendChild(row);
  studioSerializeColumns();
}

function studioSelectTable(name) {
  window.__selTable = name;
  document.querySelectorAll("#explorer-body .oe-row.table.selected").forEach(function (r) {
    r.classList.remove("selected");
  });
  var row = document.querySelector('#explorer-body .oe-row.table[data-table="' + name + '"]');
  if (row) row.classList.add("selected");
  studioSyncExplorerButtons();
}

// The editor is part of the shell, so build it once the page is ready.
document.addEventListener("DOMContentLoaded", function () {
  studioThemeIcon();
  studioSyncExplorerButtons();
  if (document.getElementById("editor")) initSqlEditor();
});

// Results-grid pagination. The whole (capped) result is in the DOM; we just show one
// page-worth of <tr> at a time so a large result stays responsive. State lives on
// window.__pg, reset on each results swap.
function renderResultsPage() {
  var s = window.__pg;
  if (!s) return;
  var start = s.page * s.size;
  var end = Math.min(start + s.size, s.rows.length);
  for (var i = 0; i < s.rows.length; i++) {
    s.rows[i].style.display = (i >= start && i < end) ? "" : "none";
  }
  if (s.info) {
    s.info.textContent = s.rows.length === 0
      ? "0 rows"
      : "Rows " + (start + 1) + "–" + end + " of " + s.rows.length;
  }
}

function studioInitResults(root) {
  var wrap = root.querySelector(".tabwrap");
  if (wrap) {
    var ms = wrap.getAttribute("data-ms");
    var sm = document.getElementById("status-ms");
    if (sm && ms) sm.textContent = ms;
  }
  var tbody = root.querySelector("table.grid tbody");
  if (!tbody) { window.__pg = null; return; }
  var size = parseInt((wrap && wrap.getAttribute("data-pagesize")) || "100", 10);
  window.__pg = {
    rows: Array.prototype.slice.call(tbody.querySelectorAll("tr")),
    size: size,
    page: 0,
    info: root.querySelector(".pg-info"),
  };
  renderResultsPage();
}

// Copy the FULL result grid (all rows, not just the visible page) as TSV.
function studioCopyResults() {
  var root = document.getElementById("results-body");
  var table = root && root.querySelector("table.grid");
  if (!table) return;
  var lines = [];
  var head = Array.prototype.map.call(table.querySelectorAll("thead th"), function (th) { return th.textContent; });
  lines.push(head.join("\t"));
  Array.prototype.forEach.call(table.querySelectorAll("tbody tr"), function (tr) {
    var cells = Array.prototype.map.call(tr.querySelectorAll("td"), function (td) {
      return td.classList.contains("nullcell") ? "" : td.textContent;
    });
    lines.push(cells.join("\t"));
  });
  var text = lines.join("\n");
  if (navigator.clipboard) { navigator.clipboard.writeText(text); }
}

// ---- Result export (CSV / JSON / Excel) -------------------------------------------
// Works for both a SQL result grid and the Mongo documents view. Grids export as a
// header + rows matrix; Mongo docs export as their JSON (and, for CSV/Excel, are
// flattened to a union-of-keys matrix). Excel is an HTML-table .xls, which Excel and
// Numbers open natively without a real xlsx writer.
function studioTriggerDownload(filename, text, mime) {
  var blob = new Blob([text], { type: mime });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
function studioCsvCell(v) {
  if (v === null || v === undefined) return "";
  v = String(v);
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function studioHtmlCell(v) {
  return String(v === null || v === undefined ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Returns {head:[...], rows:[[...]]} from the SQL grid, or null if there is no grid.
function studioGridMatrix() {
  var table = document.querySelector("#results-body table.grid");
  if (!table) return null;
  var head = Array.prototype.map.call(table.querySelectorAll("thead th"), function (th) { return th.textContent; });
  var rows = Array.prototype.map.call(table.querySelectorAll("tbody tr"), function (tr) {
    return Array.prototype.map.call(tr.querySelectorAll("td"), function (td) {
      return td.classList.contains("nullcell") ? null : td.textContent;
    });
  });
  return { head: head, rows: rows };
}
// The Mongo documents view parsed to objects, or null if not showing documents.
function studioDocObjects() {
  var els = document.querySelectorAll("#results-body .doc-json");
  if (!els.length) return null;
  return Array.prototype.map.call(els, function (el) {
    try { return JSON.parse(el.textContent); } catch (e) { return { value: el.textContent }; }
  });
}
function studioExport(fmt) {
  var grid = studioGridMatrix();
  var docs = grid ? null : studioDocObjects();
  if (!grid && !docs) return; // nothing to export

  if (fmt === "json") {
    var payload;
    if (grid) {
      payload = grid.rows.map(function (r) {
        var o = {};
        grid.head.forEach(function (h, i) { o[h] = r[i]; });
        return o;
      });
    } else {
      payload = docs;
    }
    studioTriggerDownload("kyte-results.json", JSON.stringify(payload, null, 2), "application/json");
    return;
  }

  // CSV / Excel need a header+rows matrix; build one from docs when needed.
  var head, rows;
  if (grid) {
    head = grid.head; rows = grid.rows;
  } else {
    head = [];
    docs.forEach(function (o) { Object.keys(o).forEach(function (k) { if (head.indexOf(k) < 0) head.push(k); }); });
    rows = docs.map(function (o) {
      return head.map(function (k) {
        var v = o[k];
        if (v === undefined) return null;
        return (v !== null && typeof v === "object") ? JSON.stringify(v) : v;
      });
    });
  }

  if (fmt === "csv") {
    var lines = [head.map(studioCsvCell).join(",")];
    rows.forEach(function (r) { lines.push(r.map(studioCsvCell).join(",")); });
    studioTriggerDownload("kyte-results.csv", lines.join("\r\n"), "text/csv;charset=utf-8");
  } else { // xls: an HTML table Excel/Numbers open directly
    var html = '<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>' +
      head.map(function (h) { return "<th>" + studioHtmlCell(h) + "</th>"; }).join("") +
      "</tr></thead><tbody>" +
      rows.map(function (r) {
        return "<tr>" + r.map(function (c) { return "<td>" + studioHtmlCell(c) + "</td>"; }).join("") + "</tr>";
      }).join("") +
      "</tbody></table></body></html>";
    studioTriggerDownload("kyte-results.xls", html, "application/vnd.ms-excel");
  }
}

// Filter the object tree by name. Works on the nodes currently loaded (the tree is lazy,
// so unexpanded branches are matched once opened). A node stays visible if its own name
// matches or any loaded descendant matches; everything else is hidden.
function studioFilterTree(q) {
  var body = document.getElementById("explorer-body");
  if (!body) return;
  q = (q || "").trim().toLowerCase();
  var all = body.querySelectorAll("details, .oe-row, .oe-col, .oe-index, .oe-constraint, .oe-fk, .oe-trigger");
  all.forEach(function (el) { el.classList.remove("filter-hide"); el.removeAttribute("data-keep"); });
  if (!q) return;
  var leaves = body.querySelectorAll(".oe-row .name, .oe-col, .oe-index, .oe-constraint, .oe-fk, .oe-trigger");
  leaves.forEach(function (n) {
    if ((n.textContent || "").toLowerCase().indexOf(q) === -1) return;
    var cur = n.closest(".oe-row") || n;
    while (cur && cur !== body) { cur.setAttribute("data-keep", "1"); cur = cur.parentElement; }
  });
  all.forEach(function (el) { if (!el.getAttribute("data-keep")) el.classList.add("filter-hide"); });
}

// Toggle the filter box (activity-bar Search button) and keep it applied.
function studioToggleFilter() {
  var f = document.getElementById("explorer-filter");
  var inp = document.getElementById("oe-filter");
  if (!f) return;
  var show = f.classList.contains("hidden");
  f.classList.toggle("hidden", !show);
  if (show) { if (inp) inp.focus(); }
  else { if (inp) inp.value = ""; studioFilterTree(""); }
}

// Delegated clicks: results tabs, pager, copy, and closing the connection modal.
document.addEventListener("click", function (e) {
  if (e.target.closest && e.target.closest("#btn-search")) { studioToggleFilter(); return; }
  if (e.target.closest && e.target.closest("#theme-toggle")) { studioToggleTheme(); return; }

  // Query tabs: new / close / switch. Close is checked before switch (it sits inside a tab).
  if (e.target.closest && e.target.closest("#tab-add")) { studioNewTab(""); return; }
  var closeTab = e.target.closest ? e.target.closest("[data-close-tab]") : null;
  if (closeTab) { studioCloseTab(closeTab.getAttribute("data-close-tab")); return; }
  var tabEl = e.target.closest ? e.target.closest(".tab[data-tab-id]") : null;
  if (tabEl) { studioSwitchTab(tabEl.getAttribute("data-tab-id")); return; }

  // Create Table grid: add / remove field rows.
  if (e.target.closest && e.target.closest("#ct-add")) { studioAddField(); return; }
  var del = e.target.closest ? e.target.closest(".col-del") : null;
  if (del) {
    var rows = document.getElementById("ct-rows");
    if (rows && rows.querySelectorAll(".col-row").length > 1) del.closest(".col-row").remove();
    studioSerializeColumns();
    return;
  }

  // Selecting a SQL table row (data-table) enables the "New Index" action and targets it.
  // (Mongo collection rows carry data-mongo-coll instead and are handled separately.)
  var trow = e.target.closest ? e.target.closest(".oe-row.table[data-table]") : null;
  if (trow) { studioSelectTable(trow.getAttribute("data-table")); /* fall through: the summary still toggles */ }

  var tab = e.target.closest ? e.target.closest(".results-tab") : null;
  if (tab) { studioResultsTab(tab.getAttribute("data-tab")); return; }

  var pg = e.target.closest ? e.target.closest("[data-page]") : null;
  if (pg) {
    var s = window.__pg;
    if (s) {
      var maxPage = Math.max(0, Math.ceil(s.rows.length / s.size) - 1);
      if (pg.getAttribute("data-page") === "next" && s.page < maxPage) s.page++;
      if (pg.getAttribute("data-page") === "prev" && s.page > 0) s.page--;
      renderResultsPage();
    }
    return;
  }
  if (e.target.closest && e.target.closest("[data-copy]")) { studioCopyResults(); return; }

  var exp = e.target.closest ? e.target.closest("[data-export]") : null;
  if (exp) { studioExport(exp.getAttribute("data-export")); return; }

  // Mongo: clicking a collection runs find-all on it (puts the collection name in the
  // editor and clicks Run). The query box for Mongo is "<collection> [field=value]".
  var coll = e.target.closest ? e.target.closest("[data-mongo-coll]") : null;
  if (coll) {
    var name = coll.getAttribute("data-mongo-coll");
    if (window.__ed) { window.__ed.setValue(name); }
    var hidden = document.getElementById("sql-src");
    if (hidden) hidden.value = name;
    var runBtn = document.getElementById("run-btn");
    if (runBtn) runBtn.click();
    return;
  }

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

// After a query runs, jump to Messages on error / Results otherwise, then set up
// pagination and the status-bar timing.
document.addEventListener("htmx:afterSwap", function (e) {
  if (e.target && e.target.id === "results-body") {
    var wrap = e.target.querySelector(".tabwrap");
    var isErr = wrap && wrap.getAttribute("data-error") === "1";
    studioResultsTab(isErr ? "messages" : "results");
    studioInitResults(e.target);
  }
  // The explorer tree was (re)loaded: re-evaluate the New Table / New Index enablement.
  // The swap can land on #explorer-body itself (on `connected`) or on an inner node (the
  // load-trigger `.oe-loading` on a fresh page load, or a table's lazy detail), so match
  // anything inside the explorer.
  if (e.target && (e.target.id === "explorer-body" || (e.target.closest && e.target.closest("#explorer-body")))) {
    studioSyncExplorerButtons();
    var of = document.getElementById("oe-filter");
    if (of && of.value) studioFilterTree(of.value);
  }
  // The Create Index dialog just opened: prefill the target table from the selection.
  if (e.target && e.target.id === "modal-root" && window.__selTable) {
    var ti = document.getElementById("ddl-index-table");
    if (ti && !ti.value) ti.value = window.__selTable;
  }
  // The Create Table dialog just opened: initialise the hidden serialised fields.
  if (e.target && e.target.id === "modal-root" && document.getElementById("ct-rows")) {
    studioSerializeColumns();
  }
});

// Keep the Create Table hidden fields in sync as the grid is edited; a checked PK is
// exclusive (single-column primary key, portable across engines).
document.addEventListener("change", function (e) {
  if (!(e.target.closest && e.target.closest("#ct-rows"))) return;
  if (e.target.classList.contains("col-pk") && e.target.checked) {
    document.querySelectorAll("#ct-rows .col-pk").forEach(function (cb) {
      if (cb !== e.target) cb.checked = false;
    });
  }
  studioSerializeColumns();
});
document.addEventListener("input", function (e) {
  if (e.target && e.target.id === "oe-filter") { studioFilterTree(e.target.value); return; }
  if (e.target.closest && e.target.closest("#ct-rows")) studioSerializeColumns();
});
