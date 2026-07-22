# NC Nesting static frontend

Static HTML, CSS, and JavaScript frontend for GitHub Pages at:

`https://bim-bee.github.io/NcNesting/`

## Files

```text
nc_nesting/
├── index.html
├── batch-result.html
├── cutting-plan.html
├── styles/
│   ├── input.css
│   ├── batch-result.css
│   └── cutting-plan.css
├── scripts/
│   ├── config.js
│   ├── app-storage.js
│   ├── demo-data.js
│   ├── input.js
│   ├── batch-result.js
│   ├── cutting-plan.js
│   └── relevant-storage-stock-selector.js
├── examples/
│   ├── demo-input.json
│   ├── demo-solve-request.json
│   └── demo-solve-response.json
├── API_CONTRACT.md
└── .nojekyll
```

## Configure the Azure Function

Edit `scripts/config.js`:

```js
(function initNcNestingConfig() {
  const productionSolveUrl = "https://YOUR_FUNCTION_APP.azurewebsites.net/api/Csp1dSolverFunction";
  const localSolveUrl = "http://localhost:7113/api/Csp1dSolverFunction";
  const currentHostname = String(window.location.hostname || "").toLowerCase();
  const isLocalPreview = currentHostname === "localhost" || currentHostname === "127.0.0.1";
  const searchParams = new URLSearchParams(window.location.search);
  const querySolveUrl = String(searchParams.get("solveUrl") || "").trim();

  window.NcNestingConfig = Object.freeze({
    solveUrl: querySolveUrl || (isLocalPreview ? localSolveUrl : productionSolveUrl),
    productionSolveUrl,
    localSolveUrl,
    requestTimeoutMs: 120000
  });
})();
```

Local previews now default to the local solver and deployed pages default to the production solver. To force a different backend temporarily, open the page with `?solveUrl=http://localhost:7113/api/Csp1dSolverFunction` or another full function URL.

The frontend persists the complete active project in browser storage. Live calculations send exactly one reduced `POST` request when Solve is clicked; that request contains every nesting group. The unchanged built-in demo uses its committed live-shape response instead of contacting the backend. Each group contains:

- Aggregated part requirements containing only part ID, length, and quantity.
- Matching stock orders.
- Relevant storage stocks grouped by equal length, containing only grouped ID, length, and quantity.

Part sources, imported filenames, UI metadata, storage-area records, individual storage IDs, and storage-selection audits remain in the persisted project and are not sent to the solver. Stable IDs are used to match that data back to the response. The solve response should return the batch summary and all detailed plans together. The browser stores the solved project locally so the input, result, and plan pages survive navigation and refreshes.

Cut-plan stock pieces must include their full ordered `segments` array, including trims, every tool-width cut, parts, and the offcut. See `API_CONTRACT.md` and `examples/demo-solve-response.json`.

Do not put secrets or private Azure Function keys in `config.js`; anything shipped in GitHub Pages is public. Configure the backend to accept requests from the exact GitHub Pages origin that serves the site, such as `https://bim-bee.github.io`.

## Demo data

The only demo entry point is **Load demo data** on `index.html`. It populates the committed three-group HEA140, HEB240, and RHS working input and leaves the user on the Batch Input page.

Pressing the normal **Solve** button compares the prepared request with the committed demo request, excluding only `requestId`. An unchanged demo uses the committed response without contacting the backend, saves a fresh normal solved batch, and navigates through the same Batch Result and Cutting Plan routes as a live calculation. Editing any solver-request value uses the configured backend normally.

## Publish

Copy the contents of `nc_nesting` to the branch/folder used by GitHub Pages for the `NcNesting` site. All asset links are relative, so the site works under `/NcNesting/` without path changes.
