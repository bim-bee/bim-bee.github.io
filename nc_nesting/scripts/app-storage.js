(function () {
  "use strict";

  const DB_NAME = "nc-nesting";
  const DB_VERSION = 2;
  const STORE_NAME = "solved-batches";
  const GROUP_CACHE_STORE_NAME = "group-solve-cache";
  const GROUP_CACHE_PROJECT_INDEX = "projectId";
  const SOLVE_CACHE_VERSION = "2";
  const GREEDY_CACHE_VERSION = "greedy-bfd-v3";
  const ACTIVE_PROJECT_KEY = `${DB_NAME}:active-project`;
  const ORDER_QUANTITIES_KEY = batchId => `${DB_NAME}:order-quantities:${batchId}`;
  const PROFILE_WEIGHT_SOURCE = "profile-catalogue";
  let profileCataloguePromise = null;

  function config() {
    return window.NcNestingConfig || {};
  }

  function clone(value) {
    if (value == null) return value;
    return globalThis.structuredClone
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  function createRequestId() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function createProjectId() {
    return `project-${createRequestId()}`;
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function hasOwn(object, key) {
    return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
  }

  function cleanName(value) {
    return String(value || "").trim();
  }

  function pickFirstNumber(...values) {
    for (const value of values) {
      if (value == null || (typeof value === "string" && !value.trim())) continue;
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return null;
  }

  function profileCatalogueModuleUrl() {
    return new URL("../profile-catalogue/profile-api.js", document.baseURI).href;
  }

  function getProfileCatalogue() {
    if (globalThis.NcNestingProfileCatalogueReady) {
      return globalThis.NcNestingProfileCatalogueReady;
    }
    if (!profileCataloguePromise) {
      profileCataloguePromise = import(profileCatalogueModuleUrl())
        .then(api => api.loadCatalogue())
        .catch(() => null);
    }
    return profileCataloguePromise;
  }

  async function catalogueMassKgM(profileName) {
    const name = cleanName(profileName);
    if (!name) return null;
    const catalogue = await getProfileCatalogue();
    const value = catalogue?.getMassKgM?.(name);
    const number = Number(value);
    return value != null && Number.isFinite(number) && number >= 0 ? number : null;
  }

  async function attachCatalogueWeightToGroup(group, fallbackProfileName = "") {
    const normalized = { ...group };
    const profileName = cleanName(normalized.profileName || fallbackProfileName);
    const profileKeilogramPerMeter = await catalogueMassKgM(profileName);
    const totalStockLengthConsumed = pickFirstNumber(normalized.totalStockLengthConsumed, normalized.totalStockLength) || 0;
    const totalStorageStockLengthConsumed = pickFirstNumber(normalized.totalStorageStockLengthConsumed, normalized.storageStockLengthConsumed) || 0;

    normalized.profileKeilogramPerMeter = profileKeilogramPerMeter;
    normalized.profileWeightSource = profileKeilogramPerMeter == null ? null : PROFILE_WEIGHT_SOURCE;
    normalized.weightTon = profileKeilogramPerMeter == null
      ? null
      : totalStockLengthConsumed / 1000000 * profileKeilogramPerMeter;
    normalized.storageStockWeightTon = profileKeilogramPerMeter == null
      ? null
      : totalStorageStockLengthConsumed / 1000000 * profileKeilogramPerMeter;
    return normalized;
  }

  async function attachCatalogueWeights(batchResult, project = null) {
    if (!batchResult) return batchResult;
    const weighted = clone(batchResult);
    weighted.groups = await Promise.all(asArray(weighted.groups).map(group => {
      const frontendGroup = projectGroup(project, group?.groupId);
      return attachCatalogueWeightToGroup(group, frontendGroup?.profileName || "");
    }));
    return weighted;
  }

  function isGreedyOnlyResult(source) {
    const status = String(source?.status || source?.optimization?.status || "").replace(/[\s_-]/g, "").toLowerCase();
    const resultSource = String(source?.resultSource || "").replace(/[\s_-]/g, "").toLowerCase();
    return status === "greedyonly" || resultSource === "frontendgreedy";
  }

  function normalizeOptimizationMetadata(source) {
    if (isGreedyOnlyResult(source)) return null;
    const reader = globalThis.NcNestingOptimization?.readOptimization;
    if (typeof reader !== "function") return source?.optimization ? clone(source.optimization) : null;
    const normalized = reader(source);
    if (!normalized) return null;
    return {
      ...(source?.optimization && typeof source.optimization === "object" ? clone(source.optimization) : {}),
      ...(normalized.status ? { status: normalized.status } : {}),
      ...(normalized.bestFeasibleObjective ? { bestFeasibleObjective: normalized.bestFeasibleObjective } : {}),
      ...(normalized.bestProvenBound ? { bestProvenBound: normalized.bestProvenBound } : {}),
      ...(normalized.provenOptimum ? { provenOptimum: normalized.provenOptimum } : {}),
      ...(normalized.stopReason ? { stopReason: normalized.stopReason } : {}),
      ...(normalized.provenObjectiveCount != null ? { provenObjectiveCount: normalized.provenObjectiveCount } : {}),
      ...(normalized.objectiveProgress ? { objectiveProgress: clone(normalized.objectiveProgress) } : {})
    };
  }

  function normalizeBatchGroup(group) {
    // Backend profileKeilogramPerMeter is intentionally ignored. Weight is attached
    // later from the frontend Profile Catalogue only.
    const profileKeilogramPerMeter = null;
    const totalStockLengthConsumed = pickFirstNumber(group.totalStockLengthConsumed, group.totalStockLength) || 0;
    const totalStorageStockLengthConsumed = pickFirstNumber(group.totalStorageStockLengthConsumed, group.storageStockLengthConsumed) || 0;
    const stockOrders = asArray(group.stockOrders).map(order => {
      const requiredQuantity = pickFirstNumber(order.requiredQuantity, order.selectedQuantity, order.orderQuantity, 0) || 0;
      return {
        ...order,
        stockOrderId: order.stockOrderId || order.stockTypeId || null,
        stockTypeId: order.stockTypeId || order.stockOrderId || null,
        stockLength: pickFirstNumber(order.stockLength, order.length),
        requiredQuantity,
        orderQuantity: pickFirstNumber(order.orderQuantity, order.selectedQuantity, requiredQuantity, 0) || 0,
        unitPrice: pickFirstNumber(order.unitPrice, order.price, order.cost)
      };
    });

    const optimization = normalizeOptimizationMetadata(group);
    return {
      ...group,
      status: group.status || "Completed",
      ...(optimization ? { optimization } : {}),
      profileKeilogramPerMeter,
      profileWeightSource: null,
      totalStockLengthConsumed,
      totalConsumedLength: pickFirstNumber(group.totalConsumedLength, group.actualConsumedLength) || 0,
      totalPartLength: pickFirstNumber(group.totalPartLength, group.finishedPartLength, group.selectedPartLength),
      totalOffcutLength: pickFirstNumber(group.totalOffcutLength) || 0,
      totalStorageStockLengthConsumed,
      totalReusableOffcutLength: pickFirstNumber(group.totalReusableOffcutLength, group.reusableOffcutLength) || 0,
      storageStockQuantity: pickFirstNumber(group.storageStockQuantity, group.storageStockQuantityUsed) || 0,
      stockOrderQuantity: pickFirstNumber(group.stockOrderQuantity) || 0,
      weightTon: profileKeilogramPerMeter == null ? null : totalStockLengthConsumed / 1000 * profileKeilogramPerMeter / 1000,
      storageStockWeightTon: profileKeilogramPerMeter == null ? null : totalStorageStockLengthConsumed / 1000 * profileKeilogramPerMeter / 1000,
      stockOrders
    };
  }

  function normalizeBatchResultShape(batchResult, container) {
    if (Array.isArray(batchResult)) {
      return {
        status: container?.status || "Completed",
        batchId: container?.batchId || null,
        generatedAt: container?.generatedAt || null,
        currency: container?.currency || null,
        groups: batchResult.map(normalizeBatchGroup)
      };
    }

    return {
      ...batchResult,
      status: batchResult?.status || container?.status || "Completed",
      batchId: batchResult?.batchId || container?.batchId || null,
      generatedAt: batchResult?.generatedAt || container?.generatedAt || null,
      currency: batchResult?.currency || container?.currency || null,
      groups: asArray(batchResult?.groups).map(normalizeBatchGroup)
    };
  }

  function normalizePlanTotals(totals) {
    const source = totals || {};
    return {
      ...source,
      totalStockLengthConsumed: pickFirstNumber(source.totalStockLengthConsumed, source.totalStockLength) || 0,
      totalConsumedLength: pickFirstNumber(source.totalConsumedLength, source.actualConsumedLength) || 0,
      totalOffcutLength: pickFirstNumber(source.totalOffcutLength) || 0,
      totalStorageStockLengthConsumed: pickFirstNumber(source.totalStorageStockLengthConsumed, source.storageStockLengthConsumed) || 0,
      totalReusableOffcutLength: pickFirstNumber(source.totalReusableOffcutLength, source.reusableOffcutLength) || 0,
      reusableOffcutCount: pickFirstNumber(source.reusableOffcutCount, source.totalReusableOffcutCount),
      totalStockOrderLengthOrdered: pickFirstNumber(source.totalStockOrderLengthOrdered, source.stockOrderLength) || 0,
      stockOrderPieceCount: pickFirstNumber(source.stockOrderPieceCount, source.stockOrderQuantity) || 0,
      storageStockPieceCount: pickFirstNumber(source.storageStockPieceCount, source.storageStockQuantityUsed) || 0,
      stockOrderCost: pickFirstNumber(source.stockOrderCost) || 0
    };
  }

  function normalizeSolvePlan(plan) {
    const stockOrderOptions = asArray(plan.stockOrderOptions).length
      ? asArray(plan.stockOrderOptions)
      : asArray(plan.selectedStockOrders).map(order => ({
        ...order,
        stockOrderId: order.stockOrderId || order.stockTypeId || null,
        stockTypeId: order.stockTypeId || order.stockOrderId || null,
        cost: pickFirstNumber(order.cost, order.price, order.unitPrice),
        isUnlimited: typeof order.isUnlimited === "boolean" ? order.isUnlimited : order.availableQuantity == null,
        availableQuantity: pickFirstNumber(order.availableQuantity),
        length: pickFirstNumber(order.length, order.stockLength),
        selectedPieceCount: pickFirstNumber(order.selectedPieceCount, order.selectedQuantity) || 0,
        selectedStockLength: pickFirstNumber(order.selectedStockLength, order.selectedTotalLength) || 0,
        selectedPartLength: pickFirstNumber(order.selectedPartLength, order.finishedPartLength, order.totalPartLength),
        utilizationPercentage: pickFirstNumber(order.utilizationPercentage),
        wasteLength: pickFirstNumber(order.wasteLength, order.offcutLength, order.totalWasteLength, order.totalOffcutLength)
      }));

    const storageRetrievals = asArray(plan.storageRetrievals).length
      ? asArray(plan.storageRetrievals)
      : asArray(plan.selectedGroupedStorageStock).map(stock => ({
        storageStockId: stock.storageStockId || stock.groupedStorageStockId,
        groupedStorageStockId: stock.groupedStorageStockId || null,
        quantity: pickFirstNumber(stock.quantity, stock.selectedQuantity) || 0,
        stockLength: pickFirstNumber(stock.stockLength, stock.length),
        totalPartLength: pickFirstNumber(stock.totalPartLength, stock.finishedPartLength),
        utilizationPercentage: pickFirstNumber(stock.utilizationPercentage),
        wasteLength: pickFirstNumber(stock.wasteLength, stock.offcutLength, stock.totalWasteLength, stock.totalOffcutLength)
      }));

    const optimization = normalizeOptimizationMetadata(plan);
    return {
      ...plan,
      ...(optimization ? { optimization } : {}),
      settings: { ...(plan.settings || {}), ...(plan.cuttingSettings || {}) },
      stockOrderOptions,
      storageRetrievals,
      requestedParts: asArray(plan.requestedParts).map(part => ({
        ...part,
        requestedQuantity: pickFirstNumber(part.requestedQuantity, part.quantity) || 0
      })),
      totals: normalizePlanTotals(plan.totals),
      stockPieces: asArray(plan.stockPieces)
    };
  }

  function normalizePlansShape(plans) {
    if (Array.isArray(plans)) {
      return plans.map(normalizeSolvePlan);
    }

    return Object.fromEntries(
      Object.entries(plans || {}).map(([groupId, plan]) => [groupId, normalizeSolvePlan({ groupId, ...plan })])
    );
  }

  function planFromNormalizedCollection(plans, groupId) {
    if (Array.isArray(plans)) {
      return plans.find(plan => plan?.groupId === groupId || plan?.id === groupId) || null;
    }
    return plans?.[groupId] || null;
  }

  function attachPlanMetadataToBatch(batchResult, plans) {
    const result = clone(batchResult);
    const normalizedPlans = normalizePlansShape(plans || {});
    result.groups = asArray(result?.groups).map(group => {
      const plan = planFromNormalizedCollection(normalizedPlans, group.groupId);
      let enriched = group;
      const explicit = pickFirstNumber(group.totalPartLength);
      if ((explicit == null || explicit < 0) && plan) {
        const totalPartLength = globalThis.NcNestingUtilization?.totalPartLengthFromPlan?.(plan);
        if (Number.isFinite(totalPartLength) && totalPartLength >= 0) enriched = { ...enriched, totalPartLength };
      }
      const groupOptimization = normalizeOptimizationMetadata(enriched);
      const planOptimization = normalizeOptimizationMetadata(plan);
      if (groupOptimization || planOptimization) {
        enriched = {
          ...enriched,
          optimization: {
            ...(groupOptimization || {}),
            ...(planOptimization || {}),
            bestFeasibleObjective: planOptimization?.bestFeasibleObjective
              || groupOptimization?.bestFeasibleObjective
              || globalThis.NcNestingOptimization?.normalizeObjective?.(enriched)
          }
        };
      }
      return enriched;
    });
    return result;
  }

  function attachGreedyBaselinesToBatch(batchResult, greedyBaselines) {
    const result = clone(batchResult);
    result.groups = asArray(result?.groups).map(group => {
      const baseline = greedyBaselines?.[group.groupId];
      return baseline ? { ...group, greedyBaseline: clone(baseline) } : group;
    });
    return result;
  }

  function fingerprintField(object, key, type) {
    if (!hasOwn(object, key)) return ["omitted"];
    const value = object[key];
    if (value === null) return ["null"];
    if (type === "number") {
      const number = Number(value);
      if (!Number.isFinite(number)) return ["invalid-number", String(value)];
      return ["number", Object.is(number, -0) ? 0 : number];
    }
    return ["string", String(value)];
  }

  function canonicalString(value) {
    if (value === undefined) return '["undefined"]';
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalString).join(",")}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalString(value[key])}`).join(",")}}`;
  }

  function stableFingerprintEntities(items, idKey, mapper) {
    return asArray(items)
      .map(item => mapper(item || {}))
      .sort((left, right) => {
        const idComparison = canonicalString(left[idKey]).localeCompare(canonicalString(right[idKey]));
        return idComparison || canonicalString(left).localeCompare(canonicalString(right));
      });
  }

  function solveGroupFingerprintPayload(group, cuttingSettings) {
    return {
      cacheVersion: SOLVE_CACHE_VERSION,
      profileName: fingerprintField(group, "profileName", "string"),
      steelGrade: fingerprintField(group, "steelGrade", "string"),
      partRequirements: stableFingerprintEntities(group?.partRequirements, "partId", part => ({
        partId: fingerprintField(part, "partId", "string"),
        length: fingerprintField(part, "length", "number"),
        quantity: fingerprintField(part, "quantity", "number")
      })),
      stockOrders: stableFingerprintEntities(group?.stockOrders, "stockOrderId", order => ({
        stockOrderId: fingerprintField(order, "stockOrderId", "string"),
        length: fingerprintField(order, "length", "number"),
        availableQuantity: fingerprintField(order, "availableQuantity", "number"),
        price: fingerprintField(order, "price", "number")
      })),
      storageStock: stableFingerprintEntities(group?.storageStock, "groupedStorageStockId", stock => ({
        groupedStorageStockId: fingerprintField(stock, "groupedStorageStockId", "string"),
        length: fingerprintField(stock, "length", "number"),
        quantity: fingerprintField(stock, "quantity", "number")
      })),
      cuttingSettings: {
        toolWidth: fingerprintField(cuttingSettings, "toolWidth", "number"),
        trimStart: fingerprintField(cuttingSettings, "trimStart", "number"),
        trimEnd: fingerprintField(cuttingSettings, "trimEnd", "number"),
        reusableMinimumLength: fingerprintField(cuttingSettings, "reusableMinimumLength", "number")
      }
    };
  }

  function fallbackHash(value) {
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      first = Math.imul(first ^ code, 0x01000193) >>> 0;
      second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
      second = ((second << 13) | (second >>> 19)) >>> 0;
    }
    return `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
  }

  async function createGroupFingerprint(group, cuttingSettings) {
    const canonical = canonicalString(solveGroupFingerprintPayload(group, cuttingSettings || {}));
    try {
      if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
        const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
        return `${SOLVE_CACHE_VERSION}:sha256:${hash}`;
      }
    } catch {
      // Use the deterministic fallback below.
    }
    return `${SOLVE_CACHE_VERSION}:fallback:${fallbackHash(canonical)}`;
  }

  function planFromCollection(plans, groupId) {
    if (Array.isArray(plans)) {
      return plans.find(plan => plan?.groupId === groupId || plan?.id === groupId) || null;
    }
    return plans?.[groupId] || null;
  }

  const CacheDisposition = Object.freeze({
    REUSE: "Reuse",
    RETRY_BEST_KNOWN: "RetryBestKnown",
    SOLVE_REQUIRED: "SolveRequired"
  });

  function validCachedGroupEntry(entry, projectId, groupId, fingerprint) {
    return Boolean(
      entry
      && (!projectId || entry.projectId === projectId)
      && entry.groupId === groupId
      && entry.cacheVersion === SOLVE_CACHE_VERSION
      && entry.greedyCacheVersion === GREEDY_CACHE_VERSION
      && entry.fingerprint === fingerprint
      && entry.batchResultGroup?.groupId === groupId
      && entry.cuttingPlan?.groupId === groupId
    );
  }

  function cachedResultStatus(entry) {
    if (isGreedyOnlyResult(entry?.batchResultGroup) || isGreedyOnlyResult(entry?.cuttingPlan)) return "GreedyOnly";
    const reader = globalThis.NcNestingOptimization?.readOptimization;
    const batchStatus = typeof reader === "function" ? reader(entry?.batchResultGroup)?.status : null;
    const planStatus = typeof reader === "function" ? reader(entry?.cuttingPlan)?.status : null;
    return batchStatus || planStatus || null;
  }

  function finiteNonNegative(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function solveContextPressure(context) {
    return finiteNonNegative(context?.batchPressureScore ?? context?.pressure);
  }

  function solveContextGroupCount(context) {
    const number = Number(context?.backendRequestedGroupCount ?? context?.groupCount);
    return Number.isInteger(number) && number >= 0 ? number : null;
  }

  function pressureReductionRatio(previousContext, currentContext) {
    const previous = solveContextPressure(previousContext);
    const current = solveContextPressure(currentContext);
    if (!(previous > 0) || current == null || current >= previous) return 0;
    return (previous - current) / previous;
  }

  function groupCountReductionRatio(previousContext, currentContext) {
    const previous = solveContextGroupCount(previousContext);
    const current = solveContextGroupCount(currentContext);
    if (!(previous > 0) || current == null || current >= previous) return 0;
    return (previous - current) / previous;
  }

  function retryPolicy() {
    const configured = globalThis.NcNestingConfig?.bestKnownRetry || {};
    return {
      enabled: configured.enabled !== false,
      minimumPressureReductionRatio: Math.max(0, Number(configured.minimumPressureReductionRatio) || 0.18),
      supportedPressureReductionRatio: Math.max(0, Number(configured.supportedPressureReductionRatio) || 0.10),
      minimumGroupCountReductionRatio: Math.max(0, Number(configured.minimumGroupCountReductionRatio) || 0.35)
    };
  }

  function materiallyBetterSolveContext(previousContext, currentContext, policy) {
    if (!previousContext || !currentContext) return false;
    if (previousContext.complexityReliable !== true || currentContext.complexityReliable !== true) return false;
    const pressureReduction = pressureReductionRatio(previousContext, currentContext);
    if (pressureReduction >= policy.minimumPressureReductionRatio) return true;
    const countReduction = groupCountReductionRatio(previousContext, currentContext);
    return pressureReduction >= policy.supportedPressureReductionRatio
      && countReduction >= policy.minimumGroupCountReductionRatio;
  }

  function stopReasonRetryability(stopReason) {
    const normalize = globalThis.NcNestingOptimization?.normalizeStopReason;
    const reason = typeof normalize === "function" ? normalize(stopReason) : String(stopReason || "").trim().toLowerCase();
    if (!reason) return null;
    const nonRetryable = ["representation", "safety", "unsupported", "hard_limit", "hardlimit", "model_size", "size_limit"];
    if (nonRetryable.some(token => reason.includes(token))) return false;
    const retryable = ["batch_deadline", "shared_batch", "deadline", "time_limit", "timelimit", "work_limit", "worklimit", "effort", "time_slice", "timeslice", "solver_time", "solver_work", "optimization_budget", "budget_exhausted"];
    if (retryable.some(token => reason.includes(token))) return true;
    return null;
  }

  function combinedOptimizationMetadata(...sources) {
    const reader = globalThis.NcNestingOptimization?.readOptimization;
    if (typeof reader !== "function") return null;
    const metadata = sources.map(source => reader(source)).filter(Boolean);
    if (!metadata.length) return null;
    const firstValue = key => metadata.map(item => item?.[key]).find(value => value != null) ?? null;
    const provenCounts = metadata.map(item => item?.provenObjectiveCount).filter(value => Number.isInteger(value));
    return {
      status: firstValue("status"),
      bestFeasibleObjective: firstValue("bestFeasibleObjective"),
      bestProvenBound: firstValue("bestProvenBound"),
      provenOptimum: firstValue("provenOptimum"),
      stopReason: firstValue("stopReason"),
      provenObjectiveCount: provenCounts.length ? Math.max(...provenCounts) : null,
      objectiveProgress: firstValue("objectiveProgress")
    };
  }

  function optimizationOpportunity(entry) {
    const helper = globalThis.NcNestingOptimization?.optimizationOpportunity;
    if (typeof helper !== "function") {
      return {
        status: cachedResultStatus(entry),
        fullOptimumProven: cachedResultStatus(entry) === "Optimal",
        firstUnresolvedObjectiveIndex: null,
        primaryGap: null,
        hasExplicitUnresolvedEvidence: false,
        stopReason: null
      };
    }
    const combined = combinedOptimizationMetadata(entry?.batchResultGroup, entry?.cuttingPlan);
    return combined ? helper({ optimization: combined }) : helper(entry?.batchResultGroup) || helper(entry?.cuttingPlan);
  }

  function createSolveContextForGroups(groups, complexityResults) {
    const helper = globalThis.NcNestingSolvePreflight?.createSolveContext;
    if (typeof helper !== "function") return null;
    try {
      return helper(groups, complexityResults, { limits: globalThis.NcNestingConfig?.solvePreflightLimits });
    } catch {
      return null;
    }
  }

  function solveContextForCachedResult(baseContext, resultGroup, groupId, timestamp, resultPlan = null) {
    if (!baseContext) return null;
    const optimization = combinedOptimizationMetadata(resultGroup, resultPlan);
    return {
      ...clone(baseContext),
      solvedAtUtc: timestamp || new Date().toISOString(),
      groupComplexity: clone(baseContext?.perGroup?.[groupId] || null),
      ...(optimization?.stopReason ? { backendStopReason: optimization.stopReason } : {}),
      ...(optimization?.provenObjectiveCount != null ? { provenObjectiveCount: optimization.provenObjectiveCount } : {})
    };
  }

  function bestKnownRetryDecision(entry, currentContext, policy) {
    const opportunity = optimizationOpportunity(entry);
    if (opportunity.status !== "BestKnown" || opportunity.fullOptimumProven) return false;
    if (!materiallyBetterSolveContext(entry?.solveContext, currentContext, policy)) return false;
    const reasonRetryability = stopReasonRetryability(opportunity.stopReason || entry?.solveContext?.backendStopReason);
    if (reasonRetryability === false) return false;
    if (reasonRetryability === true) return true;
    return opportunity.hasExplicitUnresolvedEvidence === true;
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error("IndexedDB is not available."));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "batchId" });
        }
        const cacheStore = db.objectStoreNames.contains(GROUP_CACHE_STORE_NAME)
          ? request.transaction.objectStore(GROUP_CACHE_STORE_NAME)
          : db.createObjectStore(GROUP_CACHE_STORE_NAME, { keyPath: ["projectId", "groupId"] });
        if (!cacheStore.indexNames.contains(GROUP_CACHE_PROJECT_INDEX)) {
          cacheStore.createIndex(GROUP_CACHE_PROJECT_INDEX, "projectId", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Unable to open IndexedDB."));
      request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked."));
    });
  }

  async function putRecord(record) {
    try {
      const db = await openDatabase();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error("Unable to store solve result."));
      });
      db.close();
      return;
    } catch {
      localStorage.setItem(`${DB_NAME}:${record.batchId}`, JSON.stringify(record));
    }
  }

  async function getRecord(batchId) {
    if (!batchId) return null;
    try {
      const db = await openDatabase();
      const record = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(batchId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error("Unable to read solve result."));
      });
      db.close();
      if (record) return record;
    } catch {
      // Fall back to localStorage below.
    }

    const raw = localStorage.getItem(`${DB_NAME}:${batchId}`);
    return raw ? JSON.parse(raw) : null;
  }

  function transactionComplete(transaction, errorMessage) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error(errorMessage));
      transaction.onabort = () => reject(transaction.error || new Error(errorMessage));
    });
  }

  function requestResult(request, errorMessage) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error || new Error(errorMessage));
    });
  }

  async function readGroupCacheEntries(projectId, groupIds) {
    const db = await openDatabase();
    try {
      const tx = db.transaction(GROUP_CACHE_STORE_NAME, "readonly");
      const completed = transactionComplete(tx, "Unable to read cached group results.");
      const store = tx.objectStore(GROUP_CACHE_STORE_NAME);
      const records = await Promise.all(groupIds.map(groupId => requestResult(
        store.get([projectId, groupId]),
        "Unable to read cached group result."
      )));
      await completed;
      return new Map(groupIds.map((groupId, index) => [groupId, records[index]]));
    } finally {
      db.close();
    }
  }

  async function cleanupProjectGroupCache(projectId, currentGroupIds) {
    if (!projectId) return;
    const current = new Set(currentGroupIds || []);
    const db = await openDatabase();
    try {
      const tx = db.transaction(GROUP_CACHE_STORE_NAME, "readwrite");
      const completed = transactionComplete(tx, "Unable to clean cached group results.");
      const index = tx.objectStore(GROUP_CACHE_STORE_NAME).index(GROUP_CACHE_PROJECT_INDEX);
      await new Promise((resolve, reject) => {
        const request = index.openCursor(projectId);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve();
            return;
          }
          if (!current.has(cursor.value.groupId)) cursor.delete();
          cursor.continue();
        };
        request.onerror = () => reject(request.error || new Error("Unable to clean cached group results."));
      });
      await completed;
    } finally {
      db.close();
    }
  }

  async function prepareIncrementalSolve(request, projectId, options = {}) {
    const groups = asArray(request?.groups);
    const complexityResults = options?.complexityResults || [];
    const fingerprints = new Map();
    const noCacheResult = () => {
      const problemChangedGroups = clone(groups);
      const solveContext = createSolveContextForGroups(groups, complexityResults);
      return {
        cacheAvailable: false,
        fingerprints,
        cachedEntries: new Map(),
        dispositions: new Map(groups.map(group => [group.groupId, CacheDisposition.SOLVE_REQUIRED])),
        problemChangedGroups,
        solveRequiredCachedGroups: [],
        retryGroups: [],
        groupsToSolve: clone(groups),
        changedGroups: clone(groups),
        unchangedGroupIds: [],
        reusableGroupIds: [],
        solveContext
      };
    };

    try {
      await Promise.all(groups.map(async group => {
        fingerprints.set(group.groupId, await createGroupFingerprint(group, request?.cuttingSettings || {}));
      }));
    } catch {
      return noCacheResult();
    }

    if (!projectId || groups.some(group => !cleanName(group?.groupId))) return noCacheResult();

    try {
      const groupIds = groups.map(group => group.groupId);
      const records = await readGroupCacheEntries(projectId, groupIds);
      await Promise.all(groups.map(async group => {
        const entry = records.get(group.groupId);
        if (!entry?.batchResultGroup) return;
        entry.batchResultGroup = await attachCatalogueWeightToGroup(entry.batchResultGroup, group.profileName);
      }));
      const cachedEntries = new Map();
      const dispositions = new Map();
      const problemChangedGroups = [];
      const solveRequiredCachedGroups = [];
      const bestKnownCandidates = [];
      const unchangedGroupIds = [];

      groups.forEach(group => {
        const fingerprint = fingerprints.get(group.groupId);
        const entry = records.get(group.groupId);
        if (!validCachedGroupEntry(entry, projectId, group.groupId, fingerprint)) {
          dispositions.set(group.groupId, CacheDisposition.SOLVE_REQUIRED);
          problemChangedGroups.push(clone(group));
          return;
        }

        cachedEntries.set(group.groupId, entry);
        unchangedGroupIds.push(group.groupId);
        const status = cachedResultStatus(entry);
        if (status === "Optimal") {
          dispositions.set(group.groupId, CacheDisposition.REUSE);
        } else if (status === "BestKnown") {
          dispositions.set(group.groupId, CacheDisposition.REUSE);
          bestKnownCandidates.push({ group: clone(group), entry, opportunity: optimizationOpportunity(entry) });
        } else if (status === "GreedyOnly" || status === "Failed") {
          dispositions.set(group.groupId, CacheDisposition.SOLVE_REQUIRED);
          solveRequiredCachedGroups.push(clone(group));
        } else {
          // Preserve legacy backend cache entries that predate explicit optimization status.
          dispositions.set(group.groupId, CacheDisposition.REUSE);
        }
      });

      const mandatoryGroups = [...problemChangedGroups, ...solveRequiredCachedGroups];
      const policy = retryPolicy();
      const retryGroups = [];
      if (policy.enabled && bestKnownCandidates.length) {
        bestKnownCandidates.forEach(candidate => {
          const context = createSolveContextForGroups([...mandatoryGroups, candidate.group], complexityResults);
          candidate.preliminaryContext = context;
          candidate.pressureReduction = pressureReductionRatio(candidate.entry?.solveContext, context);
          candidate.currentCost = finiteNonNegative(context?.perGroup?.[candidate.group.groupId]?.cost);
        });

        bestKnownCandidates.sort((left, right) => {
          const leftHasPrimaryGap = Number(left.opportunity?.primaryGap) > 0 ? 1 : 0;
          const rightHasPrimaryGap = Number(right.opportunity?.primaryGap) > 0 ? 1 : 0;
          if (leftHasPrimaryGap !== rightHasPrimaryGap) return rightHasPrimaryGap - leftHasPrimaryGap;
          const gapDifference = (Number(right.opportunity?.primaryGap) || 0) - (Number(left.opportunity?.primaryGap) || 0);
          if (gapDifference) return gapDifference;
          const pressureDifference = (right.pressureReduction || 0) - (left.pressureReduction || 0);
          if (pressureDifference) return pressureDifference;
          const leftCost = left.currentCost == null ? Number.POSITIVE_INFINITY : left.currentCost;
          const rightCost = right.currentCost == null ? Number.POSITIVE_INFINITY : right.currentCost;
          if (leftCost !== rightCost) return leftCost - rightCost;
          return String(left.group.groupId).localeCompare(String(right.group.groupId));
        });

        bestKnownCandidates.forEach(candidate => {
          const proposedGroups = [...mandatoryGroups, ...retryGroups, candidate.group];
          const currentContext = createSolveContextForGroups(proposedGroups, complexityResults);
          if (!bestKnownRetryDecision(candidate.entry, currentContext, policy)) return;
          retryGroups.push(clone(candidate.group));
          dispositions.set(candidate.group.groupId, CacheDisposition.RETRY_BEST_KNOWN);
        });
      }

      const solveGroupIds = new Set([
        ...mandatoryGroups.map(group => group.groupId),
        ...retryGroups.map(group => group.groupId)
      ]);
      const groupsToSolve = groups.filter(group => solveGroupIds.has(group.groupId)).map(clone);
      const reusableGroupIds = groups.filter(group => !solveGroupIds.has(group.groupId)).map(group => group.groupId);
      const solveContext = createSolveContextForGroups(groupsToSolve, complexityResults);

      try {
        await cleanupProjectGroupCache(projectId, groupIds);
      } catch {
        // Cache cleanup must not block solving.
      }
      return {
        cacheAvailable: true,
        fingerprints,
        cachedEntries,
        dispositions,
        problemChangedGroups,
        solveRequiredCachedGroups,
        retryGroups,
        groupsToSolve,
        // Backwards-compatible alias: callers that still use changedGroups will
        // submit every group that now requires backend work, including retries.
        changedGroups: clone(groupsToSolve),
        unchangedGroupIds,
        reusableGroupIds,
        solveContext
      };
    } catch {
      return noCacheResult();
    }
  }

  async function writeGroupSolveCache(projectId, groupIds, fingerprints, normalized, greedyBaselines = {}, solveContext = null) {
    if (!projectId || !groupIds?.length) return;
    const weightedBatchResult = await attachCatalogueWeights(normalized?.batchResult || null);
    const groupsById = new Map(asArray(weightedBatchResult?.groups).map(group => [group.groupId, group]));
    const timestamp = new Date().toISOString();
    const entries = groupIds.map(groupId => {
      const resultGroup = groupsById.get(groupId);
      const resultPlan = planFromCollection(normalized?.plans, groupId);
      return {
        projectId,
        groupId,
        fingerprint: fingerprints.get(groupId),
        batchResultGroup: clone(resultGroup),
        cuttingPlan: clone(resultPlan),
        greedyBaseline: greedyBaselines?.[groupId] ? clone(greedyBaselines[groupId]) : null,
        cacheVersion: SOLVE_CACHE_VERSION,
        greedyCacheVersion: GREEDY_CACHE_VERSION,
        successfulSolveTimestamp: timestamp,
        solveContext: solveContextForCachedResult(solveContext, resultGroup, groupId, timestamp, resultPlan),
        orderQuantityAdjustments: {}
      };
    });

    if (entries.some(entry => !entry.fingerprint || entry.batchResultGroup?.groupId !== entry.groupId || entry.cuttingPlan?.groupId !== entry.groupId)) {
      throw serviceError("The returned result could not be processed.", "INVALID_RESULT");
    }

    const db = await openDatabase();
    try {
      const tx = db.transaction(GROUP_CACHE_STORE_NAME, "readwrite");
      const completed = transactionComplete(tx, "Unable to store cached group results.");
      const store = tx.objectStore(GROUP_CACHE_STORE_NAME);
      entries.forEach(entry => store.put(entry));
      await completed;
    } finally {
      db.close();
    }
  }

  function groupOrderQuantityAdjustments(group) {
    const adjustments = {};
    asArray(group?.stockOrders).forEach((order, orderIndex) => {
      adjustments[orderQuantityKey(group, order, orderIndex)] = Math.max(0, Math.trunc(Number(order?.orderQuantity) || 0));
    });
    return adjustments;
  }

  async function updateCachedOrderQuantityAdjustments(projectId, groups, fingerprints) {
    if (!projectId || !asArray(groups).length || !fingerprints) return;
    const db = await openDatabase();
    try {
      const tx = db.transaction(GROUP_CACHE_STORE_NAME, "readwrite");
      const completed = transactionComplete(tx, "Unable to update cached order quantities.");
      const store = tx.objectStore(GROUP_CACHE_STORE_NAME);
      asArray(groups).forEach(group => {
        const request = store.get([projectId, group.groupId]);
        request.onsuccess = () => {
          const entry = request.result;
          if (!entry || entry.fingerprint !== fingerprints[group.groupId]) return;
          entry.orderQuantityAdjustments = groupOrderQuantityAdjustments(group);
          store.put(entry);
        };
      });
      await completed;
    } finally {
      db.close();
    }
  }

  function saveActiveProject(project) {
    if (!project) return null;
    const stored = clone(project);
    stored.updatedAtUtc = new Date().toISOString();
    try {
      localStorage.setItem(ACTIVE_PROJECT_KEY, JSON.stringify(stored));
    } catch {
      // Keep the working copy in memory when browser storage is unavailable.
    }
    return stored;
  }

  function getActiveProject() {
    try {
      const raw = localStorage.getItem(ACTIVE_PROJECT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      try { localStorage.removeItem(ACTIVE_PROJECT_KEY); } catch { /* Storage is unavailable. */ }
      return null;
    }
  }

  function clearActiveProject() {
    try { localStorage.removeItem(ACTIVE_PROJECT_KEY); } catch { /* Storage is unavailable. */ }
  }


  function orderQuantityKey(group, order, orderIndex) {
    return [
      group?.groupId || "",
      order?.stockOrderId || order?.stockTypeId || "",
      order?.stockLength ?? order?.length ?? "",
      orderIndex
    ].join("\u0000");
  }

  function collectOrderQuantities(groups) {
    const quantities = {};
    (groups || []).forEach(group => {
      (group.stockOrders || []).forEach((order, orderIndex) => {
        quantities[orderQuantityKey(group, order, orderIndex)] = Math.max(0, Math.trunc(Number(order.orderQuantity) || 0));
      });
    });
    return quantities;
  }

  function readOrderQuantities(batchId, record) {
    if (!batchId) return record?.orderQuantities || {};
    try {
      const raw = localStorage.getItem(ORDER_QUANTITIES_KEY(batchId));
      if (raw) return JSON.parse(raw);
    } catch {
      // Use the solved-batch record fallback below.
    }
    return record?.orderQuantities || record?.project?.orderQuantities || {};
  }

  function applyOrderQuantities(batchResult, batchId, record) {
    const adjusted = clone(batchResult);
    const quantities = readOrderQuantities(batchId || adjusted?.batchId, record);
    (adjusted?.groups || []).forEach(group => {
      (group.stockOrders || []).forEach((order, orderIndex) => {
        const key = orderQuantityKey(group, order, orderIndex);
        if (Object.prototype.hasOwnProperty.call(quantities, key)) {
          order.orderQuantity = Math.max(0, Math.trunc(Number(quantities[key]) || 0));
        }
      });
    });
    return adjusted;
  }

  function saveOrderQuantities(batchId, groups) {
    if (!batchId) return {};
    const quantities = collectOrderQuantities(groups);
    try { localStorage.setItem(ORDER_QUANTITIES_KEY(batchId), JSON.stringify(quantities)); } catch { /* Storage is unavailable. */ }

    const activeProject = getActiveProject();
    if (activeProject && (!activeProject.batchId || activeProject.batchId === batchId)) {
      activeProject.batchId = batchId;
      activeProject.orderQuantities = clone(quantities);
      saveActiveProject(activeProject);
    }

    getRecord(batchId).then(async record => {
      const projectId = record?.project?.projectId || activeProject?.projectId;
      if (record) {
        record.orderQuantities = clone(quantities);
        if (record.project) record.project.orderQuantities = clone(quantities);
        await putRecord(record);
      }
      if (projectId) await updateCachedOrderQuantityAdjustments(projectId, groups, record?.groupFingerprints);
    }).catch(() => { /* The solved-batch copy is already current. */ });

    return quantities;
  }

  function normalizeSolveResponse(response) {
    const container = response?.result || response || {};
    const rawBatchResult = container.batchResult || container.batch || null;
    const rawPlans = container.plans || container.groupPlans || {};
    const succeeded = response?.succeeded ?? container.succeeded ?? Boolean(rawBatchResult);
    const errors = response?.errors || container.errors || [];

    if (!succeeded) return { succeeded: false, errors };
    if (!rawBatchResult) {
      return {
        succeeded: false,
        errors: [{ profileName: "Batch", message: "The returned result could not be processed." }]
      };
    }

    const batchResult = normalizeBatchResultShape(rawBatchResult, container);
    const plans = normalizePlansShape(rawPlans);

    const batchId = batchResult.batchId || response?.batchId || container.batchId;
    if (!batchId) {
      return {
        succeeded: false,
        errors: [{ profileName: "Batch", message: "The returned result could not be processed." }]
      };
    }

    batchResult.batchId = batchId;
    return { succeeded: true, batchId, batchResult, plans };
  }

  function validateChangedGroupResults(normalized, changedGroupIds) {
    const expectedIds = new Set(changedGroupIds || []);
    const resultGroups = asArray(normalized?.batchResult?.groups);
    const resultIds = resultGroups.map(group => group?.groupId);
    const uniqueResultIds = new Set(resultIds);

    if (
      resultGroups.length !== expectedIds.size
      || uniqueResultIds.size !== expectedIds.size
      || resultIds.some(groupId => !expectedIds.has(groupId))
    ) {
      throw serviceError("The returned result could not be processed.", "INVALID_RESULT");
    }

    const planIds = Array.isArray(normalized?.plans)
      ? normalized.plans.map(plan => plan?.groupId || plan?.id)
      : Object.keys(normalized?.plans || {});
    const uniquePlanIds = new Set(planIds);
    if (
      planIds.length !== expectedIds.size
      || uniquePlanIds.size !== expectedIds.size
      || planIds.some(groupId => !expectedIds.has(groupId))
    ) {
      throw serviceError("The returned result could not be processed.", "INVALID_RESULT");
    }

    expectedIds.forEach(groupId => {
      const group = resultGroups.find(candidate => candidate?.groupId === groupId);
      const plan = planFromCollection(normalized.plans, groupId);
      if (!group || !plan || plan.groupId !== groupId) {
        throw serviceError("The returned result could not be processed.", "INVALID_RESULT");
      }
    });
  }

  function applyCachedOrderQuantityAdjustments(group, adjustments) {
    const adjusted = clone(group);
    asArray(adjusted?.stockOrders).forEach((order, orderIndex) => {
      const key = orderQuantityKey(adjusted, order, orderIndex);
      if (hasOwn(adjustments, key)) {
        order.orderQuantity = Math.max(0, Math.trunc(Number(adjustments[key]) || 0));
      }
    });
    return adjusted;
  }

  function sumGroupValue(groups, ...keys) {
    return groups.reduce((total, group) => total + (pickFirstNumber(...keys.map(key => group?.[key])) || 0), 0);
  }

  function rebuildBatchTotals(batchResult, groups) {
    const rebuilt = clone(batchResult || {});
    const totals = {
      totalStockLengthConsumed: sumGroupValue(groups, "totalStockLengthConsumed", "totalStockLength"),
      totalConsumedLength: sumGroupValue(groups, "totalConsumedLength", "actualConsumedLength"),
      totalPartLength: sumGroupValue(groups, "totalPartLength", "finishedPartLength", "selectedPartLength"),
      totalOffcutLength: sumGroupValue(groups, "totalOffcutLength"),
      totalStorageStockLengthConsumed: sumGroupValue(groups, "totalStorageStockLengthConsumed", "storageStockLengthConsumed"),
      totalReusableOffcutLength: sumGroupValue(groups, "totalReusableOffcutLength", "reusableOffcutLength"),
      storageStockQuantity: sumGroupValue(groups, "storageStockQuantity", "storageStockQuantityUsed"),
      stockOrderQuantity: sumGroupValue(groups, "stockOrderQuantity"),
      stockOrderCost: sumGroupValue(groups, "stockOrderCost")
    };

    Object.assign(rebuilt, totals);
    if (hasOwn(rebuilt, "totalStockLength")) rebuilt.totalStockLength = totals.totalStockLengthConsumed;
    if (hasOwn(rebuilt, "actualConsumedLength")) rebuilt.actualConsumedLength = totals.totalConsumedLength;
    if (hasOwn(rebuilt, "finishedPartLength")) rebuilt.finishedPartLength = totals.totalPartLength;
    if (hasOwn(rebuilt, "selectedPartLength")) rebuilt.selectedPartLength = totals.totalPartLength;
    if (hasOwn(rebuilt, "storageStockLengthConsumed")) rebuilt.storageStockLengthConsumed = totals.totalStorageStockLengthConsumed;
    if (hasOwn(rebuilt, "reusableOffcutLength")) rebuilt.reusableOffcutLength = totals.totalReusableOffcutLength;
    if (hasOwn(rebuilt, "storageStockQuantityUsed")) rebuilt.storageStockQuantityUsed = totals.storageStockQuantity;
    if (rebuilt.totals && typeof rebuilt.totals === "object" && !Array.isArray(rebuilt.totals)) {
      rebuilt.totals = { ...rebuilt.totals, ...totals };
    }
    return rebuilt;
  }

  function mergeIncrementalSolveResult(request, incremental, backendResult, solvedGreedyBaselines = {}, solveContext = null) {
    const groupsToSolve = incremental.groupsToSolve || incremental.changedGroups || [];
    const solvedGroupIds = groupsToSolve.map(group => group.groupId);
    if (backendResult) validateChangedGroupResults(backendResult, solvedGroupIds);
    if (!backendResult && solvedGroupIds.length) {
      throw serviceError("The returned result could not be processed.", "INVALID_RESULT");
    }

    const solvedGroupsById = new Map(asArray(backendResult?.batchResult?.groups).map(group => [group.groupId, group]));
    const groups = [];
    const plans = {};
    const orderQuantities = {};
    const greedyBaselines = {};
    const groupSolveContexts = {};
    const generatedAt = backendResult?.batchResult?.generatedAt || new Date().toISOString();

    asArray(request?.groups).forEach(requestGroup => {
      const groupId = requestGroup.groupId;
      if (solvedGroupsById.has(groupId)) {
        const solvedGroup = solvedGroupsById.get(groupId);
        groups.push(clone(solvedGroup));
        const solvedPlan = planFromCollection(backendResult.plans, groupId);
        plans[groupId] = clone(solvedPlan);
        if (solvedGreedyBaselines?.[groupId]) greedyBaselines[groupId] = clone(solvedGreedyBaselines[groupId]);
        const storedContext = solveContextForCachedResult(solveContext, solvedGroup, groupId, generatedAt, solvedPlan);
        if (storedContext) groupSolveContexts[groupId] = storedContext;
        return;
      }

      const entry = incremental.cachedEntries.get(groupId);
      if (!validCachedGroupEntry(entry, null, groupId, incremental.fingerprints.get(groupId))) {
        throw serviceError("The cached result could not be processed.", "INVALID_RESULT");
      }
      groups.push(applyCachedOrderQuantityAdjustments(entry.batchResultGroup, entry.orderQuantityAdjustments || {}));
      Object.assign(orderQuantities, entry.orderQuantityAdjustments || {});
      plans[groupId] = clone(entry.cuttingPlan);
      if (entry.greedyBaseline) greedyBaselines[groupId] = clone(entry.greedyBaseline);
      if (entry.solveContext) groupSolveContexts[groupId] = clone(entry.solveContext);
    });

    const batchId = backendResult?.batchId || request?.requestId || createRequestId();
    const template = backendResult?.batchResult || {};
    const batchResult = rebuildBatchTotals(template, groups);
    batchResult.status = batchResult.status || "Completed";
    batchResult.batchId = batchId;
    batchResult.generatedAt = generatedAt;
    batchResult.currency = cleanName(request?.currency) || null;
    batchResult.groups = groups;

    return {
      succeeded: true,
      batchId,
      batchResult,
      plans,
      greedyBaselines,
      groupSolveContexts,
      orderQuantities,
      groupFingerprints: Object.fromEntries(incremental.fingerprints || [])
    };
  }

  function serviceError(message, code, details = {}) {
    const error = new Error(message);
    error.code = code;
    Object.assign(error, details);
    return error;
  }

  function responseErrors(body) {
    const container = body?.result || body || {};
    const errors = body?.errors || container?.errors;
    return Array.isArray(errors) ? errors : [];
  }

  function responseErrorMessage(body) {
    const errors = responseErrors(body);
    const firstMessage = errors.map(error => String(error?.message || "").trim()).find(Boolean);
    if (firstMessage) return firstMessage;
    const container = body?.result || body || {};
    return String(container?.message || body?.message || "").trim();
  }

  async function postSolve(payload) {
    const solveUrl = String(config().solveUrl || "").trim();
    if (!solveUrl || solveUrl.includes("YOUR_FUNCTION_APP")) {
      throw serviceError("The calculation service is currently unavailable.", "SERVICE_UNAVAILABLE");
    }

    const controller = new AbortController();
    let safetyTimeoutReached = false;
    const timeout = setTimeout(() => {
      safetyTimeoutReached = true;
      controller.abort();
    }, Number(config().requestTimeoutMs) || 150000);
    try {
      const response = await fetch(solveUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload),
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store"
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw serviceError(
          responseErrorMessage(body) || "The job could not be solved. Please try again.",
          "BACKEND_HTTP_ERROR",
          { httpStatus: response.status, backendErrors: responseErrors(body) }
        );
      }

      const normalized = normalizeSolveResponse(body);
      if (!normalized.succeeded && (!Array.isArray(normalized.errors) || !normalized.errors.length)) {
        throw serviceError("The returned result could not be processed.", "INVALID_RESULT");
      }
      if (normalized.succeeded) {
        normalized.batchResult = await attachCatalogueWeights(normalized.batchResult);
      }
      return normalized;
    } catch (error) {
      if (error?.name === "AbortError" && safetyTimeoutReached) {
        throw serviceError("The calculation service stopped responding.", "SAFETY_TIMEOUT");
      }
      if (typeof error?.code === "string" && error.code) throw error;
      if (error?.name === "AbortError" || error instanceof TypeError) {
        throw serviceError("The calculation service is currently unavailable.", "SERVICE_UNAVAILABLE");
      }
      throw serviceError("The job could not be solved. Please try again.", "JOB_FAILED");
    } finally {
      clearTimeout(timeout);
    }
  }

  function projectGroup(project, groupId) {
    return (project?.groups || []).find(group => group.groupId === groupId) || null;
  }

  function enrichBatchResult(batchResult, project) {
    const enriched = clone(batchResult);
    enriched.currency = hasOwn(project, "currency")
      ? (cleanName(project.currency) || null)
      : (cleanName(enriched.currency) || null);
    enriched.groups = (enriched.groups || []).map(group => {
      const frontendGroup = projectGroup(project, group.groupId);
      const ordersById = new Map((frontendGroup?.stockOrders || []).map(order => [order.stockOrderId, order]));
      const stockOrdersFromResult = asArray(group.stockOrders).length
        ? asArray(group.stockOrders)
        : asArray(group.lengthSubgroups)
          .filter(subgroup => {
            const requiredQuantity = pickFirstNumber(subgroup.stockOrderQuantityRequired, subgroup.stockOrderQuantity, 0) || 0;
            return requiredQuantity > 0 || subgroup.stockOrderId;
          })
          .map(subgroup => ({
            stockOrderId: subgroup.stockOrderId || null,
            stockTypeId: subgroup.stockTypeId || subgroup.stockOrderId || null,
            stockLength: pickFirstNumber(subgroup.stockLength, subgroup.length),
            requiredQuantity: pickFirstNumber(subgroup.stockOrderQuantityRequired, subgroup.stockOrderQuantity, 0) || 0,
            orderQuantity: pickFirstNumber(subgroup.stockOrderQuantityRequired, subgroup.stockOrderQuantity, 0) || 0,
            unitPrice: pickFirstNumber(subgroup.unitPrice),
            stockOrderCost: pickFirstNumber(subgroup.stockOrderCost)
          }));
      const stockOrders = stockOrdersFromResult.map(order => {
        const stockOrderId = order.stockOrderId || order.stockTypeId;
        const frontendOrder = ordersById.get(stockOrderId)
          || (frontendGroup?.stockOrders || []).find(candidate => pickFirstNumber(candidate.length) === pickFirstNumber(order.stockLength, order.length));
        return {
          ...order,
          stockOrderId,
          stockTypeId: order.stockTypeId || stockOrderId,
          stockLength: order.stockLength ?? frontendOrder?.length ?? null,
          unitPrice: order.unitPrice ?? frontendOrder?.price ?? null,
          requiredQuantity: pickFirstNumber(order.requiredQuantity, order.selectedQuantity, order.orderQuantity, 0) || 0,
          orderQuantity: pickFirstNumber(order.orderQuantity, order.selectedQuantity, order.requiredQuantity, 0) || 0
        };
      });

      return {
        ...group,
        profileName: group.profileName || frontendGroup?.profileName || "",
        steelGrade: group.steelGrade || frontendGroup?.steelGrade || "",
        stockOrders,
        frontendPartRequirements: clone(frontendGroup?.partRequirements || [])
      };
    });
    return enriched;
  }

  function enrichPlan(plan, project, groupId) {
    const enriched = clone(plan);
    const frontendGroup = projectGroup(project, groupId || enriched?.groupId);
    if (!frontendGroup) return enriched;

    const partsById = new Map((frontendGroup.partRequirements || []).map(part => [part.partId, part]));
    const ordersById = new Map((frontendGroup.stockOrders || []).map(order => [order.stockOrderId, order]));
    const storageById = new Map();
    const storageQueues = new Map();
    (frontendGroup.storageStock || []).forEach(grouped => {
      const queue = [];
      (grouped.sourceRecords || []).forEach(record => {
        const normalized = { ...record, length: grouped.length, groupedStorageStockId: grouped.groupedStorageStockId };
        storageById.set(record.storageStockId, normalized);
        for (let index = 0; index < Number(record.quantity || 0); index++) queue.push(normalized);
      });
      storageQueues.set(grouped.groupedStorageStockId, queue);
    });

    enriched.profileName = enriched.profileName || frontendGroup.profileName;
    enriched.steelGrade = enriched.steelGrade || frontendGroup.steelGrade;
    const responseParts = enriched.requestedParts?.length
      ? enriched.requestedParts
      : (frontendGroup.partRequirements || []).map(part => ({
        partId: part.partId,
        length: part.length,
        requestedQuantity: part.quantity
      }));
    enriched.requestedParts = responseParts.map(part => ({
      ...part,
      sources: clone(partsById.get(part.partId)?.sources || [])
    }));
    enriched.stockOrderOptions = (enriched.stockOrderOptions || []).map(order => {
      const stockOrderId = order.stockOrderId || order.stockTypeId;
      const frontendOrder = ordersById.get(stockOrderId);
      return {
        ...order,
        stockOrderId,
        stockTypeId: order.stockTypeId || stockOrderId,
        length: order.length ?? frontendOrder?.length,
        availableQuantity: order.availableQuantity ?? frontendOrder?.availableQuantity,
        cost: order.cost ?? frontendOrder?.price
      };
    });

    enriched.stockPieces = (enriched.stockPieces || []).map(piece => {
      const groupedStorageStockId = piece.groupedStorageStockId || piece.stockTypeId;
      const storage = piece.stockSource === "StorageStock"
        ? storageById.get(piece.storageStockId) || storageQueues.get(groupedStorageStockId)?.shift() || null
        : null;
      const stockOrderId = piece.stockOrderId || piece.stockTypeId;
      const order = ordersById.get(stockOrderId);
      return {
        ...piece,
        groupedStorageStockId: piece.stockSource === "StorageStock" ? groupedStorageStockId : null,
        storageStockId: piece.storageStockId || storage?.storageStockId || null,
        stockOrderId: piece.stockSource === "StorageStock" ? null : stockOrderId,
        stockTypeId: piece.stockTypeId || stockOrderId,
        stockLength: piece.stockLength ?? storage?.length ?? order?.length,
        storageArea: piece.storageArea ?? storage?.storageArea ?? null,
        segments: (piece.segments || []).map(segment => ({
          ...segment,
          sources: segment.partId ? clone(partsById.get(segment.partId)?.sources || []) : undefined
        }))
      };
    });

    const responseRetrievals = enriched.storageRetrievals || [];
    if (responseRetrievals.length) {
      enriched.storageRetrievals = responseRetrievals.map(record => {
        const storage = storageById.get(record.storageStockId);
        return {
          ...record,
          stockLength: record.stockLength ?? storage?.length,
          storageArea: record.storageArea ?? storage?.storageArea ?? null
        };
      });
    } else {
      const retrievals = new Map();
      enriched.stockPieces
        .filter(piece => piece.stockSource === "StorageStock" && piece.storageStockId)
        .forEach(piece => {
          if (!retrievals.has(piece.storageStockId)) {
            retrievals.set(piece.storageStockId, {
              storageStockId: piece.storageStockId,
              quantity: 0,
              stockLength: piece.stockLength,
              storageArea: piece.storageArea,
              totalPartLength: 0,
              wasteLength: 0
            });
          }
          const record = retrievals.get(piece.storageStockId);
          record.quantity++;
          record.totalPartLength += (piece.segments || [])
            .filter(segment => segment.type === "Part")
            .reduce((total, segment) => total + Number(segment.length || 0), 0);
          record.wasteLength += (piece.segments || [])
            .filter(segment => segment.type === "ReusableOffcut" || segment.type === "NonReusableOffcut")
            .reduce((total, segment) => total + Number(segment.length || 0), 0);
        });
      enriched.storageRetrievals = [...retrievals.values()];
    }
    return enriched;
  }

  function applyRecordMetadataToBatch(batchResult, record) {
    const enriched = clone(batchResult);
    enriched.projectName = cleanName(record?.project?.projectName || record?.batchResult?.projectName);
    enriched.batchName = cleanName(record?.batchName || record?.project?.batchName || record?.batchResult?.batchName);
    if (hasOwn(record?.project, "currency")) enriched.currency = cleanName(record.project.currency) || null;
    return enriched;
  }

  function applyRecordMetadataToPlan(plan, record) {
    const enriched = clone(plan);
    enriched.projectName = cleanName(record?.project?.projectName || record?.batchResult?.projectName);
    enriched.batchName = cleanName(record?.batchName || record?.project?.batchName || record?.batchResult?.batchName);
    enriched.currency = hasOwn(record?.project, "currency")
      ? (cleanName(record.project.currency) || null)
      : (cleanName(enriched.currency) || null);
    return enriched;
  }

  async function saveSolveResponse(normalized, project) {
    const projectSnapshot = clone(project || getActiveProject());
    normalized.batchResult = await attachCatalogueWeights(normalized.batchResult, projectSnapshot);
    if (projectSnapshot) {
      projectSnapshot.batchId = normalized.batchId;
      projectSnapshot.solveResponse = {
        batchId: normalized.batchId,
        batchResult: clone(normalized.batchResult),
        plans: clone(normalized.plans || {}),
        greedyBaselines: clone(normalized.greedyBaselines || {}),
        groupSolveContexts: clone(normalized.groupSolveContexts || {})
      };
      if (hasOwn(normalized, "orderQuantities")) {
        projectSnapshot.orderQuantities = clone(normalized.orderQuantities || {});
      }
      if (hasOwn(normalized, "groupFingerprints")) {
        projectSnapshot.groupFingerprints = clone(normalized.groupFingerprints || {});
      }
      if (hasOwn(normalized, "groupSolveContexts")) {
        projectSnapshot.groupSolveContexts = clone(normalized.groupSolveContexts || {});
      }
      saveActiveProject(projectSnapshot);
    }

    const batchName = cleanName(projectSnapshot?.batchName || normalized.batchResult?.batchName);
    const record = {
      batchId: normalized.batchId,
      batchName,
      batchResult: { ...normalized.batchResult, batchName },
      plans: normalized.plans || {},
      greedyBaselines: clone(normalized.greedyBaselines || {}),
      groupSolveContexts: clone(normalized.groupSolveContexts || {}),
      project: projectSnapshot ? { ...projectSnapshot, batchName } : projectSnapshot,
      ...(hasOwn(normalized, "orderQuantities") ? { orderQuantities: clone(normalized.orderQuantities || {}) } : {}),
      ...(hasOwn(normalized, "groupFingerprints") ? { groupFingerprints: clone(normalized.groupFingerprints || {}) } : {}),
      storedAtUtc: new Date().toISOString()
    };
    await putRecord(record);
    return record;
  }

  async function getBatchResult(batchId) {
    const record = await getRecord(batchId);
    if (!record?.batchResult) return null;
    const normalizedBatch = attachGreedyBaselinesToBatch(attachPlanMetadataToBatch(normalizeBatchResultShape(record.batchResult, {
      batchId: record.batchId,
      currency: hasOwn(record.project, "currency") ? record.project.currency : (record.batchResult?.currency || null),
      generatedAt: record.batchResult?.generatedAt || record.storedAtUtc || null,
      status: record.batchResult?.status || "Completed"
    }), record.plans || {}), record.greedyBaselines || {});
    const enriched = applyRecordMetadataToBatch(enrichBatchResult(normalizedBatch, record.project), record);
    const weighted = await attachCatalogueWeights(enriched, record.project);
    return applyOrderQuantities(weighted, batchId, record);
  }

  async function getPlan(batchId, groupId) {
    const record = await getRecord(batchId);
    if (!record) return null;
    const normalizedPlans = normalizePlansShape(record.plans || {});
    let plan;
    if (Array.isArray(normalizedPlans)) {
      plan = normalizedPlans.find(item => item.groupId === groupId || item.id === groupId) || null;
    } else {
      plan = normalizedPlans?.[groupId] || null;
    }
    if (!plan) return null;
    const enrichedPlan = applyRecordMetadataToPlan(enrichPlan(plan, record.project, groupId), record);
    const normalizedBatch = normalizeBatchResultShape(record.batchResult || {}, { batchId: record.batchId });
    const group = asArray(normalizedBatch.groups).find(item => item.groupId === groupId);
    const groupOptimization = normalizeOptimizationMetadata(group);
    const planOptimization = normalizeOptimizationMetadata(enrichedPlan);
    const optimization = groupOptimization || planOptimization
      ? {
        ...(groupOptimization || {}),
        ...(planOptimization || {}),
        status: planOptimization?.status || groupOptimization?.status || null,
        bestFeasibleObjective: planOptimization?.bestFeasibleObjective || groupOptimization?.bestFeasibleObjective || null,
        bestProvenBound: planOptimization?.bestProvenBound || groupOptimization?.bestProvenBound || null,
        provenOptimum: planOptimization?.provenOptimum || groupOptimization?.provenOptimum || null,
        stopReason: planOptimization?.stopReason || groupOptimization?.stopReason || null,
        provenObjectiveCount: planOptimization?.provenObjectiveCount ?? groupOptimization?.provenObjectiveCount ?? null,
        objectiveProgress: clone(planOptimization?.objectiveProgress || groupOptimization?.objectiveProgress || null)
      }
      : null;
    return {
      ...enrichedPlan,
      ...(optimization ? { optimization } : {}),
      ...(record.greedyBaselines?.[groupId] ? { greedyBaseline: clone(record.greedyBaselines[groupId]) } : {})
    };
  }


  function greedyCutPlanComparisonEnabled() {
    return Boolean(config()?.featureFlags?.greedyCutPlanComparison);
  }

  async function getGreedyPlan(batchId, groupId) {
    if (!greedyCutPlanComparisonEnabled() || !batchId || !groupId) return null;
    const record = await getRecord(batchId);
    if (!record?.project) return null;

    const baseline = record.greedyBaselines?.[groupId] || null;
    const frontendGroup = projectGroup(record.project, groupId);
    const builder = globalThis.NcNestingGreedyPlanBuilder;
    // DEV comparison must use the exact piece snapshot captured by the greedy solver.
    // Older aggregated baselines are still valid for objective comparison, but are not
    // sufficient to reproduce the original greedy cut plan faithfully.
    if (!baseline || !asArray(baseline.pieces).length || !frontendGroup || typeof builder?.buildGroup !== "function") return null;

    const normalizedPlans = normalizePlansShape(record.plans || {});
    const storedPlan = Array.isArray(normalizedPlans)
      ? normalizedPlans.find(item => item?.groupId === groupId || item?.id === groupId) || null
      : normalizedPlans?.[groupId] || null;
    const cuttingSettings = record.project?.cuttingSettings
      || storedPlan?.settings
      || storedPlan?.cuttingSettings
      || {};

    const built = builder.buildGroup(frontendGroup, baseline, cuttingSettings);
    if (!built?.plan) return null;

    const enriched = applyRecordMetadataToPlan(enrichPlan(built.plan, record.project, groupId), record);
    return {
      ...enriched,
      comparisonView: "greedy-baseline",
      greedyBaseline: clone(baseline)
    };
  }


  async function getSolvedBatch(batchId) {
    const record = await getRecord(batchId);
    if (!record?.batchResult) return null;

    const normalizedBatch = attachGreedyBaselinesToBatch(attachPlanMetadataToBatch(normalizeBatchResultShape(record.batchResult, {
      batchId: record.batchId,
      currency: hasOwn(record.project, "currency") ? record.project.currency : (record.batchResult?.currency || null),
      generatedAt: record.batchResult?.generatedAt || record.storedAtUtc || null,
      status: record.batchResult?.status || "Completed"
    }), record.plans || {}), record.greedyBaselines || {});
    const enrichedBatchResult = applyRecordMetadataToBatch(enrichBatchResult(normalizedBatch, record.project), record);
    const weightedBatchResult = await attachCatalogueWeights(enrichedBatchResult, record.project);
    const batchResult = applyOrderQuantities(
      weightedBatchResult,
      batchId,
      record
    );

    const normalizedPlans = normalizePlansShape(record.plans || {});
    const plans = {};
    (batchResult.groups || []).forEach(group => {
      const rawPlan = Array.isArray(normalizedPlans)
        ? normalizedPlans.find(item => item.groupId === group.groupId || item.id === group.groupId)
        : normalizedPlans[group.groupId];
      if (rawPlan) {
        const enrichedPlan = applyRecordMetadataToPlan(enrichPlan(rawPlan, record.project, group.groupId), record);
        plans[group.groupId] = {
          ...enrichedPlan,
          ...(group.optimization ? { optimization: clone(group.optimization) } : {}),
          ...(record.greedyBaselines?.[group.groupId] ? { greedyBaseline: clone(record.greedyBaselines[group.groupId]) } : {})
        };
      }
    });

    return {
      batchId,
      project: record.project ? { ...clone(record.project), batchName: cleanName(record.batchName || record.project.batchName) } : null,
      batchResult,
      plans,
      greedyBaselines: clone(record.greedyBaselines || {}),
      groupSolveContexts: clone(record.groupSolveContexts || record.project?.solveResponse?.groupSolveContexts || {})
    };
  }

  function removePlanFromCollection(plans, groupId) {
    if (Array.isArray(plans)) {
      return plans.filter(plan => (plan?.groupId || plan?.id) !== groupId);
    }
    const next = { ...(plans || {}) };
    delete next[groupId];
    return next;
  }

  function removeGroupOrderQuantities(quantities, groupId) {
    return Object.fromEntries(Object.entries(quantities || {}).filter(([key]) => !key.startsWith(`${groupId}\u0000`)));
  }

  async function removeSolvedGroup(batchId, groupId) {
    if (!batchId || !groupId) return false;
    const record = await getRecord(batchId);
    if (!record?.batchResult) return false;

    const normalized = normalizeBatchResultShape(record.batchResult, {
      batchId: record.batchId,
      currency: record.batchResult?.currency || null,
      generatedAt: record.batchResult?.generatedAt || record.storedAtUtc || null,
      status: record.batchResult?.status || "Completed"
    });
    const groups = asArray(normalized.groups).filter(group => group.groupId !== groupId);
    if (groups.length === normalized.groups.length) return false;

    const rebuilt = rebuildBatchTotals({ ...normalized, groups }, groups);
    rebuilt.groups = groups;
    record.batchResult = await attachCatalogueWeights(rebuilt, record.project);
    record.plans = removePlanFromCollection(record.plans, groupId);
    record.greedyBaselines = { ...(record.greedyBaselines || {}) };
    delete record.greedyBaselines[groupId];
    record.groupSolveContexts = { ...(record.groupSolveContexts || {}) };
    delete record.groupSolveContexts[groupId];
    record.orderQuantities = removeGroupOrderQuantities(record.orderQuantities, groupId);
    if (record.project) {
      record.project.orderQuantities = removeGroupOrderQuantities(record.project.orderQuantities, groupId);
      record.project.groupSolveContexts = { ...(record.project.groupSolveContexts || {}) };
      delete record.project.groupSolveContexts[groupId];
      if (record.project.solveResponse) {
        record.project.solveResponse.batchResult = clone(record.batchResult);
        record.project.solveResponse.plans = clone(record.plans);
        record.project.solveResponse.greedyBaselines = clone(record.greedyBaselines);
        record.project.solveResponse.groupSolveContexts = clone(record.groupSolveContexts);
      }
    }
    await putRecord(record);

    try {
      localStorage.setItem(ORDER_QUANTITIES_KEY(batchId), JSON.stringify(record.orderQuantities || {}));
      const activeProject = getActiveProject();
      if (activeProject?.batchId === batchId) {
        activeProject.orderQuantities = clone(record.orderQuantities || {});
        activeProject.groupSolveContexts = clone(record.groupSolveContexts || {});
        if (activeProject.solveResponse) {
          activeProject.solveResponse.batchResult = clone(record.batchResult);
          activeProject.solveResponse.plans = clone(record.plans);
          activeProject.solveResponse.greedyBaselines = clone(record.greedyBaselines);
          activeProject.solveResponse.groupSolveContexts = clone(record.groupSolveContexts);
        }
        saveActiveProject(activeProject);
      }
    } catch {
      // The IndexedDB result remains authoritative when local storage is unavailable.
    }
    return true;
  }

  async function saveBatchName(batchId, batchName) {
    if (!batchId) return "";
    const name = cleanName(batchName);
    const record = await getRecord(batchId);
    if (!record) throw new Error("This solved batch is not available in this browser.");
    record.batchName = name;
    if (record.batchResult) record.batchResult.batchName = name;
    if (record.project) record.project.batchName = name;
    await putRecord(record);

    const activeProject = getActiveProject();
    if (activeProject && (!activeProject.batchId || activeProject.batchId === batchId)) {
      activeProject.batchId = batchId;
      activeProject.batchName = name;
      saveActiveProject(activeProject);
    }
    return name;
  }

  function applyStoredOrderQuantities(batchResult, batchId) {
    return applyOrderQuantities(batchResult, batchId || batchResult?.batchId, null);
  }

  async function getProject(batchId) {
    const record = await getRecord(batchId);
    if (!record?.project) return null;
    return { ...clone(record.project), batchName: cleanName(record.batchName || record.project.batchName) };
  }


  function calculateBatchOrderTotals(source) {
    const groups = Array.isArray(source) ? source : (source?.groups || []);
    return groups.reduce((totals, group) => {
      (group?.stockOrders || []).forEach(order => {
        const required = Math.max(0, Math.trunc(Number(order?.requiredQuantity) || 0));
        const ordered = Math.max(0, Math.trunc(order?.orderQuantity == null
          ? required
          : Number(order.orderQuantity) || 0));
        totals.orderQuantity += required;
        totals.ordered += ordered;
      });
      totals.leftover = totals.ordered - totals.orderQuantity;
      return totals;
    }, { orderQuantity: 0, ordered: 0, leftover: 0 });
  }
  window.NcNesting = Object.freeze({
    config,
    createRequestId,
    createProjectId,
    postSolve,
    normalizeSolveResponse,
    prepareIncrementalSolve,
    mergeIncrementalSolveResult,
    writeGroupSolveCache,
    saveActiveProject,
    getActiveProject,
    clearActiveProject,
    saveSolveResponse,
    saveBatchName,
    calculateBatchOrderTotals,
    saveOrderQuantities,
    removeSolvedGroup,
    applyStoredOrderQuantities,
    getBatchResult,
    getPlan,
    getGreedyPlan,
    getSolvedBatch,
    getProject
  });
})();
