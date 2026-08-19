(function () {
  "use strict";

  const STATUS = "GreedyOnly";
  const RESULT_SOURCE = "FrontendGreedy";
  const Geometry = window.NcNestingCuttingGeometry;

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function integer(value, minimum = 0) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= minimum ? number : null;
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function compareText(left, right) {
    return clean(left).localeCompare(clean(right), "en", { numeric: true, sensitivity: "base" });
  }

  function normalizeSettings(settings) {
    const toolWidth = integer(settings?.toolWidth);
    const trimStart = integer(settings?.trimStart);
    const trimEnd = integer(settings?.trimEnd);
    const reusableMinimumLength = integer(settings?.reusableMinimumLength);
    if ([toolWidth, trimStart, trimEnd, reusableMinimumLength].some(value => value == null)) return null;
    return { toolWidth, trimStart, trimEnd, reusableMinimumLength };
  }

  function normalizeParts(group) {
    const parts = [];
    const seen = new Set();
    for (const source of asArray(group?.partRequirements)) {
      const partId = clean(source?.partId);
      const length = integer(source?.length, 1);
      const quantity = integer(source?.quantity, 1);
      if (!partId || length == null || quantity == null || seen.has(partId)) return null;
      seen.add(partId);
      parts.push({ partId, length, quantity });
    }
    return parts.length ? parts : null;
  }

  function normalizeStock(group) {
    const byKey = new Map();
    for (const source of asArray(group?.stockOrders)) {
      const id = clean(source?.stockOrderId);
      const length = integer(source?.length, 1);
      const availableQuantity = source?.availableQuantity == null ? null : integer(source.availableQuantity);
      if (!id || length == null || (source?.availableQuantity != null && availableQuantity == null)) return null;
      const key = `StockOrder\u0000${id}`;
      if (byKey.has(key)) return null;
      byKey.set(key, {
        stockSource: "StockOrder",
        id,
        stockOrderId: id,
        groupedStorageStockId: null,
        length,
        availableQuantity,
        price: source?.price == null || source?.price === "" ? null : Number(source.price),
        sourceRecords: []
      });
    }

    for (const source of asArray(group?.storageStock)) {
      const id = clean(source?.groupedStorageStockId);
      const length = integer(source?.length, 1);
      const quantity = integer(source?.quantity);
      if (!id || length == null || quantity == null) return null;
      const key = `StorageStock\u0000${id}`;
      if (byKey.has(key)) return null;
      const sourceRecords = asArray(source?.sourceRecords).map(record => ({
        storageStockId: clean(record?.storageStockId),
        quantity: integer(record?.quantity) || 0,
        storageArea: clean(record?.storageArea) || null
      })).filter(record => record.storageStockId && record.quantity > 0);
      byKey.set(key, {
        stockSource: "StorageStock",
        id,
        stockOrderId: null,
        groupedStorageStockId: id,
        length,
        availableQuantity: quantity,
        price: null,
        sourceRecords
      });
    }
    return byKey.size ? byKey : null;
  }

  function partOrder(left, right) {
    return right.length - left.length || compareText(left.partId, right.partId);
  }

  function storageAllocator(option) {
    const records = option.sourceRecords.map(record => ({ ...record, remaining: record.quantity }));
    let cursor = 0;
    return () => {
      while (cursor < records.length && records[cursor].remaining <= 0) cursor++;
      if (cursor >= records.length) return null;
      records[cursor].remaining--;
      return records[cursor];
    };
  }

  function buildGroup(group, baseline, cuttingSettings) {
    const settings = normalizeSettings(cuttingSettings);
    const parts = normalizeParts(group);
    const stockByKey = normalizeStock(group);
    const groupId = clean(group?.groupId);
    if (!settings || !parts || !stockByKey || !groupId || clean(baseline?.groupId) !== groupId) return null;

    const partById = new Map(parts.map(part => [part.partId, part]));
    const expectedDemand = new Map(parts.map(part => [part.partId, part.quantity]));
    const actualDemand = new Map(parts.map(part => [part.partId, 0]));
    const stockUsage = new Map();
    const exactPieces = asArray(baseline?.pieces);
    const layouts = exactPieces.length
      ? exactPieces.map(piece => {
        const partIds = asArray(piece?.partIds).map(clean).filter(Boolean);
        const partCounts = {};
        partIds.forEach(partId => { partCounts[partId] = (partCounts[partId] || 0) + 1; });
        return { ...piece, quantity: 1, partIds, partCounts };
      })
      : asArray(baseline?.layouts);
    if (!layouts.length) return null;

    for (const layout of layouts) {
      const quantity = integer(layout?.quantity, 1);
      const stockSource = layout?.stockSource === "StorageStock" ? "StorageStock" : layout?.stockSource === "StockOrder" ? "StockOrder" : null;
      const stockId = clean(stockSource === "StorageStock" ? layout?.groupedStorageStockId : layout?.stockOrderId);
      const key = stockSource && stockId ? `${stockSource}\u0000${stockId}` : "";
      const option = stockByKey.get(key);
      if (quantity == null || !option) return null;
      const counts = Object.entries(layout?.partCounts || {});
      if (!counts.length) return null;
      let effectiveUsed = 0;
      for (const [partId, rawCount] of counts) {
        const count = integer(rawCount, 1);
        const part = partById.get(partId);
        if (count == null || !part) return null;
        const effectiveSize = Geometry?.effectiveItemSize(part.length, settings.toolWidth);
        if (effectiveSize == null) return null;
        effectiveUsed += count * effectiveSize;
        actualDemand.set(partId, (actualDemand.get(partId) || 0) + count * quantity);
      }
      const capacity = Geometry?.effectiveFitCapacity(option.length, settings);
      if (capacity == null || effectiveUsed > capacity) return null;
      stockUsage.set(key, (stockUsage.get(key) || 0) + quantity);
    }

    for (const [partId, quantity] of expectedDemand) {
      if (actualDemand.get(partId) !== quantity) return null;
    }
    for (const [key, quantity] of stockUsage) {
      const option = stockByKey.get(key);
      if (option.availableQuantity != null && quantity > option.availableQuantity) return null;
    }

    const allocators = new Map(
      [...stockByKey.entries()]
        .filter(([, option]) => option.stockSource === "StorageStock")
        .map(([key, option]) => [key, storageAllocator(option)])
    );
    const sourceTotals = new Map();
    const retrievalTotals = new Map();
    const stockPieces = [];
    let pieceNumber = 0;
    let totalStockLengthConsumed = 0;
    let totalConsumedLength = 0;
    let totalPartLength = 0;
    let totalOffcutLength = 0;
    let totalStorageStockLengthConsumed = 0;
    let totalReusableOffcutLength = 0;
    let reusableOffcutCount = 0;
    let stockOrderPieceCount = 0;
    let storageStockPieceCount = 0;
    let storagePiecesWithRecord = 0;

    for (const layout of layouts) {
      const quantity = integer(layout.quantity, 1);
      const stockSource = layout.stockSource;
      const stockId = clean(stockSource === "StorageStock" ? layout.groupedStorageStockId : layout.stockOrderId);
      const key = `${stockSource}\u0000${stockId}`;
      const option = stockByKey.get(key);
      const orderedParts = asArray(layout.partIds).length
        ? layout.partIds.map(partId => ({ part: partById.get(partId), count: 1 }))
        : Object.entries(layout.partCounts)
          .map(([partId, rawCount]) => ({ part: partById.get(partId), count: integer(rawCount, 1) }))
          .sort((left, right) => partOrder(left.part, right.part));

      for (let copyIndex = 0; copyIndex < quantity; copyIndex++) {
        const partSegments = [];
        let piecePartLength = 0;
        let partCount = 0;
        for (const item of orderedParts) {
          for (let count = 0; count < item.count; count++) {
            partSegments.push({ type: "Part", length: item.part.length, partId: item.part.partId });
            piecePartLength += item.part.length;
            partCount++;
          }
        }
        if (!partCount) return null;

        const builtGeometry = Geometry?.buildSegments(partSegments, option.length, settings);
        if (!builtGeometry) return null;
        const { measurement, segments } = builtGeometry;
        const toolCutLength = measurement.totalToolCutLength;
        const trimLength = settings.trimStart + settings.trimEnd;
        const offcutLength = measurement.netOffcut;
        const reusable = measurement.reusable;
        const consumedLength = measurement.actualConsumedLength;

        const storageRecord = stockSource === "StorageStock" ? allocators.get(key)?.() || null : null;
        const piece = {
          pieceNumber: ++pieceNumber,
          stockSource,
          stockOrderId: stockSource === "StockOrder" ? option.stockOrderId : null,
          groupedStorageStockId: stockSource === "StorageStock" ? option.groupedStorageStockId : null,
          stockTypeId: stockSource === "StockOrder" ? option.stockOrderId : option.groupedStorageStockId,
          ...(storageRecord?.storageStockId ? { storageStockId: storageRecord.storageStockId } : {}),
          ...(storageRecord?.storageArea ? { storageArea: storageRecord.storageArea } : {}),
          stockLength: option.length,
          segments,
          totals: {
            stockLength: option.length,
            finishedPartLength: piecePartLength,
            toolCutLength,
            trimLength,
            actualConsumedLength: consumedLength,
            offcutLength
          }
        };
        stockPieces.push(piece);

        const source = sourceTotals.get(key) || {
          option,
          quantity: 0,
          stockLength: 0,
          partLength: 0,
          wasteLength: 0
        };
        source.quantity++;
        source.stockLength += option.length;
        source.partLength += piecePartLength;
        source.wasteLength += offcutLength;
        sourceTotals.set(key, source);

        if (stockSource === "StorageStock" && storageRecord?.storageStockId) {
          storagePiecesWithRecord++;
          const retrieval = retrievalTotals.get(storageRecord.storageStockId) || {
            storageStockId: storageRecord.storageStockId,
            groupedStorageStockId: option.groupedStorageStockId,
            quantity: 0,
            stockLength: option.length,
            storageArea: storageRecord.storageArea || null,
            totalRetrievedStockLength: 0,
            totalPartLength: 0,
            wasteLength: 0
          };
          retrieval.quantity++;
          retrieval.totalRetrievedStockLength += option.length;
          retrieval.totalPartLength += piecePartLength;
          retrieval.wasteLength += offcutLength;
          retrievalTotals.set(storageRecord.storageStockId, retrieval);
        }

        totalStockLengthConsumed += option.length;
        totalConsumedLength += consumedLength;
        totalPartLength += piecePartLength;
        totalOffcutLength += offcutLength;
        if (stockSource === "StorageStock") {
          totalStorageStockLengthConsumed += option.length;
          storageStockPieceCount++;
        } else {
          stockOrderPieceCount++;
        }
        if (reusable) {
          totalReusableOffcutLength += offcutLength;
          reusableOffcutCount++;
        }
      }
    }

    const stockOrderOptions = asArray(group.stockOrders).map(order => {
      const id = clean(order.stockOrderId);
      const source = sourceTotals.get(`StockOrder\u0000${id}`);
      const selectedPieceCount = source?.quantity || 0;
      const selectedStockLength = source?.stockLength || 0;
      const selectedPartLength = source?.partLength || 0;
      const wasteLength = source?.wasteLength || 0;
      return {
        stockOrderId: id,
        stockTypeId: id,
        length: integer(order.length, 1),
        availableQuantity: order.availableQuantity == null ? null : integer(order.availableQuantity),
        isUnlimited: order.availableQuantity == null,
        cost: order.price == null || order.price === "" ? null : Number(order.price),
        selectedPieceCount,
        selectedStockLength,
        selectedPartLength,
        wasteLength,
        utilizationPercentage: selectedPartLength + wasteLength > 0
          ? selectedPartLength / (selectedPartLength + wasteLength) * 100
          : 0
      };
    });

    const selectedStockOrders = stockOrderOptions.filter(order => order.selectedPieceCount > 0);
    const stockOrderCost = selectedStockOrders.reduce((total, order) => {
      const price = Number(order.cost);
      return total + (Number.isFinite(price) ? price * order.selectedPieceCount : 0);
    }, 0);
    const storageRetrievals = storageStockPieceCount > 0 && storagePiecesWithRecord === storageStockPieceCount
      ? [...retrievalTotals.values()].map(record => ({
        ...record,
        utilizationPercentage: record.totalPartLength + record.wasteLength > 0
          ? record.totalPartLength / (record.totalPartLength + record.wasteLength) * 100
          : 0
      }))
      : [];

    const totals = {
      totalStockLengthConsumed,
      totalConsumedLength,
      totalPartLength,
      totalOffcutLength,
      totalStorageStockLengthConsumed,
      totalReusableOffcutLength,
      reusableOffcutCount,
      totalStockOrderLengthOrdered: totalStockLengthConsumed - totalStorageStockLengthConsumed,
      stockOrderPieceCount,
      storageStockPieceCount,
      stockOrderCost
    };

    const plan = {
      groupId,
      profileName: clean(group.profileName),
      steelGrade: clean(group.steelGrade),
      status: STATUS,
      resultSource: RESULT_SOURCE,
      cuttingSettings: { ...settings },
      requestedParts: parts.map(part => ({ ...part, requestedQuantity: part.quantity })),
      stockOrderOptions,
      storageRetrievals,
      stockPieces,
      totals
    };

    const batchGroup = {
      groupId,
      profileName: clean(group.profileName),
      steelGrade: clean(group.steelGrade),
      status: STATUS,
      resultSource: RESULT_SOURCE,
      totalStockLengthConsumed,
      totalConsumedLength,
      totalPartLength,
      totalOffcutLength,
      totalStorageStockLengthConsumed,
      totalReusableOffcutLength,
      totalReusableOffcutCount: reusableOffcutCount,
      storageStockQuantity: storageStockPieceCount,
      stockOrderQuantity: stockOrderPieceCount,
      stockOrderCost,
      stockOrders: selectedStockOrders.map(order => ({
        stockOrderId: order.stockOrderId,
        stockTypeId: order.stockOrderId,
        stockLength: order.length,
        requiredQuantity: order.selectedPieceCount,
        orderQuantity: order.selectedPieceCount,
        unitPrice: order.cost
      }))
    };

    return { batchGroup, plan };
  }

  function buildSolveResult(request, changedGroups, baselines, projectGroups) {
    const changed = asArray(changedGroups);
    if (!changed.length) return null;
    const projectById = new Map(asArray(projectGroups).map(group => [clean(group?.groupId), group]));
    const groups = [];
    const plans = {};

    for (const requestGroup of changed) {
      const groupId = clean(requestGroup?.groupId);
      const baseline = baselines?.[groupId];
      if (!groupId || !baseline) return null;
      const materialGroup = projectById.get(groupId) || requestGroup;
      const built = buildGroup(materialGroup, baseline, request?.cuttingSettings || {});
      if (!built) return null;
      groups.push(built.batchGroup);
      plans[groupId] = built.plan;
    }

    const batchId = clean(request?.requestId) || `greedy-${Date.now()}`;
    return {
      succeeded: true,
      batchId,
      batchResult: {
        status: "Completed",
        batchId,
        generatedAt: new Date().toISOString(),
        currency: clean(request?.currency) || null,
        groups
      },
      plans
    };
  }

  window.NcNestingGreedyPlanBuilder = Object.freeze({
    STATUS,
    RESULT_SOURCE,
    buildGroup,
    buildSolveResult
  });
})();
