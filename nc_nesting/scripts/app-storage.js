(function () {
  "use strict";

  const DB_NAME = "nc-nesting";
  const DB_VERSION = 2;
  const STORE_NAME = "solved-batches";
  const GROUP_CACHE_STORE_NAME = "group-solve-cache";
  const GROUP_CACHE_PROJECT_INDEX = "projectId";
  const SOLVE_CACHE_VERSION = "1";
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

  function planFromNormalizedCollection(plans, groupId) {
    if (Array.isArray(plans)) {
      return plans.find(plan => plan?.groupId === groupId || plan?.id === groupId) || null;
    }
    return plans?.[groupId] || null;
  }

  function attachPlanPartLengths(batchResult, plans) {
    const result = clone(batchResult);
    const normalizedPlans = normalizePlansShape(plans || {});
    result.groups = asArray(result?.groups).map(group => {
      const explicit = pickFirstNumber(group.totalPartLength);
      if (explicit != null && explicit >= 0) return group;
      const plan = planFromNormalizedCollection(normalizedPlans, group.groupId);
      const totalPartLength = globalThis.NcNestingUtilization?.totalPartLengthFromPlan?.(plan);
      return Number.isFinite(totalPartLength) && totalPartLength >= 0
        ? { ...group, totalPartLength }
        : group;
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

  function validCachedGroupEntry(entry, projectId, groupId, fingerprint) {
    return Boolean(
      entry
      && (!projectId || entry.projectId === projectId)
      && entry.groupId === groupId
      && entry.cacheVersion === SOLVE_CACHE_VERSION
      && entry.fingerprint === fingerprint
      && entry.batchResultGroup?.groupId === groupId
      && entry.cuttingPlan?.groupId === groupId
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

  async function prepareIncrementalSolve(request, projectId) {
    const groups = asArray(request?.groups);
    const fingerprints = new Map();
    try {
      await Promise.all(groups.map(async group => {
        fingerprints.set(group.groupId, await createGroupFingerprint(group, request?.cuttingSettings || {}));
      }));
    } catch {
      return {
        cacheAvailable: false,
        fingerprints,
        cachedEntries: new Map(),
        changedGroups: clone(groups),
        unchangedGroupIds: []
      };
    }

    if (!projectId || groups.some(group => !cleanName(group?.groupId))) {
      return {
        cacheAvailable: false,
        fingerprints,
        cachedEntries: new Map(),
        changedGroups: clone(groups),
        unchangedGroupIds: []
      };
    }

    try {
      const groupIds = groups.map(group => group.groupId);
      const records = await readGroupCacheEntries(projectId, groupIds);
      const cachedEntries = new Map();
      const changedGroups = [];
      const unchangedGroupIds = [];

      groups.forEach(group => {
        const fingerprint = fingerprints.get(group.groupId);
        const entry = records.get(group.groupId);
        if (validCachedGroupEntry(entry, projectId, group.groupId, fingerprint)) {
          cachedEntries.set(group.groupId, entry);
          unchangedGroupIds.push(group.groupId);
        } else {
          changedGroups.push(clone(group));
        }
      });

      try {
        await cleanupProjectGroupCache(projectId, groupIds);
      } catch {
        // Cache cleanup must not block solving.
      }
      return { cacheAvailable: true, fingerprints, cachedEntries, changedGroups, unchangedGroupIds };
    } catch {
      return {
        cacheAvailable: false,
        fingerprints,
        cachedEntries: new Map(),
        changedGroups: clone(groups),
        unchangedGroupIds: []
      };
    }
  }

  async function writeGroupSolveCache(projectId, groupIds, fingerprints, normalized) {
    if (!projectId || !groupIds?.length) return;
    const groupsById = new Map(asArray(normalized?.batchResult?.groups).map(group => [group.groupId, group]));
    const timestamp = new Date().toISOString();
    const entries = groupIds.map(groupId => ({
      projectId,
      groupId,
      fingerprint: fingerprints.get(groupId),
      batchResultGroup: clone(groupsById.get(groupId)),
      cuttingPlan: clone(planFromCollection(normalized?.plans, groupId)),
      cacheVersion: SOLVE_CACHE_VERSION,
      successfulSolveTimestamp: timestamp,
      orderQuantityAdjustments: {}
    }));

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

  function mergeIncrementalSolveResult(request, incremental, backendResult) {
    const changedGroupIds = incremental.changedGroups.map(group => group.groupId);
    if (backendResult) validateChangedGroupResults(backendResult, changedGroupIds);
    if (!backendResult && changedGroupIds.length) {
      throw serviceError("The returned result could not be processed.", "INVALID_RESULT");
    }

    const changedGroupsById = new Map(asArray(backendResult?.batchResult?.groups).map(group => [group.groupId, group]));
    const groups = [];
    const plans = {};
    const orderQuantities = {};

    asArray(request?.groups).forEach(requestGroup => {
      const groupId = requestGroup.groupId;
      if (changedGroupsById.has(groupId)) {
        groups.push(clone(changedGroupsById.get(groupId)));
        plans[groupId] = clone(planFromCollection(backendResult.plans, groupId));
        return;
      }

      const entry = incremental.cachedEntries.get(groupId);
      if (!validCachedGroupEntry(entry, null, groupId, incremental.fingerprints.get(groupId))) {
        throw serviceError("The cached result could not be processed.", "INVALID_RESULT");
      }
      groups.push(applyCachedOrderQuantityAdjustments(entry.batchResultGroup, entry.orderQuantityAdjustments || {}));
      Object.assign(orderQuantities, entry.orderQuantityAdjustments || {});
      plans[groupId] = clone(entry.cuttingPlan);
    });

    const batchId = backendResult?.batchId || request?.requestId || createRequestId();
    const generatedAt = backendResult?.batchResult?.generatedAt || new Date().toISOString();
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
      orderQuantities,
      groupFingerprints: Object.fromEntries(incremental.fingerprints || [])
    };
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
      if (hasOwn(normalized, "orderQuantities")) {
        projectSnapshot.orderQuantities = clone(normalized.orderQuantities || {});
      }
      if (hasOwn(normalized, "groupFingerprints")) {
        projectSnapshot.groupFingerprints = clone(normalized.groupFingerprints || {});
      }
      saveActiveProject(projectSnapshot);
    }

    const batchName = cleanName(projectSnapshot?.batchName || normalized.batchResult?.batchName);
    const record = {
      batchId: normalized.batchId,
      batchName,
      batchResult: { ...normalized.batchResult, batchName },
      plans: normalized.plans || {},
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
    const normalizedBatch = attachPlanPartLengths(normalizeBatchResultShape(record.batchResult, {
      batchId: record.batchId,
      currency: hasOwn(record.project, "currency") ? record.project.currency : (record.batchResult?.currency || null),
      generatedAt: record.batchResult?.generatedAt || record.storedAtUtc || null,
      status: record.batchResult?.status || "Completed"
    }), record.plans || {});
    const enriched = applyRecordMetadataToBatch(enrichBatchResult(normalizedBatch, record.project), record);
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

    const normalizedBatch = attachPlanPartLengths(normalizeBatchResultShape(record.batchResult, {
      batchId: record.batchId,
      currency: hasOwn(record.project, "currency") ? record.project.currency : (record.batchResult?.currency || null),
      generatedAt: record.batchResult?.generatedAt || record.storedAtUtc || null,
      status: record.batchResult?.status || "Completed"
    }), record.plans || {});
    const batchResult = applyOrderQuantities(
      applyRecordMetadataToBatch(enrichBatchResult(normalizedBatch, record.project), record),
      batchId,
      record
    );

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
    record.batchResult = rebuilt;
    record.plans = removePlanFromCollection(record.plans, groupId);
    record.orderQuantities = removeGroupOrderQuantities(record.orderQuantities, groupId);
    if (record.project) {
      record.project.orderQuantities = removeGroupOrderQuantities(record.project.orderQuantities, groupId);
      if (record.project.solveResponse) {
        record.project.solveResponse.batchResult = clone(rebuilt);
        record.project.solveResponse.plans = clone(record.plans);
      }
    }
    await putRecord(record);

    try {
      localStorage.setItem(ORDER_QUANTITIES_KEY(batchId), JSON.stringify(record.orderQuantities || {}));
      const activeProject = getActiveProject();
      if (activeProject?.batchId === batchId) {
        activeProject.orderQuantities = clone(record.orderQuantities || {});
        if (activeProject.solveResponse) {
          activeProject.solveResponse.batchResult = clone(rebuilt);
          activeProject.solveResponse.plans = clone(record.plans);
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
    getSolvedBatch,
    getProject
  });
})();
