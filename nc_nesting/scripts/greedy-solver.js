(function () {
  "use strict";

  const ALGORITHM_VERSION = "greedy-knapsack-repair-v5";
  const Geometry = window.NcNestingCuttingGeometry;
  const PASS_MODES = Object.freeze(["storage-first", "best-fit", "shortest-first", "large-stock"]);
  const MAX_REPAIR_TARGETS = 40;
  const MAX_REPAIR_DONORS = 3;
  const MAX_REPACK_ITEMS_FOR_SEARCH = 18;
  const MAX_REPACK_STATES = 1200;

  const BASE_CANDIDATES = Object.freeze([
    Object.freeze({ mode: "storage-first", partStrategy: "longest", anchoredCombo: false, storageMinFill: 0, repairBudget: 22 }),
    Object.freeze({ mode: "best-fit", partStrategy: "best-fit", anchoredCombo: true, storageMinFill: 0.78, repairBudget: 24 }),
    Object.freeze({ mode: "shortest-first", partStrategy: "difficult", anchoredCombo: true, storageMinFill: 0.82, repairBudget: 24 }),
    Object.freeze({ mode: "large-stock", partStrategy: "alternate-longest", anchoredCombo: false, storageMinFill: 0.68, repairBudget: 22 }),
    Object.freeze({ mode: "ordered-first", partStrategy: "difficult", anchoredCombo: true, storageMinFill: 0.86, repairBudget: 26 }),
    Object.freeze({ mode: "best-fit", partStrategy: "storage-aware", anchoredCombo: false, storageMinFill: 0.74, repairBudget: 26 })
  ]);

  const GAP_CANDIDATES = Object.freeze([
    Object.freeze({ mode: "ordered-first", partStrategy: "best-fit", anchoredCombo: false, storageMinFill: 0.72, repairBudget: 34 }),
    Object.freeze({ mode: "best-fit", partStrategy: "difficult", anchoredCombo: false, storageMinFill: 0.66, repairBudget: 34 }),
    Object.freeze({ mode: "shortest-first", partStrategy: "storage-aware", anchoredCombo: false, storageMinFill: 0.62, repairBudget: 34 })
  ]);

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
      parts.push({ partId, length, quantity, effectiveSize, storageAffinity: 0 });
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

  function orderedSourceRank(option) {
    return option.stockSource === "StockOrder" ? 0 : 1;
  }

  function optionKey(option) {
    return `${option.stockSource}\u0000${option.id}`;
  }

  function computeStorageAffinity(parts, options) {
    const storage = options.filter(option => option.stockSource === "StorageStock" && option.availableQuantity > 0);
    if (!storage.length) return;
    const partnerPool = parts.length <= 32
      ? parts
      : [...parts.slice(0, 16), ...parts.slice(-16)];
    for (const part of parts) {
      let best = 0;
      for (const option of storage) {
        if (part.effectiveSize > option.capacity) continue;
        best = Math.max(best, part.effectiveSize / Math.max(1, option.capacity));
        for (const other of partnerPool) {
          const used = part.effectiveSize + other.effectiveSize;
          if (used <= option.capacity) best = Math.max(best, used / Math.max(1, option.capacity));
        }
      }
      part.storageAffinity = best;
    }
  }

  function remainingQuantity(remaining, part) {
    return remaining.get(part.partId) || 0;
  }

  function availableOptionCount(part, options, usage) {
    let count = 0;
    for (const option of options) {
      if (option.capacity < part.effectiveSize) continue;
      const used = usage.get(option) || 0;
      if (option.availableQuantity == null || used < option.availableQuantity) count += 1;
    }
    return count;
  }

  function bestExistingRemainder(part, pieces) {
    let best = Infinity;
    for (const piece of pieces) {
      if (piece.remainingEffectiveCapacity < part.effectiveSize) continue;
      best = Math.min(best, piece.remainingEffectiveCapacity - part.effectiveSize);
    }
    return best;
  }

  function comparePartsForStrategy(left, right, strategy, pieces, options, usage) {
    if (strategy === "difficult") {
      const fitDiff = availableOptionCount(left, options, usage) - availableOptionCount(right, options, usage);
      if (fitDiff) return fitDiff;
      return right.effectiveSize - left.effectiveSize || compareText(left.partId, right.partId);
    }
    if (strategy === "best-fit") {
      const leftOpen = bestExistingRemainder(left, pieces);
      const rightOpen = bestExistingRemainder(right, pieces);
      const leftFits = Number.isFinite(leftOpen) ? 0 : 1;
      const rightFits = Number.isFinite(rightOpen) ? 0 : 1;
      if (leftFits !== rightFits) return leftFits - rightFits;
      if (leftOpen !== rightOpen) return leftOpen - rightOpen;
      return right.effectiveSize - left.effectiveSize || compareText(left.partId, right.partId);
    }
    if (strategy === "storage-aware") {
      if (left.storageAffinity !== right.storageAffinity) return right.storageAffinity - left.storageAffinity;
      return right.effectiveSize - left.effectiveSize || compareText(left.partId, right.partId);
    }
    if (strategy === "alternate-longest") {
      return right.effectiveSize - left.effectiveSize || compareText(right.partId, left.partId);
    }
    return right.effectiveSize - left.effectiveSize || compareText(left.partId, right.partId);
  }

  function activeParts(parts, remaining, strategy, pieces, options, usage) {
    return parts
      .filter(part => remainingQuantity(remaining, part) > 0)
      .sort((left, right) => comparePartsForStrategy(left, right, strategy, pieces, options, usage));
  }

  function chooseNextPart(parts, remaining, config, pieces, options, usage) {
    return activeParts(parts, remaining, config.partStrategy, pieces, options, usage)[0] || null;
  }

  function chooseOpenPiece(pieces, part, config) {
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
      let sourceComparison = 0;
      if (config.mode === "storage-first") sourceComparison = sourceRank(piece.option) - sourceRank(selected.option);
      else if (config.mode === "ordered-first") sourceComparison = orderedSourceRank(piece.option) - orderedSourceRank(selected.option);
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

  function removeLastPart(piece, part) {
    piece.remainingEffectiveCapacity += part.effectiveSize;
    piece.counts[part.partId] -= 1;
    if (piece.counts[part.partId] <= 0) delete piece.counts[part.partId];
    piece.partIds.pop();
  }

  function decrementRemaining(remaining, part) {
    const next = remainingQuantity(remaining, part) - 1;
    if (next < 0) return false;
    remaining.set(part.partId, next);
    return true;
  }

  function greatestCommonDivisor(left, right) {
    let a = Math.abs(left);
    let b = Math.abs(right);
    while (b) {
      const next = a % b;
      a = b;
      b = next;
    }
    return a || 1;
  }

  function findBestPatterns(parts, remaining, capacities, config, pieces, options, usage, requiredPart = null) {
    const uniqueCapacities = [...new Set(capacities.filter(capacity => capacity > 0))].sort((left, right) => left - right);
    const patterns = new Map();
    if (!uniqueCapacities.length) return patterns;

    const maxCapacity = uniqueCapacities[uniqueCapacities.length - 1];
    if (requiredPart
      && (remainingQuantity(remaining, requiredPart) <= 0 || requiredPart.effectiveSize > maxCapacity)) return patterns;

    const ranked = activeParts(parts, remaining, config.partStrategy, pieces, options, usage)
      .filter(part => part.effectiveSize <= maxCapacity);
    if (!ranked.length) return patterns;

    const requiredPartId = requiredPart?.partId || null;
    const baseUsed = requiredPart ? requiredPart.effectiveSize : 0;
    const maxResidualCapacity = maxCapacity - baseUsed;
    const demand = ranked.map(part => ({
      part,
      quantity: Math.max(0, remainingQuantity(remaining, part) - (part.partId === requiredPartId ? 1 : 0))
    }));
    const usable = demand.filter(entry => entry.quantity > 0 && entry.part.effectiveSize <= maxResidualCapacity);
    let maximumUsefulResidual = 0;
    for (const entry of usable) {
      const remainingCapacity = maxResidualCapacity - maximumUsefulResidual;
      if (remainingCapacity <= 0) break;
      const copiesToFillRemaining = Math.ceil(remainingCapacity / entry.part.effectiveSize);
      if (entry.quantity >= copiesToFillRemaining) {
        maximumUsefulResidual = maxResidualCapacity;
        break;
      }
      maximumUsefulResidual += entry.quantity * entry.part.effectiveSize;
    }

    let divisor = 1;
    let normalizedCapacity = 0;
    let finalCounts = null;
    let decisions = [];
    let types = [];

    if (maxResidualCapacity > 0 && usable.length) {
      divisor = 0;
      for (const entry of usable) {
        divisor = divisor ? greatestCommonDivisor(divisor, entry.part.effectiveSize) : entry.part.effectiveSize;
      }
      divisor = Math.max(1, divisor);
      normalizedCapacity = Math.floor(maximumUsefulResidual / divisor);

      // Process lower-priority types first. On equal fill and part count, the
      // transition prefers more copies of the current higher-priority type.
      types = usable.slice().reverse().map(entry => ({
        ...entry,
        weight: entry.part.effectiveSize / divisor
      }));
      let previous = new Int32Array(normalizedCapacity + 1);
      previous.fill(-1);
      previous[0] = 0;
      const queue = new Int32Array(normalizedCapacity + 1);

      for (const type of types) {
        const maxQuantity = Math.min(type.quantity, Math.floor(normalizedCapacity / type.weight));
        const next = new Int32Array(normalizedCapacity + 1);
        next.fill(-1);
        const take = new Uint32Array(normalizedCapacity + 1);

        for (let residue = 0; residue < type.weight && residue <= normalizedCapacity; residue++) {
          const maxStep = Math.floor((normalizedCapacity - residue) / type.weight);
          let head = 0;
          let tail = 0;
          for (let step = 0; step <= maxStep; step++) {
            const state = residue + step * type.weight;
            const minimumStep = step - maxQuantity;
            while (head < tail && queue[head] < minimumStep) head += 1;

            const previousCount = previous[state];
            if (previousCount >= 0) {
              const score = previousCount - step;
              while (head < tail) {
                const queuedStep = queue[tail - 1];
                const queuedState = residue + queuedStep * type.weight;
                const queuedScore = previous[queuedState] - queuedStep;
                if (queuedScore >= score) break;
                tail -= 1;
              }
              queue[tail++] = step;
            }

            if (head < tail) {
              const sourceStep = queue[head];
              const sourceState = residue + sourceStep * type.weight;
              const quantity = step - sourceStep;
              next[state] = previous[sourceState] + quantity;
              take[state] = quantity;
            }
          }
        }
        decisions.push(take);
        previous = next;
      }
      finalCounts = previous;
    }

    function patternForCapacity(capacity) {
      if (requiredPart && capacity < baseUsed) return null;
      const residualCapacity = capacity - baseUsed;
      const counts = new Map();
      if (requiredPart) counts.set(requiredPart.partId, 1);

      let residualUsed = 0;
      let residualPartCount = 0;
      if (finalCounts && residualCapacity > 0) {
        let state = Math.min(normalizedCapacity, Math.floor(residualCapacity / divisor));
        while (state > 0 && finalCounts[state] < 0) state -= 1;
        if (finalCounts[state] >= 0) {
          residualUsed = state * divisor;
          residualPartCount = finalCounts[state];
          for (let index = types.length - 1; index >= 0; index--) {
            const type = types[index];
            const quantity = decisions[index][state];
            if (quantity > 0) {
              counts.set(type.part.partId, (counts.get(type.part.partId) || 0) + quantity);
              state -= quantity * type.weight;
            }
          }
        }
      }

      if (!requiredPart && residualPartCount <= 0) return null;
      const patternParts = [];
      for (const part of ranked) {
        const quantity = counts.get(part.partId) || 0;
        for (let index = 0; index < quantity; index++) patternParts.push(part);
      }
      if (!patternParts.length) return null;

      const used = baseUsed + residualUsed;
      return {
        used,
        leftover: capacity - used,
        parts: patternParts,
        signature: combinationSignature(patternParts)
      };
    }

    for (const capacity of uniqueCapacities) patterns.set(capacity, patternForCapacity(capacity));
    return patterns;
  }

  function combinationSignature(parts) {
    return parts.map(part => part.partId).sort(compareText).join("\u0001");
  }

  function choiceComparator(mode) {
    return (left, right) => {
      if (mode === "storage-first") {
        return sourceRank(left.option) - sourceRank(right.option)
          || left.combo.leftover - right.combo.leftover
          || left.option.length - right.option.length
          || stockStableCompare(left.option, right.option);
      }
      if (mode === "ordered-first") {
        return orderedSourceRank(left.option) - orderedSourceRank(right.option)
          || left.combo.leftover - right.combo.leftover
          || left.option.length - right.option.length
          || stockStableCompare(left.option, right.option);
      }
      if (mode === "shortest-first") {
        return left.option.length - right.option.length
          || left.combo.leftover - right.combo.leftover
          || orderedSourceRank(left.option) - orderedSourceRank(right.option)
          || stockStableCompare(left.option, right.option);
      }
      if (mode === "large-stock") {
        return sourceRank(left.option) - sourceRank(right.option)
          || right.option.capacity - left.option.capacity
          || left.combo.leftover - right.combo.leftover
          || stockStableCompare(left.option, right.option);
      }
      return left.combo.leftover - right.combo.leftover
        || orderedSourceRank(left.option) - orderedSourceRank(right.option)
        || left.option.length - right.option.length
        || stockStableCompare(left.option, right.option);
    };
  }

  function chooseNewPiece(options, usage, parts, remaining, nextPart, config, pieces) {
    const availableOptions = options.filter(option => {
      const usedQuantity = usage.get(option) || 0;
      return option.availableQuantity == null || usedQuantity < option.availableQuantity;
    });
    const requiredPart = config.anchoredCombo ? nextPart : null;
    const patterns = findBestPatterns(
      parts,
      remaining,
      availableOptions.map(option => option.capacity),
      config,
      pieces,
      options,
      usage,
      requiredPart
    );
    const choices = [];
    for (const option of availableOptions) {
      const combo = patterns.get(option.capacity) || null;
      if (!combo) continue;
      choices.push({ option, combo, fill: combo.used / Math.max(1, option.capacity) });
    }
    if (!choices.length) return null;

    const hasOrderedChoice = choices.some(choice => choice.option.stockSource === "StockOrder");
    const filtered = choices.filter(choice => {
      if (choice.option.stockSource !== "StorageStock" || !hasOrderedChoice) return true;
      return choice.fill >= (config.storageMinFill || 0);
    });
    const eligible = filtered.length ? filtered : choices;
    eligible.sort(choiceComparator(config.mode));
    return eligible[0];
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
    const partById = new Map(parts.map(part => [part.partId, part]));
    const optionByKey = new Map(options.map(option => [optionKey(option), option]));
    const stockUsage = new Map();

    for (const piece of pieces) {
      if (!piece || piece.remainingEffectiveCapacity < 0 || !Object.keys(piece.counts).length) return false;
      let effectiveUsed = 0;
      for (const [partId, rawQuantity] of Object.entries(piece.counts)) {
        const quantity = finiteInteger(rawQuantity, 1);
        const part = partById.get(partId);
        if (quantity == null || !part) return false;
        effectiveUsed += quantity * part.effectiveSize;
        actual.set(partId, (actual.get(partId) || 0) + quantity);
      }
      if (effectiveUsed > piece.option.capacity || piece.option.capacity - effectiveUsed !== piece.remainingEffectiveCapacity) return false;
      const key = optionKey(piece.option);
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
        const part = partById.get(partId);
        if (partQuantity == null || !part) return false;
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

  function clonePiece(piece) {
    return {
      option: piece.option,
      remainingEffectiveCapacity: piece.remainingEffectiveCapacity,
      counts: Object.assign(Object.create(null), piece.counts),
      partIds: [...piece.partIds],
      pieceIndex: piece.pieceIndex,
      serial: piece.serial
    };
  }

  function clonePieces(pieces) {
    return pieces.map(clonePiece);
  }

  function pieceUtilization(piece) {
    return piece.option.capacity > 0
      ? (piece.option.capacity - piece.remainingEffectiveCapacity) / piece.option.capacity
      : 1;
  }

  function pieceRepairCompare(left, right) {
    const sourceDiff = orderedSourceRank(left.option) - orderedSourceRank(right.option);
    if (sourceDiff) return sourceDiff;
    const utilizationDiff = pieceUtilization(left) - pieceUtilization(right);
    if (utilizationDiff) return utilizationDiff;
    return right.remainingEffectiveCapacity - left.remainingEffectiveCapacity
      || stockStableCompare(left.option, right.option)
      || left.serial - right.serial;
  }

  function partItems(partIds, partById) {
    const items = [];
    for (const partId of partIds) {
      const part = partById.get(partId);
      if (!part) return null;
      items.push(part);
    }
    return items.sort((left, right) => right.effectiveSize - left.effectiveSize || compareText(left.partId, right.partId));
  }

  function greedyPackIntoPieces(pieces, items) {
    for (const part of items) {
      let bestIndex = -1;
      let bestRemainder = Infinity;
      for (let index = 0; index < pieces.length; index++) {
        const piece = pieces[index];
        if (piece.remainingEffectiveCapacity < part.effectiveSize) continue;
        const remainder = piece.remainingEffectiveCapacity - part.effectiveSize;
        if (remainder < bestRemainder
          || (remainder === bestRemainder && bestIndex >= 0 && stockStableCompare(piece.option, pieces[bestIndex].option) < 0)) {
          bestIndex = index;
          bestRemainder = remainder;
        }
      }
      if (bestIndex < 0) return false;
      placePart(pieces[bestIndex], part);
    }
    return true;
  }

  function searchedPackIntoPieces(pieces, items, maxStates = MAX_REPACK_STATES) {
    let states = 0;
    function visit(itemIndex) {
      if (itemIndex >= items.length) return true;
      if (states >= maxStates) return false;
      const part = items[itemIndex];
      const candidates = [];
      const seen = new Set();
      for (let index = 0; index < pieces.length; index++) {
        const piece = pieces[index];
        if (piece.remainingEffectiveCapacity < part.effectiveSize) continue;
        const symmetry = `${optionKey(piece.option)}\u0000${piece.remainingEffectiveCapacity}`;
        if (seen.has(symmetry)) continue;
        seen.add(symmetry);
        candidates.push({ index, remainder: piece.remainingEffectiveCapacity - part.effectiveSize });
      }
      candidates.sort((left, right) => left.remainder - right.remainder
        || stockStableCompare(pieces[left.index].option, pieces[right.index].option)
        || pieces[left.index].serial - pieces[right.index].serial);
      for (const candidate of candidates.slice(0, 6)) {
        if (states >= maxStates) break;
        states += 1;
        const piece = pieces[candidate.index];
        placePart(piece, part);
        if (visit(itemIndex + 1)) return true;
        removeLastPart(piece, part);
      }
      return false;
    }
    return visit(0);
  }

  function repackIntoPieces(basePieces, items) {
    const greedy = clonePieces(basePieces);
    if (greedyPackIntoPieces(greedy, items)) return greedy;
    if (items.length > MAX_REPACK_ITEMS_FOR_SEARCH) return null;
    const searched = clonePieces(basePieces);
    return searchedPackIntoPieces(searched, items) ? searched : null;
  }

  function usageCountForOption(pieces, option) {
    return pieces.reduce((count, piece) => count + (piece.option === option ? 1 : 0), 0);
  }

  function createEmptyPiece(option, pieceIndex, serial) {
    return {
      option,
      remainingEffectiveCapacity: option.capacity,
      counts: Object.create(null),
      partIds: [],
      pieceIndex,
      serial
    };
  }

  function improvedPieces(currentPieces, proposedPieces, settings) {
    if (!proposedPieces || proposedPieces.some(piece => !piece.partIds.length)) return null;
    return compareObjectives(objectiveForPieces(proposedPieces, settings), objectiveForPieces(currentPieces, settings)) < 0
      ? proposedPieces
      : null;
  }

  function attemptRemoveTarget(pieces, target, partById, options, settings, serialSeed) {
    const items = partItems(target.partIds, partById);
    if (!items) return null;
    const withoutTarget = pieces.filter(piece => piece.serial !== target.serial);

    const direct = repackIntoPieces(withoutTarget, items);
    const directImprovement = improvedPieces(pieces, direct, settings);
    if (directImprovement) return directImprovement;

    const donors = withoutTarget.slice().sort(pieceRepairCompare).slice(0, MAX_REPAIR_DONORS);
    for (const donor of donors) {
      const donorItems = partItems(donor.partIds, partById);
      if (!donorItems) continue;
      const base = clonePieces(withoutTarget);
      const clearedDonor = base.find(piece => piece.serial === donor.serial);
      if (!clearedDonor) continue;
      clearedDonor.remainingEffectiveCapacity = clearedDonor.option.capacity;
      clearedDonor.counts = Object.create(null);
      clearedDonor.partIds = [];
      const repacked = repackIntoPieces(base, [...items, ...donorItems].sort((a, b) => b.effectiveSize - a.effectiveSize || compareText(a.partId, b.partId)));
      const improvement = improvedPieces(pieces, repacked, settings);
      if (improvement) return improvement;
    }

    if (target.option.stockSource === "StockOrder") {
      const unusedStorage = options
        .filter(option => option.stockSource === "StorageStock"
          && (option.availableQuantity == null || usageCountForOption(withoutTarget, option) < option.availableQuantity))
        .sort((left, right) => right.capacity - left.capacity || left.length - right.length || stockStableCompare(left, right))
        .slice(0, 4);
      for (const option of unusedStorage) {
        const base = clonePieces(withoutTarget);
        const pieceIndex = usageCountForOption(base, option) + 1;
        base.push(createEmptyPiece(option, pieceIndex, serialSeed));
        const repacked = repackIntoPieces(base, items);
        const improvement = improvedPieces(pieces, repacked, settings);
        if (improvement) return improvement;
      }
    }
    return null;
  }

  function repairPieces(initialPieces, parts, options, settings, repairBudget) {
    const partById = new Map(parts.map(part => [part.partId, part]));
    let pieces = clonePieces(initialPieces);
    let attempts = 0;
    let serialSeed = pieces.reduce((maximum, piece) => Math.max(maximum, piece.serial || 0), 0) + 1;
    const maxAttempts = Math.min(MAX_REPAIR_TARGETS, Math.max(1, repairBudget || 20));

    while (attempts < maxAttempts) {
      const targets = pieces.slice().sort(pieceRepairCompare);
      let accepted = null;
      for (const target of targets) {
        if (attempts >= maxAttempts) break;
        attempts += 1;
        accepted = attemptRemoveTarget(pieces, target, partById, options, settings, serialSeed++);
        if (accepted) break;
      }
      if (!accepted) break;
      pieces = accepted;
    }
    return pieces;
  }

  function candidateFromPieces(group, parts, options, pieces, settings) {
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

  function runCandidate(group, parts, options, settings, config) {
    const usage = new Map();
    const remaining = new Map(parts.map(part => [part.partId, part.quantity]));
    const pieces = [];
    let serial = 1;
    let remainingTotal = parts.reduce((sum, part) => sum + part.quantity, 0);

    while (remainingTotal > 0) {
      const nextPart = chooseNextPart(parts, remaining, config, pieces, options, usage);
      if (!nextPart) return null;
      const existing = chooseOpenPiece(pieces, nextPart, config);
      if (existing) {
        placePart(existing, nextPart);
        if (!decrementRemaining(remaining, nextPart)) return null;
        remainingTotal -= 1;
        continue;
      }

      const choice = chooseNewPiece(options, usage, parts, remaining, nextPart, config, pieces);
      if (!choice) return null;
      usage.set(choice.option, (usage.get(choice.option) || 0) + 1);
      const piece = createEmptyPiece(choice.option, usage.get(choice.option), serial++);
      for (const part of choice.combo.parts) {
        if (remainingQuantity(remaining, part) <= 0 || piece.remainingEffectiveCapacity < part.effectiveSize) return null;
        placePart(piece, part);
        if (!decrementRemaining(remaining, part)) return null;
        remainingTotal -= 1;
      }
      pieces.push(piece);
    }

    const repaired = repairPieces(pieces, parts, options, settings, config.repairBudget);
    return candidateFromPieces(group, parts, options, repaired, settings);
  }

  function safeAdd(left, right) {
    const result = left + right;
    return Number.isSafeInteger(result) ? result : null;
  }

  function safeMultiply(left, right) {
    const result = left * right;
    return Number.isSafeInteger(result) ? result : null;
  }

  function orderedStockLowerBoundForNormalized(parts, options) {
    let totalDemand = 0;
    for (const part of parts) {
      const contribution = safeMultiply(part.effectiveSize, part.quantity);
      if (contribution == null) return null;
      totalDemand = safeAdd(totalDemand, contribution);
      if (totalDemand == null) return null;
    }

    let storageCapacity = 0;
    for (const option of options) {
      if (option.stockSource !== "StorageStock" || !option.availableQuantity) continue;
      if (!parts.some(part => part.effectiveSize <= option.capacity)) continue;
      const contribution = safeMultiply(option.capacity, option.availableQuantity);
      if (contribution == null) return null;
      storageCapacity = safeAdd(storageCapacity, contribution);
      if (storageCapacity == null) return null;
    }

    let remainingDemand = Math.max(0, totalDemand - storageCapacity);
    if (!remainingDemand) return 0;
    const ordered = options
      .filter(option => option.stockSource === "StockOrder" && option.capacity > 0)
      .sort((left, right) => right.capacity - left.capacity || stockStableCompare(left, right));
    if (!ordered.length) return null;

    let count = 0;
    for (const option of ordered) {
      if (remainingDemand <= 0) break;
      if (option.availableQuantity == null) {
        const needed = Math.ceil(remainingDemand / option.capacity);
        count += needed;
        remainingDemand = 0;
        break;
      }
      const needed = Math.ceil(remainingDemand / option.capacity);
      const used = Math.min(option.availableQuantity, needed);
      count += used;
      remainingDemand -= used * option.capacity;
    }
    return remainingDemand > 0 ? null : count;
  }

  function orderedStockLowerBound(group, cuttingSettings) {
    const settings = normalizeSettings(cuttingSettings);
    if (!settings) return null;
    const parts = normalizeParts(group, settings);
    const options = normalizeStock(group, settings);
    if (!parts || !options?.length) return null;
    return orderedStockLowerBoundForNormalized(parts, options);
  }

  function solve(group, cuttingSettings) {
    const settings = normalizeSettings(cuttingSettings);
    if (!settings || !stableText(group?.groupId).trim()) return null;
    const parts = normalizeParts(group, settings);
    const options = normalizeStock(group, settings);
    if (!parts || !options?.length) return null;
    if (parts.some(part => !options.some(option => option.capacity >= part.effectiveSize))) return null;
    computeStorageAffinity(parts, options);

    const lowerBound = orderedStockLowerBoundForNormalized(parts, options);
    let best = null;
    for (const config of BASE_CANDIDATES) {
      const candidate = runCandidate(group, parts, options, settings, config);
      if (!candidate) continue;
      if (!best || compareObjectives(candidate.objective, best.objective) < 0) best = candidate;
    }

    if (best && lowerBound != null && best.objective.orderedStockQuantity > lowerBound) {
      for (const config of GAP_CANDIDATES) {
        const candidate = runCandidate(group, parts, options, settings, config);
        if (!candidate) continue;
        if (compareObjectives(candidate.objective, best.objective) < 0) best = candidate;
        if (best.objective.orderedStockQuantity <= lowerBound) break;
      }
    }
    return best;
  }

  window.NcNestingGreedy = Object.freeze({
    ALGORITHM_VERSION,
    PASS_MODES,
    solve,
    orderedStockLowerBound
  });
})();
