(function () {
  "use strict";

  const DB_NAME = "nc-nesting";
  const DB_VERSION = 1;
  const STORE_NAME = "solved-batches";
  const ACTIVE_PROJECT_KEY = `${DB_NAME}:active-project`;

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

  function pickFirstNumber(...values) {
    for (const value of values) {
      if (value == null || (typeof value === "string" && !value.trim())) continue;
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return null;
  }

  function normalizeBatchGroup(group) {
    const mappedWeight = pickFirstNumber(group.profileKeilogramPerMeter);
    const profileKeilogramPerMeter = mappedWeight != null && mappedWeight >= 0 ? mappedWeight : null;
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

    return {
      ...group,
      status: group.status || "Completed",
      profileKeilogramPerMeter,
      totalStockLengthConsumed,
      totalConsumedLength: pickFirstNumber(group.totalConsumedLength, group.actualConsumedLength) || 0,
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

    return {
      ...plan,
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
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Unable to open IndexedDB."));
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
        errors: [{ profileName: "Batch", category: "Response", message: "The solve response did not contain batchResult." }]
      };
    }

    const batchResult = normalizeBatchResultShape(rawBatchResult, container);
    const plans = normalizePlansShape(rawPlans);

    const batchId = batchResult.batchId || response?.batchId || container.batchId;
    if (!batchId) {
      return {
        succeeded: false,
        errors: [{ profileName: "Batch", category: "Response", message: "The solve response did not contain a batchId." }]
      };
    }

    batchResult.batchId = batchId;
    return { succeeded: true, batchId, batchResult, plans };
  }

  async function postSolve(payload) {
    const solveUrl = String(config().solveUrl || "").trim();
    if (!solveUrl || solveUrl.includes("YOUR_FUNCTION_APP")) {
      throw new Error("Set NcNestingConfig.solveUrl in scripts/config.js before solving.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(config().requestTimeoutMs) || 120000);
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
        const message = body?.message || body?.title || `Solve request failed: HTTP ${response.status}`;
        const error = new Error(message);
        error.responseBody = body;
        throw error;
      }

      return normalizeSolveResponse(body);
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("The solve request timed out.");
      if (error instanceof TypeError) {
        throw new Error(`The browser could not reach ${solveUrl}. If you are using Live Server, make sure the Azure Function is running and allows CORS from ${window.location.origin}.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function projectGroup(project, groupId) {
    return (project?.groups || []).find(group => group.groupId === groupId) || null;
  }

  function enrichBatchResult(batchResult, project) {
    const enriched = clone(batchResult);
    enriched.currency = enriched.currency || project?.currency || null;
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

  async function saveSolveResponse(normalized, project) {
    const projectSnapshot = clone(project || getActiveProject());
    if (projectSnapshot) {
      projectSnapshot.batchId = normalized.batchId;
      projectSnapshot.solveResponse = {
        batchId: normalized.batchId,
        batchResult: clone(normalized.batchResult),
        plans: clone(normalized.plans || {})
      };
      saveActiveProject(projectSnapshot);
    }

    const record = {
      batchId: normalized.batchId,
      batchResult: normalized.batchResult,
      plans: normalized.plans || {},
      project: projectSnapshot,
      storedAtUtc: new Date().toISOString()
    };
    await putRecord(record);
    return record;
  }

  async function getBatchResult(batchId) {
    const record = await getRecord(batchId);
    if (!record?.batchResult) return null;
    return enrichBatchResult(
      normalizeBatchResultShape(record.batchResult, {
        batchId: record.batchId,
        currency: record.project?.currency || record.batchResult?.currency || null,
        generatedAt: record.batchResult?.generatedAt || record.storedAtUtc || null,
        status: record.batchResult?.status || "Completed"
      }),
      record.project
    );
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
    return plan ? enrichPlan(plan, record.project, groupId) : null;
  }

  async function getProject(batchId) {
    return clone((await getRecord(batchId))?.project || null);
  }

  window.NcNesting = Object.freeze({
    config,
    createRequestId,
    createProjectId,
    postSolve,
    saveActiveProject,
    getActiveProject,
    saveSolveResponse,
    getBatchResult,
    getPlan,
    getProject
  });
})();
