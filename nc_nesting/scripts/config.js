/* Configure this before publishing. Do not place secrets or private function keys here. */
(function initNcNestingConfig() {
  const productionSolveUrl = "https://factory-functions-net8-fmfnahexbfdbdcdd.switzerlandnorth-01.azurewebsites.net/api/Csp1dSolverFunction?code=NaY3wiOwj5ft95Sj5F9VSUaAcuTg57uf1Y95ekO3f8MeAzFuTv6TXw==";
  const localSolveUrl = "http://localhost:7113/api/Csp1dSolverFunction";
  const currentHostname = String(window.location.hostname || "").toLowerCase();
  const isLocalPreview = currentHostname === "localhost" || currentHostname === "127.0.0.1";
  const searchParams = new URLSearchParams(window.location.search);
  const querySolveUrl = String(searchParams.get("solveUrl") || "").trim();

  // Frontend pre-solve screening limits. Reference values mirror normal backend routing;
  // hard ceilings are deliberately more generous for individual-group blocking.
  const solvePreflightLimits = Object.freeze({
    canonicalLayouts: Object.freeze({ reference: 20000, hard: 60000 }),
    arcFlow: Object.freeze({
      statesReference: 100000,
      statesHard: 200000,
      arcsReference: 250000,
      arcsHard: 500000
    }),
    exactAssignment: Object.freeze({
      stockSlotsReference: 500,
      stockSlotsHard: 1000,
      variablesReference: 100000,
      variablesHard: 250000,
      constraintsReference: 100000,
      constraintsHard: 250000,
      fixedAuxiliaryVariablesPerSlot: 3,
      perStockSlotConstraints: 3
    }),
    // Hidden complexity scoring. The lowest reliable solver-representation burden
    // is used for each group, then group costs are accumulated for the batch.
    complexityScoring: Object.freeze({
      batchBudget: 6,
      perGroupOverhead: 0.05,
      uncertainFallbackRawScore: 1.5,
      greenMaximumCost: 0.5,
      yellowMaximumCost: 1.0
    }),
    // Work budgets protect input-page responsiveness and never cause hard blocking.
    work: Object.freeze({
      maximumOperationsPerGroup: 500000,
      maximumMillisecondsPerGroup: 50,
      maximumMillisecondsPerBatch: 200
    })
  });

  window.NcNestingConfig = Object.freeze({
    solveUrl: querySolveUrl || (isLocalPreview ? localSolveUrl : productionSolveUrl),
    productionSolveUrl,
    localSolveUrl,
    requestTimeoutMs: 120000,
    termsVersion: "2026-04-01",
    solvePreflightLimits
  });
})();