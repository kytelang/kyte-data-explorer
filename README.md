# Kyte Data Explorer

Kyte Data Explorer is a database GUI in the style of VS Code: an activity rail, an object-explorer tree, a query workspace with tabs and a Monaco editor, and a results pane. It is written as a Kyte web app and builds to a single binary called **`kde`**.

It runs two ways from the same binary:

- **In the browser**, as a normal web server (`kde`), and
- **As a native desktop window** (`kde --desktop`), where the pages are hosted in a native webview instead of a browser tab.

## Connecting

The explorer connects to several databases through the Kyte driver packages:

- **kaidb**
- **PostgreSQL**
- **MySQL**
- **Microsoft SQL Server**
- **MongoDB**

The object explorer shows the full server tree the way the underlying database exposes it: server, databases, tables, and each table's columns, indexes, and constraints. The query workspace runs SQL against the active connection and shows results, with a separate view for document (Mongo-style) results.

## Building

Kyte Data Explorer builds with the Kyte toolchain.

```sh
kyte build            # debug build into build/debug/bin/kde
kyte build --release  # optimised build into build/release/bin/kde
kyte run              # build and run
```

The five driver packages are declared as git-URL dependencies in `project.json`, so `kyte build` fetches them automatically. There is no vendored `packages/` directory to set up.

### Desktop build

The desktop mode links a native webview into the binary. On macOS this uses WKWebView, on Linux WebKit2GTK, and on Windows WebView2. The Kyte toolchain provides the webview backing, so no extra setup is needed beyond a normal `kyte build`.

## Running

```sh
kde                   # serve in the browser (see the port in app.yaml)
kde --desktop         # open a native desktop window
kde --migrate         # apply schema migrations, then exit
```

Runtime configuration lives in `app.yaml`. The static assets it serves (the explorer's CSS and JavaScript) live under `wwwroot/`.

## Project layout

- `src/main.ky` the composition root and the browser, desktop, and migrate entry points.
- `src/Features/` the vertical slices: Shell, Connections, Explorer, Query, and Ddl.
- `src/Shared/` the shared application context and helpers.
- `wwwroot/` the static assets served to the front end.
- `app.yaml` runtime configuration.
