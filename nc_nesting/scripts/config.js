/* Configure this before publishing. Do not place secrets or private function keys here. */
(function initNcNestingConfig() {
  const productionSolveUrl = "https://YOUR_FUNCTION_APP.azurewebsites.net/api/csp1d/solve-batch";
  const localSolveUrl = "http://localhost:7113/api/Csp1dSolverFunction";
  const searchParams = new URLSearchParams(window.location.search);
  const querySolveUrl = String(searchParams.get("solveUrl") || "").trim();
  const isLocalPage = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  window.NcNestingConfig = Object.freeze({
    solveUrl: querySolveUrl || (isLocalPage ? localSolveUrl : productionSolveUrl),
    productionSolveUrl,
    localSolveUrl,
    requestTimeoutMs: 120000
  });
})();
