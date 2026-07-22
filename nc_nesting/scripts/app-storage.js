(function () {
  "use strict";

  const DB_NAME = "nc-nesting";
  const DB_VERSION = 1;
  const STORE_NAME = "solved-batches";
  const ACTIVE_PROJECT_KEY = `${DB_NAME}:active-project`;
  const ORDER_QUANTITIES_KEY = batchId => `${DB_NAME}:order-quantities:${batchId}`;

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

    getRecord(batchId).then(record => {
      if (!record) return;
      record.orderQuantities = clone(quantities);
      if (record.project) record.project.orderQuantities = clone(quantities);
      return putRecord(record);
    }).catch(() => { /* The localStorage copy is already current. */ });

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

  function serviceError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  async function postSolve(payload) {
    const solveUrl = String(config().solveUrl || "").trim();
    if (!solveUrl || solveUrl.includes("YOUR_FUNCTION_APP")) {
      throw serviceError("The calculation service is currently unavailable.", "SERVICE_UNAVAILABLE");
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
        throw serviceError("The job could not be solved. Please try again.", "JOB_FAILED");
      }

      const normalized = normalizeSolveResponse(body);
      if (!normalized.succeeded && (!Array.isArray(normalized.errors) || !normalized.errors.length)) {
        throw serviceError("The returned result could not be processed.", "INVALID_RESULT");
      }
      return normalized;
    } catch (error) {
      if (error?.code) throw error;
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
    if (projectSnapshot) {
      projectSnapshot.batchId = normalized.batchId;
      projectSnapshot.solveResponse = {
        batchId: normalized.batchId,
        batchResult: clone(normalized.batchResult),
        plans: clone(normalized.plans || {})
      };
      saveActiveProject(projectSnapshot);
    }

    const batchName = cleanName(projectSnapshot?.batchName || normalized.batchResult?.batchName);
    const record = {
      batchId: normalized.batchId,
      batchName,
      batchResult: { ...normalized.batchResult, batchName },
      plans: normalized.plans || {},
      project: projectSnapshot ? { ...projectSnapshot, batchName } : projectSnapshot,
      storedAtUtc: new Date().toISOString()
    };
    await putRecord(record);
    return record;
  }

  async function getBatchResult(batchId) {
    const record = await getRecord(batchId);
    if (!record?.batchResult) return null;
    const enriched = applyRecordMetadataToBatch(enrichBatchResult(
      normalizeBatchResultShape(record.batchResult, {
        batchId: record.batchId,
        currency: hasOwn(record.project, "currency") ? record.project.currency : (record.batchResult?.currency || null),
        generatedAt: record.batchResult?.generatedAt || record.storedAtUtc || null,
        status: record.batchResult?.status || "Completed"
      }),
      record.project
    ), record);
    return applyOrderQuantities(enriched, batchId, record);
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
    return plan ? applyRecordMetadataToPlan(enrichPlan(plan, record.project, groupId), record) : null;
  }


  async function getSolvedBatch(batchId) {
    const record = await getRecord(batchId);
    if (!record?.batchResult) return null;

    const batchResult = applyOrderQuantities(applyRecordMetadataToBatch(enrichBatchResult(
      normalizeBatchResultShape(record.batchResult, {
        batchId: record.batchId,
        currency: hasOwn(record.project, "currency") ? record.project.currency : (record.batchResult?.currency || null),
        generatedAt: record.batchResult?.generatedAt || record.storedAtUtc || null,
        status: record.batchResult?.status || "Completed"
      }),
      record.project
    ), record), batchId, record);

    const normalizedPlans = normalizePlansShape(record.plans || {});
    const plans = {};
    (batchResult.groups || []).forEach(group => {
      const rawPlan = Array.isArray(normalizedPlans)
        ? normalizedPlans.find(item => item.groupId === group.groupId || item.id === group.groupId)
        : normalizedPlans[group.groupId];
      if (rawPlan) plans[group.groupId] = applyRecordMetadataToPlan(enrichPlan(rawPlan, record.project, group.groupId), record);
    });

    return {
      batchId,
      project: record.project ? { ...clone(record.project), batchName: cleanName(record.batchName || record.project.batchName) } : null,
      batchResult,
      plans
    };
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
    saveActiveProject,
    getActiveProject,
    clearActiveProject,
    saveSolveResponse,
    saveBatchName,
    calculateBatchOrderTotals,
    saveOrderQuantities,
    applyStoredOrderQuantities,
    getBatchResult,
    getPlan,
    getSolvedBatch,
    getProject
  });
})();
