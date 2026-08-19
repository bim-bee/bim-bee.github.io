(function initNcNestingSolvePreflight() {
  "use strict";

  const Geometry = window.NcNestingCuttingGeometry;

  const Decision = Object.freeze({
    ALLOW: "Allow",
    WARNING: "Warning",
    BLOCK: "Block"
  });

  const ReasonCode = Object.freeze({
    INVALID_INTEGER: "invalid_integer",
    NO_USABLE_STOCK: "no_usable_stock",
    PART_DOES_NOT_FIT: "part_does_not_fit",
    FINITE_CAPACITY_INSUFFICIENT: "finite_capacity_insufficient",
    COMPLEXITY_HARD_LIMIT: "complexity_hard_limit",
    COMPLEXITY_PREFERRED_LIMIT: "complexity_preferred_limit",
    COMPLEXITY_UNCERTAIN: "complexity_uncertain",
    COMPLEXITY_ESTIMATES_DISAGREE: "complexity_estimates_disagree",
    BATCH_COMPLEXITY_LIMIT: "batch_complexity_limit",
    TOO_MANY_GROUPS: "too_many_groups"
  });

  const ValidationCategory = Object.freeze({
    PARTS: "parts",
    STOCK: "stock",
    STORAGE: "storage",
    CUTTING_SETTINGS: "cuttingSettings",
    GENERAL: "general"
  });

  const ComplexityBand = Object.freeze({
    GREEN: "green",
    YELLOW: "yellow",
    ORANGE: "orange",
    INVALID: "invalid"
  });

  const ProbeStatus = Object.freeze({
    COMPLETED: "Completed",
    COUNT_LIMIT_EXCEEDED: "CountLimitExceeded",
    STATE_LIMIT_EXCEEDED: "StateLimitExceeded",
    ARC_LIMIT_EXCEEDED: "ArcLimitExceeded",
    WORK_BUDGET_REACHED: "WorkBudgetReached",
    NOT_RUN: "NotRun"
  });

  function currentTime() {
    return globalThis.performance?.now ? globalThis.performance.now() : Date.now();
  }

  function positiveLimit(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new Error(`Invalid preflight limit: ${name}`);
    return Math.floor(number);
  }

  function positiveNumber(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new Error(`Invalid preflight limit: ${name}`);
    return number;
  }

  function nonNegativeNumber(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new Error(`Invalid preflight limit: ${name}`);
    return number;
  }

  function resolveLimits(overrides) {
    const base = globalThis.NcNestingConfig?.solvePreflightLimits;
    if (!base) throw new Error("Solve preflight limits are not configured.");
    const canonical = { ...(base.canonicalLayouts || {}), ...(overrides?.canonicalLayouts || {}) };
    const arc = { ...(base.arcFlow || {}), ...(overrides?.arcFlow || {}) };
    const exact = { ...(base.exactAssignment || {}), ...(overrides?.exactAssignment || {}) };
    const scoring = { ...(base.complexityScoring || {}), ...(overrides?.complexityScoring || {}) };
    const work = { ...(base.work || {}), ...(overrides?.work || {}) };
    return {
      maxNestingGroups: positiveLimit(overrides?.maxNestingGroups ?? base.maxNestingGroups, "maxNestingGroups"),
      canonicalLayouts: {
        reference: positiveLimit(canonical.reference, "canonicalLayouts.reference"),
        hard: positiveLimit(canonical.hard, "canonicalLayouts.hard")
      },
      arcFlow: {
        statesReference: positiveLimit(arc.statesReference, "arcFlow.statesReference"),
        statesHard: positiveLimit(arc.statesHard, "arcFlow.statesHard"),
        arcsReference: positiveLimit(arc.arcsReference, "arcFlow.arcsReference"),
        arcsHard: positiveLimit(arc.arcsHard, "arcFlow.arcsHard")
      },
      exactAssignment: {
        stockSlotsReference: positiveLimit(exact.stockSlotsReference, "exactAssignment.stockSlotsReference"),
        stockSlotsHard: positiveLimit(exact.stockSlotsHard, "exactAssignment.stockSlotsHard"),
        variablesReference: positiveLimit(exact.variablesReference, "exactAssignment.variablesReference"),
        variablesHard: positiveLimit(exact.variablesHard, "exactAssignment.variablesHard"),
        constraintsReference: positiveLimit(exact.constraintsReference, "exactAssignment.constraintsReference"),
        constraintsHard: positiveLimit(exact.constraintsHard, "exactAssignment.constraintsHard"),
        fixedAuxiliaryVariablesPerSlot: positiveLimit(exact.fixedAuxiliaryVariablesPerSlot, "exactAssignment.fixedAuxiliaryVariablesPerSlot"),
        perStockSlotConstraints: positiveLimit(exact.perStockSlotConstraints, "exactAssignment.perStockSlotConstraints")
      },
      complexityScoring: {
        batchBudget: positiveNumber(scoring.batchBudget, "complexityScoring.batchBudget"),
        perGroupOverhead: nonNegativeNumber(scoring.perGroupOverhead, "complexityScoring.perGroupOverhead"),
        uncertainFallbackRawScore: positiveNumber(scoring.uncertainFallbackRawScore, "complexityScoring.uncertainFallbackRawScore"),
        greenMaximumCost: positiveNumber(scoring.greenMaximumCost, "complexityScoring.greenMaximumCost"),
        yellowMaximumCost: positiveNumber(scoring.yellowMaximumCost, "complexityScoring.yellowMaximumCost")
      },
      work: {
        maximumOperationsPerGroup: positiveLimit(work.maximumOperationsPerGroup, "work.maximumOperationsPerGroup"),
        maximumMillisecondsPerGroup: positiveLimit(work.maximumMillisecondsPerGroup, "work.maximumMillisecondsPerGroup"),
        maximumMillisecondsPerBatch: positiveLimit(work.maximumMillisecondsPerBatch, "work.maximumMillisecondsPerBatch")
      }
    };
  }

  function isSafeInteger(value, minimum = 0) {
    return Number.isSafeInteger(value) && value >= minimum;
  }

  function normalizedInteger(value, minimum = 0) {
    const number = Number(value);
    return isSafeInteger(number, minimum) ? number : null;
  }

  function safeAdd(left, right) {
    const result = left + right;
    return Number.isSafeInteger(result) ? result : null;
  }

  function safeMultiply(left, right) {
    const result = left * right;
    return Number.isSafeInteger(result) ? result : null;
  }

  function greatestCommonDivisor(left, right) {
    let a = Math.abs(left);
    let b = Math.abs(right);
    while (b) {
      const remainder = a % b;
      a = b;
      b = remainder;
    }
    return a;
  }

  function groupIdentity(group) {
    return {
      groupId: String(group?.groupId || ""),
      profileName: String(group?.profileName || "").trim(),
      steelGrade: String(group?.steelGrade || "").trim()
    };
  }

  function invalidGroupResult(group, category = ValidationCategory.GENERAL, measurements = {}) {
    return {
      ...groupIdentity(group),
      decision: Decision.BLOCK,
      reasonCodes: [ReasonCode.INVALID_INTEGER],
      category,
      measurements
    };
  }

  function prepareGroup(group, cuttingSettings) {
    const identity = groupIdentity(group);
    const toolWidth = normalizedInteger(cuttingSettings?.toolWidth, 0);
    const trimStart = normalizedInteger(cuttingSettings?.trimStart, 0);
    const trimEnd = normalizedInteger(cuttingSettings?.trimEnd, 0);
    const reusableMinimumLength = normalizedInteger(cuttingSettings?.reusableMinimumLength, 0);
    if ([toolWidth, trimStart, trimEnd, reusableMinimumLength].some(value => value === null)) {
      return { result: invalidGroupResult(group, ValidationCategory.CUTTING_SETTINGS), prepared: null };
    }
    const aggregatedByLength = new Map();
    let totalPartQuantity = 0;
    let totalEffectivePartDemand = 0;
    for (const part of Array.isArray(group?.partRequirements) ? group.partRequirements : []) {
      const length = normalizedInteger(part?.length, 1);
      const quantity = normalizedInteger(part?.quantity, 1);
      if (length === null || quantity === null) return { result: invalidGroupResult(group, ValidationCategory.PARTS), prepared: null };
      const effectiveSize = Geometry?.effectiveItemSize(length, toolWidth) ?? null;
      if (effectiveSize === null || effectiveSize <= 0) return { result: invalidGroupResult(group, ValidationCategory.PARTS), prepared: null };
      const nextQuantity = safeAdd(aggregatedByLength.get(length)?.quantity || 0, quantity);
      const demand = safeMultiply(effectiveSize, quantity);
      totalPartQuantity = safeAdd(totalPartQuantity, quantity);
      totalEffectivePartDemand = demand === null || totalEffectivePartDemand === null ? null : safeAdd(totalEffectivePartDemand, demand);
      if (nextQuantity === null || totalPartQuantity === null || totalEffectivePartDemand === null) {
        return { result: invalidGroupResult(group, ValidationCategory.PARTS), prepared: null };
      }
      aggregatedByLength.set(length, { length, effectiveSize, quantity: nextQuantity });
    }

    if (!aggregatedByLength.size || totalPartQuantity <= 0) return { result: invalidGroupResult(group, ValidationCategory.PARTS), prepared: null };

    const aggregatedParts = [...aggregatedByLength.values()]
      .sort((left, right) => left.effectiveSize - right.effectiveSize || left.length - right.length);

    const stockOptions = [];
    const stockRows = [
      ...(Array.isArray(group?.stockOrders) ? group.stockOrders.map(order => ({
        source: "StockOrder",
        id: String(order?.stockOrderId || ""),
        length: order?.length,
        quantity: order?.availableQuantity,
        unlimited: order?.availableQuantity == null
      })) : []),
      ...(Array.isArray(group?.storageStock) ? group.storageStock.map(stock => ({
        source: "StorageStock",
        id: String(stock?.groupedStorageStockId || ""),
        length: stock?.length,
        quantity: stock?.quantity,
        unlimited: false
      })) : [])
    ];

    let totalFiniteEffectiveStockCapacity = 0;
    let totalFiniteStockQuantity = 0;
    for (const stock of stockRows) {
      const length = normalizedInteger(stock.length, 1);
      const quantity = stock.unlimited ? null : normalizedInteger(stock.quantity, 1);
      if (length === null || (!stock.unlimited && quantity === null)) {
        const category = stock.source === "StorageStock" ? ValidationCategory.STORAGE : ValidationCategory.STOCK;
        return { result: invalidGroupResult(group, category), prepared: null };
      }
      const capacity = Geometry?.effectiveFitCapacity(length, {
        toolWidth,
        trimStart,
        trimEnd,
        reusableMinimumLength
      }) ?? null;
      if (capacity === null || !Number.isSafeInteger(capacity)) {
        const category = stock.source === "StorageStock" ? ValidationCategory.STORAGE : ValidationCategory.STOCK;
        return { result: invalidGroupResult(group, category), prepared: null };
      }
      const option = { ...stock, length, quantity, capacity };
      stockOptions.push(option);
      if (!stock.unlimited && capacity > 0) {
        const optionCapacity = safeMultiply(capacity, quantity);
        totalFiniteEffectiveStockCapacity = optionCapacity === null ? null : safeAdd(totalFiniteEffectiveStockCapacity, optionCapacity);
        totalFiniteStockQuantity = safeAdd(totalFiniteStockQuantity, quantity);
        if (optionCapacity === null || totalFiniteEffectiveStockCapacity === null || totalFiniteStockQuantity === null) {
          const category = stock.source === "StorageStock" ? ValidationCategory.STORAGE : ValidationCategory.STOCK;
          return { result: invalidGroupResult(group, category), prepared: null };
        }
      }
    }

    const usableStockOptions = stockOptions.filter(option => option.capacity > 0);
    const largestUsableStockCapacity = usableStockOptions.reduce((maximum, option) => Math.max(maximum, option.capacity), 0);
    const shortestEffectiveItemSize = aggregatedParts[0]?.effectiveSize || 0;
    const maximumPiecesPerStock = shortestEffectiveItemSize > 0
      ? Math.floor(largestUsableStockCapacity / shortestEffectiveItemSize)
      : 0;
    const measurements = {
      aggregatedDistinctLengthCount: aggregatedParts.length,
      totalPartQuantity,
      shortestEffectiveItemSize,
      largestUsableStockCapacity,
      maximumPiecesPerStock,
      totalEffectivePartDemand,
      totalFiniteEffectiveStockCapacity
    };

    if (!stockOptions.length || !usableStockOptions.length) {
      return {
        result: { ...identity, decision: Decision.BLOCK, reasonCodes: [ReasonCode.NO_USABLE_STOCK], category: ValidationCategory.STOCK, measurements },
        prepared: null
      };
    }

    if (aggregatedParts.some(part => part.effectiveSize > largestUsableStockCapacity)) {
      return {
        result: { ...identity, decision: Decision.BLOCK, reasonCodes: [ReasonCode.PART_DOES_NOT_FIT], category: ValidationCategory.STOCK, measurements },
        prepared: null
      };
    }

    const allUsableStockIsFinite = usableStockOptions.every(option => !option.unlimited);
    if (allUsableStockIsFinite && totalFiniteEffectiveStockCapacity < totalEffectivePartDemand) {
      return {
        result: { ...identity, decision: Decision.BLOCK, reasonCodes: [ReasonCode.FINITE_CAPACITY_INSUFFICIENT], category: ValidationCategory.STOCK, measurements },
        prepared: null
      };
    }

    const capacityMultiplicity = new Map();
    usableStockOptions.forEach(option => {
      capacityMultiplicity.set(option.capacity, (capacityMultiplicity.get(option.capacity) || 0) + 1);
    });

    return {
      result: null,
      prepared: {
        ...identity,
        aggregatedParts,
        stockOptions,
        usableStockOptions,
        capacityMultiplicity,
        totalPartQuantity,
        totalFiniteStockQuantity,
        measurements
      }
    };
  }

  function createWorkBudget(limits, batchDeadline) {
    const startedAt = currentTime();
    const groupDeadline = Math.min(batchDeadline, startedAt + limits.work.maximumMillisecondsPerGroup);
    let operations = 0;
    return {
      step(count = 1) {
        operations += count;
        if (operations > limits.work.maximumOperationsPerGroup) return false;
        return (operations & 255) !== 0 || currentTime() <= groupDeadline;
      },
      exhausted() {
        return operations > limits.work.maximumOperationsPerGroup || currentTime() > groupDeadline;
      },
      get operations() { return operations; },
      get elapsedMilliseconds() { return Math.max(0, currentTime() - startedAt); }
    };
  }

  function countCanonicalLayouts(parts, capacity, countLimit, budget) {
    let ways = new Map([[0, 1]]);
    for (const part of parts) {
      const nextWays = new Map();
      for (const [used, vectorCount] of ways) {
        const maximumCount = Math.min(part.quantity, Math.floor((capacity - used) / part.effectiveSize));
        for (let count = 0; count <= maximumCount; count++) {
          if (!budget.step()) {
            return { status: ProbeStatus.WORK_BUDGET_REACHED, exact: false, lowerBound: 0 };
          }
          const nextUsed = used + count * part.effectiveSize;
          const existing = nextWays.get(nextUsed) || 0;
          nextWays.set(nextUsed, Math.min(countLimit + 2, existing + vectorCount));
        }
      }
      ways = nextWays;
      let partialVectorCount = -1;
      for (const count of ways.values()) {
        if (!budget.step()) {
          return { status: ProbeStatus.WORK_BUDGET_REACHED, exact: false, lowerBound: 0 };
        }
        partialVectorCount = Math.min(countLimit + 1, partialVectorCount + count);
        if (partialVectorCount > countLimit) {
          return {
            status: ProbeStatus.COUNT_LIMIT_EXCEEDED,
            exact: false,
            lowerBound: countLimit + 1
          };
        }
      }
    }

    let count = -1;
    for (const vectorCount of ways.values()) {
      if (!budget.step()) return { status: ProbeStatus.WORK_BUDGET_REACHED, exact: false, lowerBound: 0 };
      count += vectorCount;
      if (count > countLimit) {
        return { status: ProbeStatus.COUNT_LIMIT_EXCEEDED, exact: false, lowerBound: countLimit + 1 };
      }
    }
    return { status: ProbeStatus.COMPLETED, exact: true, count: Math.max(0, count), lowerBound: Math.max(0, count) };
  }

  function runCanonicalProbe(prepared, limits, budget) {
    const capacityResults = [];
    let combinedLayoutCount = 0;
    let combinedLowerBound = 0;
    let exact = true;
    let hardExceeded = false;
    const entries = [...prepared.capacityMultiplicity.entries()].sort((left, right) => left[0] - right[0]);

    for (const [capacity, stockOptionMultiplicity] of entries) {
      const result = countCanonicalLayouts(prepared.aggregatedParts, capacity, limits.canonicalLayouts.hard, budget);
      capacityResults.push({ capacity, stockOptionMultiplicity, ...result });
      if (result.status === ProbeStatus.WORK_BUDGET_REACHED) {
        exact = false;
        break;
      }
      if (result.status === ProbeStatus.COUNT_LIMIT_EXCEEDED) {
        exact = false;
        hardExceeded = true;
        combinedLowerBound = limits.canonicalLayouts.hard + 1;
        break;
      }
      const weightedCount = safeMultiply(result.count, stockOptionMultiplicity);
      combinedLayoutCount = weightedCount === null ? null : safeAdd(combinedLayoutCount, weightedCount);
      if (combinedLayoutCount === null) {
        exact = false;
        hardExceeded = true;
        combinedLowerBound = limits.canonicalLayouts.hard + 1;
        break;
      }
      combinedLowerBound = combinedLayoutCount;
      if (combinedLayoutCount > limits.canonicalLayouts.hard) {
        hardExceeded = true;
        break;
      }
    }

    return {
      status: hardExceeded
        ? ProbeStatus.COUNT_LIMIT_EXCEEDED
        : exact && capacityResults.length === entries.length
          ? ProbeStatus.COMPLETED
          : ProbeStatus.WORK_BUDGET_REACHED,
      exact: exact && capacityResults.length === entries.length && !hardExceeded,
      capacityResults,
      combinedLayoutCount: exact && !hardExceeded ? combinedLayoutCount : null,
      combinedLowerBound,
      referenceFits: exact && !hardExceeded && combinedLayoutCount <= limits.canonicalLayouts.reference,
      referenceExceeded: hardExceeded || (exact && combinedLayoutCount > limits.canonicalLayouts.reference),
      hardExceeded,
      operations: budget.operations
    };
  }

  function runArcCapacityProbe(parts, capacity, stateLimit, arcLimit, budget) {
    let currentStates = new Set([0]);
    let stateCount = 1;
    let arcCount = 0;

    for (const part of parts) {
      const nextStates = new Set();
      for (const used of currentStates) {
        const maximumCount = Math.min(part.quantity, Math.floor((capacity - used) / part.normalizedSize));
        for (let count = 0; count <= maximumCount; count++) {
          if (!budget.step()) {
            return { status: ProbeStatus.WORK_BUDGET_REACHED, exact: false, stateCount, arcCount };
          }
          arcCount++;
          if (arcCount > arcLimit) {
            return { status: ProbeStatus.ARC_LIMIT_EXCEEDED, exact: false, stateCount, arcCount };
          }
          nextStates.add(used + count * part.normalizedSize);
        }
      }
      stateCount += nextStates.size;
      if (stateCount > stateLimit) {
        return { status: ProbeStatus.STATE_LIMIT_EXCEEDED, exact: false, stateCount, arcCount };
      }
      currentStates = nextStates;
    }

    return { status: ProbeStatus.COMPLETED, exact: true, stateCount, arcCount };
  }

  function runArcFlowProbe(prepared, limits, budget) {
    const capacities = [...prepared.capacityMultiplicity.keys()].sort((left, right) => left - right);
    let divisor = 0;
    prepared.aggregatedParts.forEach(part => { divisor = greatestCommonDivisor(divisor, part.effectiveSize); });
    capacities.forEach(capacity => { divisor = greatestCommonDivisor(divisor, capacity); });
    divisor = Math.max(1, divisor);

    const normalizedParts = prepared.aggregatedParts.map(part => ({
      normalizedSize: part.effectiveSize / divisor,
      quantity: part.quantity
    }));
    const normalizedCapacities = [...new Set(capacities.map(capacity => capacity / divisor))];
    if (normalizedParts.some(part => !Number.isSafeInteger(part.normalizedSize)) || normalizedCapacities.some(capacity => !Number.isSafeInteger(capacity))) {
      return {
        status: ProbeStatus.WORK_BUDGET_REACHED,
        exact: false,
        divisor,
        capacityResults: [],
        stateCount: null,
        arcCount: null,
        referenceFits: false,
        referenceExceeded: false,
        hardExceeded: false
      };
    }

    const capacityResults = [];
    let stateCount = 0;
    let arcCount = 0;
    let hardExceeded = false;
    let exact = true;
    let terminalStatus = ProbeStatus.COMPLETED;

    for (const capacity of normalizedCapacities) {
      const stateRemaining = Math.max(0, limits.arcFlow.statesHard - stateCount);
      const arcRemaining = Math.max(0, limits.arcFlow.arcsHard - arcCount);
      if (stateRemaining === 0) {
        hardExceeded = true;
        terminalStatus = ProbeStatus.STATE_LIMIT_EXCEEDED;
        break;
      }
      if (arcRemaining === 0) {
        hardExceeded = true;
        terminalStatus = ProbeStatus.ARC_LIMIT_EXCEEDED;
        break;
      }
      const result = runArcCapacityProbe(normalizedParts, capacity, stateRemaining, arcRemaining, budget);
      capacityResults.push({ normalizedCapacity: capacity, ...result });
      stateCount += result.stateCount;
      arcCount += result.arcCount;
      terminalStatus = result.status;
      if (result.status === ProbeStatus.STATE_LIMIT_EXCEEDED || result.status === ProbeStatus.ARC_LIMIT_EXCEEDED) {
        hardExceeded = true;
        exact = false;
        break;
      }
      if (result.status === ProbeStatus.WORK_BUDGET_REACHED) {
        exact = false;
        break;
      }
    }

    const completed = exact && capacityResults.length === normalizedCapacities.length;
    return {
      status: completed ? ProbeStatus.COMPLETED : terminalStatus,
      exact: completed,
      divisor,
      capacityResults,
      stateCount: completed || hardExceeded ? stateCount : null,
      arcCount: completed || hardExceeded ? arcCount : null,
      referenceFits: completed
        && stateCount <= limits.arcFlow.statesReference
        && arcCount <= limits.arcFlow.arcsReference,
      referenceExceeded: hardExceeded || (completed && (
        stateCount > limits.arcFlow.statesReference
        || arcCount > limits.arcFlow.arcsReference
      )),
      hardExceeded,
      operations: budget.operations
    };
  }

  function firstFitDecreasingBinCount(parts, capacity, budget, stopAfter) {
    const bins = [];
    const descendingParts = [...parts].sort((left, right) => right.effectiveSize - left.effectiveSize);
    for (const part of descendingParts) {
      for (let copy = 0; copy < part.quantity; copy++) {
        if (!budget.step()) return { completed: false, bins: bins.length, workBudgetReached: true };
        let placed = false;
        for (let index = 0; index < bins.length; index++) {
          if (!budget.step()) return { completed: false, bins: bins.length, workBudgetReached: true };
          if (bins[index] >= part.effectiveSize) {
            bins[index] -= part.effectiveSize;
            placed = true;
            break;
          }
        }
        if (!placed) bins.push(capacity - part.effectiveSize);
        if (bins.length > stopAfter) return { completed: false, bins: bins.length, hardLimitProven: true };
      }
    }
    return { completed: true, bins: bins.length };
  }

  // This is the single frontend approximation of the backend assignment-model shape.
  // Keep the slot, variable, and constraint formulas together when backend sizing changes.
  function estimateExactAssignment(prepared, limits, budget) {
    const exactLimits = limits.exactAssignment;
    const stockOptionCount = prepared.usableStockOptions.length;
    const aggregatedPartCount = prepared.aggregatedParts.length;
    const finiteOptionCount = prepared.usableStockOptions.filter(option => !option.unlimited).length;
    const finiteAvailability = prepared.totalFiniteStockQuantity;
    const unlimitedRegular = prepared.usableStockOptions.filter(option => option.source === "StockOrder" && option.unlimited);
    const largestUnlimitedCapacity = unlimitedRegular.reduce((maximum, option) => Math.max(maximum, option.capacity), 0);

    let stockSlots = Math.min(prepared.totalPartQuantity, finiteAvailability || prepared.totalPartQuantity);
    let estimateComplete = unlimitedRegular.length === 0;
    let method = unlimitedRegular.length === 0 ? "finite-availability" : "general-upper-bound";
    let hardLimitProven = false;

    if (unlimitedRegular.length) {
      const allPartsFitUnlimited = prepared.aggregatedParts.every(part => part.effectiveSize <= largestUnlimitedCapacity);
      if (allPartsFitUnlimited) {
        const ffd = firstFitDecreasingBinCount(
          prepared.aggregatedParts,
          largestUnlimitedCapacity,
          budget,
          exactLimits.stockSlotsHard
        );
        if (ffd.completed) {
          const combinedSlots = safeAdd(finiteAvailability, ffd.bins);
          if (combinedSlots === null) {
            stockSlots = prepared.totalPartQuantity;
            estimateComplete = false;
            method = "general-upper-bound-overflow";
          } else {
            stockSlots = Math.min(prepared.totalPartQuantity, combinedSlots);
            estimateComplete = true;
          }
          if (estimateComplete) method = "finite-plus-ffd-unlimited";
        } else if (ffd.hardLimitProven) {
          stockSlots = ffd.bins;
          estimateComplete = true;
          hardLimitProven = true;
          method = "ffd-hard-limit-proven";
        } else {
          stockSlots = prepared.totalPartQuantity;
          method = "general-upper-bound-work-budget";
        }
      } else {
        stockSlots = prepared.totalPartQuantity;
        method = "general-upper-bound-mixed-fit";
      }
    }

    const optionAndPartVariables = safeAdd(stockOptionCount, aggregatedPartCount);
    const variablesPerSlot = optionAndPartVariables === null
      ? null
      : safeAdd(optionAndPartVariables, exactLimits.fixedAuxiliaryVariablesPerSlot);
    const variables = variablesPerSlot === null ? null : safeMultiply(stockSlots, variablesPerSlot);
    const slotConstraints = safeMultiply(stockSlots, exactLimits.perStockSlotConstraints);
    const symmetryConstraints = Math.max(0, stockSlots - 1);
    const baseConstraints = safeAdd(aggregatedPartCount, finiteOptionCount);
    let constraints = slotConstraints === null || baseConstraints === null ? null : safeAdd(baseConstraints, slotConstraints);
    constraints = constraints === null ? null : safeAdd(constraints, symmetryConstraints);
    const invalidSize = variables === null || constraints === null;
    if (invalidSize) {
      hardLimitProven = estimateComplete;
    }

    const referenceFits = !invalidSize
      && stockSlots <= exactLimits.stockSlotsReference
      && variables <= exactLimits.variablesReference
      && constraints <= exactLimits.constraintsReference;
    const aboveHard = invalidSize
      || stockSlots > exactLimits.stockSlotsHard
      || variables > exactLimits.variablesHard
      || constraints > exactLimits.constraintsHard;

    return {
      status: estimateComplete ? ProbeStatus.COMPLETED : ProbeStatus.WORK_BUDGET_REACHED,
      method,
      estimateComplete,
      stockSlots,
      stockOptionCount,
      aggregatedPartCount,
      finiteOptionCount,
      variables,
      constraints,
      referenceFits,
      referenceExceeded: !referenceFits,
      hardExceeded: hardLimitProven || (estimateComplete && aboveHard),
      hardLimitProven: hardLimitProven || (estimateComplete && aboveHard)
    };
  }

  function unavailableProbe(status = ProbeStatus.NOT_RUN) {
    return {
      status,
      exact: false,
      referenceFits: false,
      referenceExceeded: false,
      hardExceeded: false
    };
  }

  function finiteRatio(value, reference) {
    const number = Number(value);
    const divisor = Number(reference);
    return Number.isFinite(number) && number >= 0 && Number.isFinite(divisor) && divisor > 0
      ? number / divisor
      : null;
  }

  function transformedGroupCost(rawScore, scoring) {
    const normalized = Math.max(0, Number(rawScore) || 0);
    const nonlinear = normalized <= 1
      ? normalized
      : normalized + ((normalized - 1) ** 2);
    return scoring.perGroupOverhead + nonlinear;
  }

  function complexityBandForCost(cost, scoring) {
    if (!Number.isFinite(cost)) return ComplexityBand.INVALID;
    if (cost < scoring.greenMaximumCost) return ComplexityBand.GREEN;
    if (cost < scoring.yellowMaximumCost) return ComplexityBand.YELLOW;
    return ComplexityBand.ORANGE;
  }

  function calculateGroupComplexity(canonicalLayoutProbe, arcFlowProbe, exactAssignmentEstimate, limits) {
    const candidates = [];
    if (canonicalLayoutProbe.exact && Number.isFinite(canonicalLayoutProbe.combinedLayoutCount)) {
      candidates.push({
        representation: "canonical-layouts",
        score: finiteRatio(canonicalLayoutProbe.combinedLayoutCount, limits.canonicalLayouts.reference)
      });
    }
    if (arcFlowProbe.exact && Number.isFinite(arcFlowProbe.stateCount) && Number.isFinite(arcFlowProbe.arcCount)) {
      candidates.push({
        representation: "arc-flow",
        score: Math.max(
          finiteRatio(arcFlowProbe.stateCount, limits.arcFlow.statesReference),
          finiteRatio(arcFlowProbe.arcCount, limits.arcFlow.arcsReference)
        )
      });
    }
    if (exactAssignmentEstimate.estimateComplete
      && Number.isFinite(exactAssignmentEstimate.stockSlots)
      && Number.isFinite(exactAssignmentEstimate.variables)
      && Number.isFinite(exactAssignmentEstimate.constraints)) {
      candidates.push({
        representation: "exact-assignment",
        score: Math.max(
          finiteRatio(exactAssignmentEstimate.stockSlots, limits.exactAssignment.stockSlotsReference),
          finiteRatio(exactAssignmentEstimate.variables, limits.exactAssignment.variablesReference),
          finiteRatio(exactAssignmentEstimate.constraints, limits.exactAssignment.constraintsReference)
        )
      });
    }

    const reliableCandidates = candidates.filter(candidate => Number.isFinite(candidate.score));
    reliableCandidates.sort((left, right) => left.score - right.score);
    const selected = reliableCandidates[0] || null;
    const rawScore = selected?.score ?? limits.complexityScoring.uncertainFallbackRawScore;
    const cost = transformedGroupCost(rawScore, limits.complexityScoring);
    return {
      rawScore,
      cost,
      band: complexityBandForCost(cost, limits.complexityScoring),
      selectedRepresentation: selected?.representation || "uncertain-fallback",
      reliable: Boolean(selected),
      candidateScores: reliableCandidates
    };
  }

  function batchComplexitySummary(results, limits) {
    const scoredGroups = results.filter(result => result.decision !== Decision.BLOCK && Number.isFinite(result?.complexity?.cost));
    const totalCost = scoredGroups.reduce((sum, result) => sum + result.complexity.cost, 0);
    const budget = limits.complexityScoring.batchBudget;
    return {
      totalCost,
      budget,
      blocked: false,
      exceeded: totalCost > budget,
      scoredGroupCount: scoredGroups.length,
      reasonCodes: totalCost > budget ? [ReasonCode.BATCH_COMPLEXITY_LIMIT] : []
    };
  }

  function complexityResultList(complexityResults) {
    if (complexityResults instanceof Map) return [...complexityResults.values()];
    if (Array.isArray(complexityResults)) return complexityResults;
    if (complexityResults && typeof complexityResults === "object") return Object.values(complexityResults);
    return [];
  }

  function createSolveContext(groups, complexityResults, options = {}) {
    const limits = resolveLimits(options.limits);
    const requestedGroups = Array.isArray(groups) ? groups : [];
    const resultById = new Map(
      complexityResultList(complexityResults)
        .filter(result => String(result?.groupId || ""))
        .map(result => [String(result.groupId), result])
    );
    const perGroup = {};
    let totalComplexityCost = 0;
    let complete = true;
    let reliable = true;

    requestedGroups.forEach(group => {
      const groupId = String(group?.groupId || "");
      const result = resultById.get(groupId);
      const complexity = result?.complexity || null;
      const cost = Number(complexity?.cost);
      const hasCost = Number.isFinite(cost) && cost >= 0;
      if (!hasCost) complete = false;
      else totalComplexityCost += cost;
      if (!hasCost || complexity?.reliable !== true) reliable = false;
      if (groupId) {
        perGroup[groupId] = {
          cost: hasCost ? cost : null,
          rawScore: Number.isFinite(Number(complexity?.rawScore)) ? Number(complexity.rawScore) : null,
          band: String(complexity?.band || "") || null,
          selectedRepresentation: String(complexity?.selectedRepresentation || "") || null,
          reliable: complexity?.reliable === true
        };
      }
    });

    const groupCount = requestedGroups.length;
    const perGroupOverhead = limits.complexityScoring.perGroupOverhead;
    const batchComplexityCost = complete ? totalComplexityCost : null;
    // complexity.cost already includes the configured per-group overhead, so the
    // summed cost is also the deterministic backend-pressure estimate.
    const batchPressureScore = batchComplexityCost;

    return {
      backendRequestedGroupCount: groupCount,
      batchComplexityCost,
      batchPressureScore,
      complexityReliable: complete && reliable,
      complexityComplete: complete,
      perGroupOverhead,
      groupOverheadCost: groupCount * perGroupOverhead,
      perGroup
    };
  }

  function completeComplexityScreen(prepared, limits, batchDeadline) {
    const budget = createWorkBudget(limits, batchDeadline);
    const canonicalLayoutProbe = runCanonicalProbe(prepared, limits, budget);
    let arcFlowProbe = unavailableProbe();
    if (canonicalLayoutProbe.referenceExceeded && !budget.exhausted()) {
      arcFlowProbe = runArcFlowProbe(prepared, limits, budget);
    } else if (canonicalLayoutProbe.status === ProbeStatus.WORK_BUDGET_REACHED) {
      arcFlowProbe = unavailableProbe(ProbeStatus.WORK_BUDGET_REACHED);
    }
    const exactAssignmentEstimate = estimateExactAssignment(prepared, limits, budget);
    const complexity = calculateGroupComplexity(
      canonicalLayoutProbe,
      arcFlowProbe,
      exactAssignmentEstimate,
      limits
    );

    const representations = [canonicalLayoutProbe, arcFlowProbe, exactAssignmentEstimate];
    const referenceFits = representations.some(result => result.referenceFits);
    const conclusiveReferenceExceeded = representations.some(result => result.referenceExceeded && result.status !== ProbeStatus.WORK_BUDGET_REACHED);
    const uncertain = representations.some(result => result.status === ProbeStatus.WORK_BUDGET_REACHED);
    const estimatesDisagree = referenceFits && conclusiveReferenceExceeded;
    const complexityBlocked = canonicalLayoutProbe.hardExceeded
      && arcFlowProbe.hardExceeded
      && exactAssignmentEstimate.hardExceeded;

    const reasonCodes = [];
    let decision = Decision.ALLOW;
    if (complexityBlocked) {
      decision = Decision.WARNING;
      reasonCodes.push(ReasonCode.COMPLEXITY_HARD_LIMIT);
    } else if (uncertain || estimatesDisagree || !referenceFits || conclusiveReferenceExceeded) {
      decision = Decision.WARNING;
      if (uncertain) reasonCodes.push(ReasonCode.COMPLEXITY_UNCERTAIN);
      if (estimatesDisagree) reasonCodes.push(ReasonCode.COMPLEXITY_ESTIMATES_DISAGREE);
      if (!referenceFits || conclusiveReferenceExceeded) reasonCodes.push(ReasonCode.COMPLEXITY_PREFERRED_LIMIT);
    }

    return {
      ...groupIdentity(prepared),
      decision,
      reasonCodes: [...new Set(reasonCodes)],
      complexity,
      measurements: {
        ...prepared.measurements,
        canonicalLayoutProbe,
        arcFlowProbe,
        exactAssignmentEstimate,
        preflightOperations: budget.operations,
        preflightElapsedMilliseconds: budget.elapsedMilliseconds
      }
    };
  }

  async function screenBatch(groups, cuttingSettings, options = {}) {
    const limits = resolveLimits(options.limits);
    const batchStartedAt = currentTime();
    const requestedGroups = Array.isArray(groups) ? groups : [];
    const batchSafety = {
      groupCount: requestedGroups.length,
      maxNestingGroups: limits.maxNestingGroups,
      blocked: requestedGroups.length > limits.maxNestingGroups,
      reasonCodes: requestedGroups.length > limits.maxNestingGroups ? [ReasonCode.TOO_MANY_GROUPS] : []
    };
    if (batchSafety.blocked) {
      return {
        decision: Decision.BLOCK,
        results: [],
        blockedGroups: [],
        warningGroups: [],
        batchComplexity: batchComplexitySummary([], limits),
        batchSafety,
        limits,
        elapsedMilliseconds: Math.max(0, currentTime() - batchStartedAt)
      };
    }

    const batchDeadline = batchStartedAt + limits.work.maximumMillisecondsPerBatch;
    const preparedGroups = [];
    const results = [];

    for (const group of requestedGroups) {
      const prepared = prepareGroup(group, cuttingSettings);
      if (prepared.result) results.push(prepared.result);
      else preparedGroups.push(prepared.prepared);
    }

    for (let index = 0; index < preparedGroups.length; index++) {
      const prepared = preparedGroups[index];
      if (currentTime() > batchDeadline) {
        const canonicalLayoutProbe = unavailableProbe(ProbeStatus.WORK_BUDGET_REACHED);
        const arcFlowProbe = unavailableProbe(ProbeStatus.WORK_BUDGET_REACHED);
        const exactAssignmentEstimate = unavailableProbe(ProbeStatus.WORK_BUDGET_REACHED);
        results.push({
          ...groupIdentity(prepared),
          decision: Decision.WARNING,
          reasonCodes: [ReasonCode.COMPLEXITY_UNCERTAIN],
          complexity: calculateGroupComplexity(
            canonicalLayoutProbe,
            arcFlowProbe,
            exactAssignmentEstimate,
            limits
          ),
          measurements: {
            ...prepared.measurements,
            canonicalLayoutProbe,
            arcFlowProbe,
            exactAssignmentEstimate
          }
        });
      } else {
        results.push(completeComplexityScreen(prepared, limits, batchDeadline));
      }
      if (index + 1 < preparedGroups.length) await new Promise(resolve => setTimeout(resolve, 0));
    }

    const order = new Map(requestedGroups.map((group, index) => [String(group?.groupId || ""), index]));
    results.sort((left, right) => (order.get(left.groupId) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.groupId) ?? Number.MAX_SAFE_INTEGER));
    const blockedGroups = results.filter(result => result.decision === Decision.BLOCK);
    const warningGroups = results.filter(result => result.decision === Decision.WARNING);
    const batchComplexity = batchComplexitySummary(results, limits);
    return {
      decision: blockedGroups.length
        ? Decision.BLOCK
        : warningGroups.length
          ? Decision.WARNING
          : Decision.ALLOW,
      results,
      blockedGroups,
      warningGroups,
      batchComplexity,
      batchSafety,
      limits,
      elapsedMilliseconds: Math.max(0, currentTime() - batchStartedAt)
    };
  }

  globalThis.NcNestingSolvePreflight = Object.freeze({
    screenBatch,
    createSolveContext,
    decisions: Decision,
    reasonCodes: ReasonCode,
    complexityBands: ComplexityBand,
    validationCategories: ValidationCategory,
    probeStatuses: ProbeStatus,
    defaultLimits: globalThis.NcNestingConfig?.solvePreflightLimits || null
  });
})();
