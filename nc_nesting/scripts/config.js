/* Configure this before publishing. Do not place secrets or private function keys here. */
(function initNcNestingConfig() {
  const productionSolveUrl = "https://factory-functions-net8-fmfnahexbfdbdcdd.switzerlandnorth-01.azurewebsites.net/api/Csp1dSolverFunction?code=NaY3wiOwj5ft95Sj5F9VSUaAcuTg57uf1Y95ekO3f8MeAzFuTv6TXw==";
  const localSolveUrl = "http://localhost:7113/api/Csp1dSolverFunction";
  const currentHostname = String(window.location.hostname || "").toLowerCase();
  const isLocalPreview = currentHostname === "localhost" || currentHostname === "127.0.0.1";
  const searchParams = new URLSearchParams(window.location.search);
  const querySolveUrl = String(searchParams.get("solveUrl") || "").trim();
  const methodologyUrl = "https://bim-bee.github.io/BIMBlog/posts/nesting-optimization.html";
  const contactUrl = new URL("../index.html#contact", window.location.href).href;

  // DEV/QA feature. Set to false for the production UI.
  // When enabled, only genuinely improved cut plans redirect the existing greedy-methodology link
  // to the original frontend greedy baseline in a separate comparison tab.
  const featureFlags = Object.freeze({
    greedyCutPlanComparison: true,
    // DEV/QA only. Shows exact stock-piece/segment data when cut-plan validation fails.
    cutPlanValidationDiagnostics: true
  });

  // Frontend pre-solve screening limits. Solver-size ceilings classify difficulty only;
  // maxNestingGroups is the explicit frontend batch safety limit.
  const solvePreflightLimits = Object.freeze({
    maxNestingGroups: 50,
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
    // is used for each group. Aggregate cost is informational/backend context only.
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

  const bestKnownRetry = Object.freeze({
    enabled: true,
    minimumPressureReductionRatio: 0.18,
    supportedPressureReductionRatio: 0.10,
    minimumGroupCountReductionRatio: 0.35
  });

  window.NcNestingConfig = Object.freeze({
    solveUrl: querySolveUrl || (isLocalPreview ? localSolveUrl : productionSolveUrl),
    productionSolveUrl,
    localSolveUrl,
    methodologyUrl,
    contactUrl,
    featureFlags,
    requestTimeoutMs: 150000,
    termsVersion: "2026-04-01",
    solvePreflightLimits,
    bestKnownRetry
  });
})();