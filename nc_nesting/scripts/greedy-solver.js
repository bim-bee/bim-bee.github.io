(function () {
  "use strict";

  const ALGORITHM_VERSION = "greedy-bfd-v3";
  const Geometry = window.NcNestingCuttingGeometry;
  const PASS_MODES = Object.freeze(["storage-first", "best-fit", "shortest-first", "large-stock"]);

  function finiteInteger(value, minimum = 0) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < minimum) return null;
    return number;
  }

  function stableText(value) {
    return String(value ?? "");
  }

  function compareText(left, right) {
    return stableText(left).localeCompare(stableText(right), "en", { numeric: true, sensitivity: "base" });
  }

  function normalizeSettings(settings) {
    const toolWidth = finiteInteger(settings?.toolWidth);
    const trimStart = finiteInteger(settings?.trimStart);
    const trimEnd = finiteInteger(settings?.trimEnd);
    const reusableMinimumLength = finiteInteger(settings?.reusableMinimumLength);
    if ([toolWidth, trimStart, trimEnd, reusableMinimumLength].some(value => value == null)) return null;
    return { toolWidth, trimStart, trimEnd, reusableMinimumLength };
  }

  function normalizeParts(group, settings) {
    const seen = new Set();
    const parts = [];
    for (const source of Array.isArray(group?.partRequirements) ? group.partRequirements : []) {
      const partId = stableText(source?.partId).trim();
      const length = finiteInteger(source?.length, 1);
      const quantity = finiteInteger(source?.quantity, 1);
      if (!partId || length == null || quantity == null || seen.has(partId)) return null;
      seen.add(partId);
      const effectiveSize = Geometry?.effectiveItemSize(length, settings.toolWidth);
      if (effectiveSize == null) return null;
      parts.push({ partId, length, quantity, effectiveSize });
    }
    if (!parts.length) return null;
    return parts.sort((left, right) => right.effectiveSize - left.effectiveSize || compareText(left.partId, right.partId));
  }

  function stockCapacity(length, settings) {
    return Geometry?.effectiveFitCapacity(length, settings) ?? null;
  }

  function normalizeStock(group, settings) {
    const stock = [];
    const seen = new Set();

    for (const source of Array.isArray(group?.stockOrders) ? group.stockOrders : []) {
      const id = stableText(source?.stockOrderId).trim();
      const length = finiteInteger(source?.length, 1);
      const availableQuantity = source?.availableQuantity == null ? null : finiteInteger(source.availableQuantity);
      if (!id || length == null || availableQuantity === undefined || seen.has(`StockOrder\u0000${id}`)) return null;
      if (source?.availableQuantity != null && availableQuantity == null) return null;
      const capacity = stockCapacity(length, settings);
      if (capacity == null || capacity < 0) return null;
      seen.add(`StockOrder\u0000${id}`);
      stock.push({
        stockSource: "StockOrder",
        stockOrderId: id,
        groupedStorageStockId: null,
        id,
        length,
        capacity,
        availableQuantity
      });
    }

    for (const source of Array.isArray(group?.storageStock) ? group.storageStock : []) {
      const id = stableText(source?.groupedStorageStockId).trim();
      const length = finiteInteger(source?.length, 1);
      const quantity = finiteInteger(source?.quantity);
      if (!id || length == null || quantity == null || seen.has(`StorageStock\u0000${id}`)) return null;
      const capacity = stockCapacity(length, settings);
      if (capacity == null || capacity < 0) return null;
      seen.add(`StorageStock\u0000${id}`);
      stock.push({
        stockSource: "StorageStock",
        stockOrderId: null,
        groupedStorageStockId: id,
        id,
        length,
        capacity,
        availableQuantity: quantity
      });
    }

    return stock;
  }

  function stockStableCompare(left, right) {
    return left.stockSource.localeCompare(right.stockSource)
      || compareText(left.id, right.id)
      || left.length - right.length;
  }

  function sourceRank(option) {
    return option.stockSource === "StorageStock" ? 0 : 1;
  }

  function candidateComparator(mode, partSize) {
    return (left, right) => {
      const leftRemaining = left.capacity - partSize;
      const rightRemaining = right.capacity - partSize;
      if (mode === "storage-first") {
        return sourceRank(left) - sourceRank(right)
          || leftRemaining - rightRemaining
          || left.length - right.length
          || stockStableCompare(left, right);
      }
      if (mode === "shortest-first") {
        return left.length - right.length
          || sourceRank(left) - sourceRank(right)
          || leftRemaining - rightRemaining
          || stockStableCompare(left, right);
      }
      if (mode === "large-stock") {
        return sourceRank(left) - sourceRank(right)
          || right.capacity - left.capacity
          || stockStableCompare(left, right);
      }
      return leftRemaining - rightRemaining
        || sourceRank(left) - sourceRank(right)
        || left.length - right.length
        || stockStableCompare(left, right);
    };
  }

  function openPiece(options, usage, part, mode) {
    const candidates = options.filter(option => {
      if (option.capacity < part.effectiveSize) return false;
      const used = usage.get(option) || 0;
      return option.availableQuantity == null || used < option.availableQuantity;
    });
    if (!candidates.length) return null;
    candidates.sort(candidateComparator(mode, part.effectiveSize));
    const option = candidates[0];
    usage.set(option, (usage.get(option) || 0) + 1);
    return {
      option,
      remainingEffectiveCapacity: option.capacity,
      counts: Object.create(null),
      partIds: [],
      pieceIndex: usage.get(option)
    };
  }

  function chooseOpenPiece(pieces, part) {
    let selected = null;
    let selectedRemaining = Infinity;
    for (const piece of pieces) {
      if (piece.remainingEffectiveCapacity < part.effectiveSize) continue;
      const remaining = piece.remainingEffectiveCapacity - part.effectiveSize;
      if (remaining < selectedRemaining) {
        selected = piece;
        selectedRemaining = remaining;
        continue;
      }
      if (remaining !== selectedRemaining || !selected) continue;
      const sourceComparison = sourceRank(piece.option) - sourceRank(selected.option);
      if (sourceComparison < 0
        || (sourceComparison === 0 && stockStableCompare(piece.option, selected.option) < 0)
        || (sourceComparison === 0 && stockStableCompare(piece.option, selected.option) === 0 && piece.pieceIndex < selected.pieceIndex)) {
        selected = piece;
      }
    }
    return selected;
  }

  function placePart(piece, part) {
    piece.remainingEffectiveCapacity -= part.effectiveSize;
    piece.counts[part.partId] = (piece.counts[part.partId] || 0) + 1;
    piece.partIds.push(part.partId);
  }

  function patternSignature(piece) {
    const pairs = Object.entries(piece.counts)
      .filter(([, quantity]) => quantity > 0)
      .sort(([left], [right]) => compareText(left, right));
    return `${piece.option.stockSource}\u0000${piece.option.id}\u0000${pairs.map(([partId, quantity]) => `${partId}\u0001${quantity}`).join("\u0002")}`;
  }

  function serializeLayouts(pieces) {
    const bySignature = new Map();
    pieces.forEach(piece => {
      const signature = patternSignature(piece);
      let layout = bySignature.get(signature);
      if (!layout) {
        const sortedCounts = Object.fromEntries(Object.entries(piece.counts).sort(([left], [right]) => compareText(left, right)));
        layout = {
          stockSource: piece.option.stockSource,
          ...(piece.option.stockSource === "StockOrder"
            ? { stockOrderId: piece.option.stockOrderId }
            : { groupedStorageStockId: piece.option.groupedStorageStockId }),
          quantity: 0,
          partCounts: sortedCounts
        };
        bySignature.set(signature, layout);
      }
      layout.quantity += 1;
    });
    return [...bySignature.entries()]
      .sort(([left], [right]) => compareText(left, right))
      .map(([, layout]) => layout);
  }

  function serializePieces(pieces) {
    return pieces.map(piece => ({
      stockSource: piece.option.stockSource,
      ...(piece.option.stockSource === "StockOrder"
        ? { stockOrderId: piece.option.stockOrderId }
        : { groupedStorageStockId: piece.option.groupedStorageStockId }),
      partIds: [...piece.partIds]
    }));
  }

  function objectiveForPieces(pieces, settings) {
    let orderedStockQuantity = 0;
    let totalStockLengthConsumed = 0;
    let reusableOffcutLength = 0;
    let reusableOffcutCount = 0;
    pieces.forEach(piece => {
      if (piece.option.stockSource === "StockOrder") orderedStockQuantity += 1;
      totalStockLengthConsumed += piece.option.length;
      const netOffcut = Geometry?.netOffcutFromRaw(piece.remainingEffectiveCapacity, settings.toolWidth);
      if (netOffcut > 0 && netOffcut >= settings.reusableMinimumLength) {
        reusableOffcutLength += netOffcut;
        reusableOffcutCount += 1;
      }
    });
    return { orderedStockQuantity, totalStockLengthConsumed, reusableOffcutLength, reusableOffcutCount };
  }

  function compareObjectives(left, right) {
    const shared = globalThis.NcNestingOptimization;
    if (shared?.compare) return shared.compare(left, right);
    const fields = [
      ["orderedStockQuantity", "min"],
      ["totalStockLengthConsumed", "min"],
      ["reusableOffcutLength", "max"],
      ["reusableOffcutCount", "min"]
    ];
    for (const [key, direction] of fields) {
      if (left[key] === right[key]) continue;
      return direction === "min"
        ? (left[key] < right[key] ? -1 : 1)
        : (left[key] > right[key] ? -1 : 1);
    }
    return 0;
  }

  function validatePlan(group, parts, options, pieces, layouts, settings) {
    const expected = new Map(parts.map(part => [part.partId, part.quantity]));
    const actual = new Map(parts.map(part => [part.partId, 0]));
    const optionByKey = new Map(options.map(option => [`${option.stockSource}\u0000${option.id}`, option]));
    const stockUsage = new Map();

    for (const piece of pieces) {
      if (!piece || piece.remainingEffectiveCapacity < 0 || !Object.keys(piece.counts).length) return false;
      let effectiveUsed = 0;
      for (const [partId, rawQuantity] of Object.entries(piece.counts)) {
        const quantity = finiteInteger(rawQuantity, 1);
        if (quantity == null || !expected.has(partId)) return false;
        const part = parts.find(item => item.partId === partId);
        effectiveUsed += quantity * part.effectiveSize;
        actual.set(partId, (actual.get(partId) || 0) + quantity);
      }
      if (effectiveUsed > piece.option.capacity || piece.option.capacity - effectiveUsed !== piece.remainingEffectiveCapacity) return false;
      const key = `${piece.option.stockSource}\u0000${piece.option.id}`;
      if (!optionByKey.has(key)) return false;
      stockUsage.set(key, (stockUsage.get(key) || 0) + 1);
    }

    for (const [partId, quantity] of expected) {
      if (actual.get(partId) !== quantity) return false;
    }
    for (const [key, quantity] of stockUsage) {
      const option = optionByKey.get(key);
      if (option.availableQuantity != null && quantity > option.availableQuantity) return false;
    }

    const layoutDemand = new Map(parts.map(part => [part.partId, 0]));
    const layoutStockUsage = new Map();
    for (const layout of layouts) {
      const quantity = finiteInteger(layout.quantity, 1);
      if (quantity == null || !layout.partCounts || !Object.keys(layout.partCounts).length) return false;
      const id = layout.stockSource === "StockOrder" ? layout.stockOrderId : layout.groupedStorageStockId;
      const key = `${layout.stockSource}\u0000${stableText(id).trim()}`;
      const option = optionByKey.get(key);
      if (!option) return false;
      let effectiveUsed = 0;
      for (const [partId, rawPartQuantity] of Object.entries(layout.partCounts)) {
        const partQuantity = finiteInteger(rawPartQuantity, 1);
        if (partQuantity == null || !expected.has(partId)) return false;
        const part = parts.find(item => item.partId === partId);
        effectiveUsed += partQuantity * part.effectiveSize;
        layoutDemand.set(partId, (layoutDemand.get(partId) || 0) + partQuantity * quantity);
      }
      if (effectiveUsed > option.capacity) return false;
      layoutStockUsage.set(key, (layoutStockUsage.get(key) || 0) + quantity);
    }
    for (const [partId, quantity] of expected) {
      if (layoutDemand.get(partId) !== quantity) return false;
    }
    for (const [key, quantity] of layoutStockUsage) {
      const option = optionByKey.get(key);
      if (option.availableQuantity != null && quantity > option.availableQuantity) return false;
    }

    const objective = objectiveForPieces(pieces, settings);
    return Object.values(objective).every(Number.isSafeInteger);
  }

  function runPass(group, parts, options, settings, mode) {
    const usage = new Map();
    const pieces = [];
    for (const part of parts) {
      let remaining = part.quantity;
      while (remaining > 0) {
        let piece = chooseOpenPiece(pieces, part);
        if (!piece) {
          piece = openPiece(options, usage, part, mode);
          if (!piece) return null;
          pieces.push(piece);
        }
        placePart(piece, part);
        remaining -= 1;
      }
    }

    const layouts = serializeLayouts(pieces);
    if (!validatePlan(group, parts, options, pieces, layouts, settings)) return null;
    return {
      groupId: group.groupId,
      algorithmVersion: ALGORITHM_VERSION,
      objective: objectiveForPieces(pieces, settings),
      pieces: serializePieces(pieces),
      layouts
    };
  }

  function solve(group, cuttingSettings) {
    const settings = normalizeSettings(cuttingSettings);
    if (!settings || !stableText(group?.groupId).trim()) return null;
    const parts = normalizeParts(group, settings);
    const options = normalizeStock(group, settings);
    if (!parts || !options?.length) return null;
    if (parts.some(part => !options.some(option => option.capacity >= part.effectiveSize))) return null;

    let best = null;
    for (const mode of PASS_MODES) {
      const candidate = runPass(group, parts, options, settings, mode);
      if (!candidate) continue;
      if (!best || compareObjectives(candidate.objective, best.objective) < 0) best = candidate;
    }
    return best;
  }

  window.NcNestingGreedy = Object.freeze({
    ALGORITHM_VERSION,
    solve
  });
})();
