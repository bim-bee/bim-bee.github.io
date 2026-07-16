/* Configure this before publishing. Do not place secrets or private function keys here. */
(function initNcNestingConfig() {
  const productionSolveUrl = "https://factory-functions-net8-fmfnahexbfdbdcdd.switzerlandnorth-01.azurewebsites.net/api/Csp1dSolverFunction?code=NaY3wiOwj5ft95Sj5F9VSUaAcuTg57uf1Y95ekO3f8MeAzFuTv6TXw==";
  const localSolveUrl = "http://localhost:7113/api/Csp1dSolverFunction";
  const searchParams = new URLSearchParams(window.location.search);
  const querySolveUrl = String(searchParams.get("solveUrl") || "").trim();

  window.NcNestingConfig = Object.freeze({
    solveUrl: querySolveUrl || productionSolveUrl,
    productionSolveUrl,
    localSolveUrl,
    requestTimeoutMs: 120000
  });
})();