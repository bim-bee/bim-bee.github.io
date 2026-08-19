(function () {
  "use strict";

  const OBJECTIVE_FIELDS = Object.freeze([
    Object.freeze({ key: "orderedStockQuantity", direction: "min" }),
    Object.freeze({ key: "totalStockLengthConsumed", direction: "min" }),
    Object.freeze({ key: "reusableOffcutLength", direction: "max" }),
    Object.freeze({ key: "reusableOffcutCount", direction: "min" })
  ]);
  const METHODOLOGY_LABELS = Object.freeze([
    "הפתרון החמדני הראשוני",
    "הניסיון החמדני הראשוני",
    "הפתרון החמדני",
    "פתרון חמדני",
    "אלגוריתם חמדן",
    "אלגוריתם חמדני",
    "initial greedy solution",
    "initial greedy attempt",
    "greedy solution",
    "greedy baseline",
    "greedy algorithm"
  ]);

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function methodologyLinkedHtml(text, options = {}) {
    const source = String(text ?? "");
    const fixedMeasurements = [];
    const measurementTokenPrefix = "__NC_OPT_MEASUREMENT_";

    // Deliberately take Hebrew bidi reordering out of this one UI path.
    // The optimization messages are the only place where a mixed number + metre
    // value was still visually reversing. Replace it with a fixed inline token,
    // then materialize that token as an explicit number-first inline-flex span.
    const sourceWithMeasurementTokens = source.replace(
      /(?:\u2066)?\s*(?:מ׳\s*([0-9][0-9.,]*)|([0-9][0-9.,]*)\s*מ׳)\s*(?:\u2069)?/g,
      (match, unitFirstValue, valueFirstValue) => {
        const value = unitFirstValue || valueFirstValue;
        const token = `${measurementTokenPrefix}${fixedMeasurements.length}__`;
        fixedMeasurements.push({ value, unit: "מ׳" });
        return token;
      }
    );

    const methodologyUrl = String(options?.href || globalThis.NcNestingConfig?.methodologyUrl || "").trim();
    const escapedLabels = METHODOLOGY_LABELS
      .slice()
      .sort((left, right) => right.length - left.length)
      .map(label => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const matcher = new RegExp(`(${escapedLabels.join("|")})`, "gi");

    let html = sourceWithMeasurementTokens.split(matcher).map(part => {
      const isMethodologyLabel = METHODOLOGY_LABELS.some(label => label.toLocaleLowerCase() === part.toLocaleLowerCase());
      if (!isMethodologyLabel || !methodologyUrl) return escapeHtml(part);
      const label = escapeHtml(part);
      const forceNewTab = options?.forceNewTab ? ' data-nc-force-new-tab="true"' : '';
      return `<a class="greedy-algorithm-link" href="${escapeHtml(methodologyUrl)}" target="_blank" rel="noopener noreferrer"${forceNewTab} title="${label}">${label}</a>`;
    }).join("");

    fixedMeasurements.forEach(({ value, unit }, index) => {
      const token = `${measurementTokenPrefix}${index}__`;
      // Keep this atomic and inline even inside the batch table's broad
      // `.profile span { display: block; }` rule. The explicit row-reverse
      // matches the site's established Hebrew `.measurement` presentation.
      const measurementHtml = `<span class="measurement optimization-comparison-measurement" dir="ltr" style="display:inline-flex;flex-direction:row-reverse;align-items:baseline;gap:.25em;direction:ltr;unicode-bidi:isolate;white-space:nowrap;width:auto;vertical-align:baseline"><span class="measurement-value" dir="ltr" style="display:inline;direction:ltr;unicode-bidi:isolate;white-space:nowrap">${escapeHtml(value)}</span><span class="measurement-unit" dir="rtl" lang="he" style="display:inline;unicode-bidi:isolate;white-space:nowrap">${escapeHtml(unit)}</span></span>`;
      html = html.replace(token, measurementHtml);
    });

    return html;
  }

  function numberOrNull(value) {
    if (value == null || (typeof value === "string" && !value.trim())) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function firstNumber(source, keys) {
    for (const key of keys) {
      const value = numberOrNull(source?.[key]);
      if (value != null) return value;
    }
    return null;
  }

  function normalizeObjective(source) {
    if (!source || typeof source !== "object") return null;
    const objective = {
      orderedStockQuantity: firstNumber(source, [
        "orderedStockQuantity",
        "stockOrderQuantity",
        "stockOrderPieceCount",
        "regularStockQuantity",
        "regularStockPieceCount"
      ]),
      totalStockLengthConsumed: firstNumber(source, [
        "totalStockLengthConsumed",
        "totalStockLength",
        "stockLengthConsumed"
      ]),
      reusableOffcutLength: firstNumber(source, [
        "reusableOffcutLength",
        "totalReusableOffcutLength"
      ]),
      reusableOffcutCount: firstNumber(source, [
        "reusableOffcutCount",
        "totalReusableOffcutCount"
      ])
    };
    return Object.values(objective).some(value => value != null) ? objective : null;
  }

  function normalizeStatus(value) {
    const raw = String(value || "").replace(/[\s_-]/g, "").toLowerCase();
    if (raw === "optimal") return "Optimal";
    if (raw === "bestknown" || raw === "feasible" || raw === "timelimit" || raw === "worklimit") return "BestKnown";
    if (raw === "failed" || raw === "infeasible" || raw === "nousableplan") return "Failed";
    return null;
  }

  function normalizeStopReason(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    return text.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").toLowerCase();
  }


  function stoppedAtCalculationLimit(stopReason) {
    const normalized = normalizeStopReason(stopReason);
    if (!normalized) return false;
    return /(time|timeout|batch|budget|effort|work|calculation)/.test(normalized);
  }

  function integerOrNull(value) {
    const number = numberOrNull(value);
    return Number.isInteger(number) && number >= 0 ? number : null;
  }

  function normalizedObjectiveProgress(root, source) {
    const raw = root?.objectiveProgress
      || root?.lexicographicObjectiveProgress
      || source?.objectiveProgress
      || source?.lexicographicObjectiveProgress
      || null;
    if (!raw || typeof raw !== "object") return null;
    return Array.isArray(raw) ? raw.map(item => ({ ...item })) : { ...raw };
  }

  function provenObjectiveCount(root, source, objectiveProgress) {
    const explicit = integerOrNull(
      root?.provenObjectiveCount
      ?? root?.objectivesProven
      ?? root?.numberOfObjectivesProven
      ?? source?.provenObjectiveCount
      ?? source?.objectivesProven
    );
    if (explicit != null) return Math.min(OBJECTIVE_FIELDS.length, explicit);
    if (Array.isArray(root?.provenObjectives)) return Math.min(OBJECTIVE_FIELDS.length, root.provenObjectives.length);
    if (Array.isArray(objectiveProgress)) {
      let count = 0;
      for (const item of objectiveProgress) {
        const proven = item?.proven === true || String(item?.status || "").toLowerCase() === "proven";
        if (!proven) break;
        count++;
      }
      return count;
    }
    if (objectiveProgress && typeof objectiveProgress === "object") {
      let count = 0;
      for (const field of OBJECTIVE_FIELDS) {
        const item = objectiveProgress[field.key];
        const proven = item?.proven === true || item === true || String(item?.status || item || "").toLowerCase() === "proven";
        if (!proven) break;
        count++;
      }
      if (count || OBJECTIVE_FIELDS.some(field => Object.prototype.hasOwnProperty.call(objectiveProgress, field.key))) return count;
    }
    return null;
  }

  function readOptimization(source) {
    if (!source || typeof source !== "object") return null;
    const root = source.optimization || source.optimizationResult || source.optimizationMetadata || {};
    const status = normalizeStatus(root.status || source.optimizationStatus || source.solverStatus || source.status);
    const bestFeasibleObjective = normalizeObjective(
      root.bestFeasibleObjective
      || root.feasibleObjective
      || root.objective
      || source.bestFeasibleObjective
      || source.objective
      || source.totals
      || source
    );
    const bestProvenBound = normalizeObjective(
      root.bestProvenBound
      || root.provenBound
      || root.boundObjective
      || source.bestProvenBound
      || source.provenBound
    );
    const explicitOptimum = normalizeObjective(root.provenOptimum || root.optimum || source.provenOptimum);
    const provenOptimum = explicitOptimum || (status === "Optimal" ? (bestProvenBound || bestFeasibleObjective) : null);
    const objectiveProgress = normalizedObjectiveProgress(root, source);
    const provenObjectives = provenObjectiveCount(root, source, objectiveProgress);
    const stopReason = normalizeStopReason(
      root.stopReason
      || root.terminationReason
      || root.optimizationStopReason
      || source.stopReason
      || source.terminationReason
    );

    if (!status && !bestFeasibleObjective && !bestProvenBound && !provenOptimum && !stopReason && provenObjectives == null) return null;
    return {
      status,
      bestFeasibleObjective,
      bestProvenBound,
      provenOptimum,
      stopReason,
      provenObjectiveCount: provenObjectives,
      objectiveProgress
    };
  }

  function compare(left, right) {
    const normalizedLeft = normalizeObjective(left);
    const normalizedRight = normalizeObjective(right);
    if (!normalizedLeft || !normalizedRight) return null;
    for (const field of OBJECTIVE_FIELDS) {
      const a = normalizedLeft[field.key];
      const b = normalizedRight[field.key];
      if (a == null || b == null) return null;
      if (a === b) continue;
      const leftBetter = field.direction === "min" ? a < b : a > b;
      return leftBetter ? -1 : 1;
    }
    return 0;
  }

  function firstDifference(left, right) {
    const normalizedLeft = normalizeObjective(left);
    const normalizedRight = normalizeObjective(right);
    if (!normalizedLeft || !normalizedRight) return null;
    for (let index = 0; index < OBJECTIVE_FIELDS.length; index++) {
      const field = OBJECTIVE_FIELDS[index];
      const leftValue = normalizedLeft[field.key];
      const rightValue = normalizedRight[field.key];
      if (leftValue == null || rightValue == null) return null;
      if (leftValue === rightValue) continue;
      const leftBetter = field.direction === "min" ? leftValue < rightValue : leftValue > rightValue;
      return {
        index,
        key: field.key,
        direction: field.direction,
        leftValue,
        rightValue,
        leftBetter,
        delta: leftValue - rightValue
      };
    }
    return { index: -1, key: null, direction: null, leftValue: null, rightValue: null, leftBetter: false, delta: 0 };
  }

  function objectiveFromGreedy(greedyBaseline) {
    return normalizeObjective(greedyBaseline?.objective || greedyBaseline?.objectives || greedyBaseline);
  }

  function leadingEqualObjectiveCount(feasible, bound) {
    const normalizedFeasible = normalizeObjective(feasible);
    const normalizedBound = normalizeObjective(bound);
    if (!normalizedFeasible || !normalizedBound) return 0;
    let count = 0;
    for (const field of OBJECTIVE_FIELDS) {
      const feasibleValue = normalizedFeasible[field.key];
      const boundValue = normalizedBound[field.key];
      if (feasibleValue == null || boundValue == null || feasibleValue !== boundValue) break;
      count++;
    }
    return count;
  }

  function isGreedyOnlyResult(source) {
    const status = String(source?.status || "").replace(/[\s_-]/g, "").toLowerCase();
    const resultSource = String(source?.resultSource || "").replace(/[\s_-]/g, "").toLowerCase();
    return status === "greedyonly" || resultSource === "frontendgreedy";
  }

  function splitLeadingSentence(text) {
    const value = String(text || "").trim();
    if (!value) return { lead: "", continuation: "" };
    const match = value.match(/^(.+?[.!?])(\s+.+)$/u);
    if (!match) return { lead: value, continuation: "" };
    return {
      lead: match[1],
      continuation: match[2].trim()
    };
  }

  function resultMessage(source, greedyBaseline = source?.greedyBaseline, language) {
    const I18N = window.NCNestingI18n;
    const translate = (key, params = {}) => I18N?.t ? I18N.t(key, params, language) : key;
    const isolatedNumber = value => {
      const text = I18N?.formatNumber
        ? I18N.formatNumber(value, { maximumFractionDigits: 0 }, language)
        : String(Math.round(Number(value) || 0));
      return I18N?.isolate ? I18N.isolate(text) : text;
    };
    const isolatedLength = millimetres => {
      const metres = (Number(millimetres) || 0) / 1000;
      const text = I18N?.measurementText
        ? I18N.measurementText(metres, "m", { maximumFractionDigits: 2 }, language)
        : `${metres.toFixed(2)} m`;
      return I18N?.isolate ? I18N.isolate(text) : text;
    };

    if (isGreedyOnlyResult(source)) {
      return {
        status: "GreedyOnly",
        tone: "greedyonly",
        statusLabel: translate("optimization.greedyOnly"),
        headline: translate("optimization.message.greedyOnlyHeadline"),
        detail: translate("optimization.message.greedyOnlyDetail")
      };
    }

    const optimization = readOptimization(source);
    if (!optimization) return null;

    if (optimization.status === "Failed") {
      return {
        status: "Failed",
        tone: "failed",
        statusLabel: translate("optimization.failed"),
        headline: translate("optimization.message.failedHeadline"),
        detail: translate("optimization.message.failedDetail")
      };
    }

    const status = optimization.status;
    if (status !== "Optimal" && status !== "BestKnown") return null;

    const greedy = objectiveFromGreedy(greedyBaseline);
    const optimized = optimization.bestFeasibleObjective;
    const difference = greedy && optimized ? firstDifference(optimized, greedy) : null;
    const isOptimal = status === "Optimal";
    const headline = translate(isOptimal
      ? "optimization.message.optimalHeadline"
      : "optimization.message.bestKnownHeadline");

    let detailKey;
    let params = {};

    if (difference?.index === -1) {
      if (isOptimal) {
        detailKey = "optimization.message.optimalGreedyAlreadyBest";
      } else if (stoppedAtCalculationLimit(optimization.stopReason)) {
        detailKey = "optimization.message.bestKnownGreedyTime";
      } else {
        detailKey = "optimization.message.bestKnownGreedyStopped";
      }
    } else if (difference?.leftBetter) {
      const level = difference.index;
      const greedyValue = difference.rightValue;
      const optimizedValue = difference.leftValue;
      const prefix = isOptimal ? "optimization.message.optimalImproved" : "optimization.message.bestKnownImproved";

      if (level === 0) {
        const count = Math.max(0, Math.round(greedyValue - optimizedValue));
        params = { count: isolatedNumber(count) };
        detailKey = `${prefix}Ordered${count === 1 ? "One" : "Many"}`;
      } else if (level === 1) {
        params = { length: isolatedLength(greedyValue - optimizedValue) };
        detailKey = `${prefix}TotalLength`;
      } else if (level === 2) {
        params = { length: isolatedLength(optimizedValue - greedyValue) };
        detailKey = `${prefix}ReusableLength`;
      } else if (level === 3) {
        const count = Math.max(0, Math.round(greedyValue - optimizedValue));
        params = { count: isolatedNumber(count) };
        detailKey = `${prefix}ReusableCount${count === 1 ? "One" : "Many"}`;
      }
    }

    if (!detailKey) {
      detailKey = isOptimal
        ? "optimization.message.optimalGeneric"
        : (stoppedAtCalculationLimit(optimization.stopReason)
          ? "optimization.message.bestKnownGenericTime"
          : "optimization.message.bestKnownGeneric");
    }

    const detail = translate(detailKey, params);
    const detailParts = isOptimal ? splitLeadingSentence(detail) : { lead: detail, continuation: "" };

    return {
      status,
      tone: isOptimal ? "optimal" : "bestknown",
      statusLabel: translate(isOptimal ? "optimization.optimal" : "optimization.readyToUse"),
      headline,
      detail,
      detailLead: detailParts.lead,
      detailContinuation: detailParts.continuation,
      improvementIndex: difference?.leftBetter ? difference.index : null
    };
  }

  function optimizationOpportunity(source) {
    const optimization = readOptimization(source);
    if (!optimization) {
      return {
        status: null,
        fullOptimumProven: false,
        firstUnresolvedObjectiveIndex: null,
        primaryGap: null,
        hasExplicitUnresolvedEvidence: false,
        stopReason: null,
        provenObjectiveCount: null
      };
    }

    const fullOptimumProven = optimization.status === "Optimal"
      || Boolean(optimization.provenOptimum)
      || optimization.provenObjectiveCount === OBJECTIVE_FIELDS.length;
    const leadingEqual = leadingEqualObjectiveCount(optimization.bestFeasibleObjective, optimization.bestProvenBound);
    const provenCount = optimization.provenObjectiveCount != null
      ? optimization.provenObjectiveCount
      : leadingEqual;
    const firstUnresolvedObjectiveIndex = fullOptimumProven
      ? null
      : Math.min(OBJECTIVE_FIELDS.length - 1, Math.max(0, provenCount));

    const feasiblePrimary = optimization.bestFeasibleObjective?.orderedStockQuantity;
    const boundPrimary = optimization.bestProvenBound?.orderedStockQuantity;
    const primaryGap = Number.isFinite(feasiblePrimary) && Number.isFinite(boundPrimary)
      ? Math.max(0, feasiblePrimary - boundPrimary)
      : null;
    const objectiveDifference = firstDifference(optimization.bestFeasibleObjective, optimization.bestProvenBound);
    const hasObjectiveGap = Boolean(objectiveDifference && objectiveDifference.index >= 0);
    const explicitProgress = optimization.provenObjectiveCount != null || Boolean(optimization.objectiveProgress);
    const hasExplicitUnresolvedEvidence = optimization.status === "BestKnown" && !fullOptimumProven && (
      hasObjectiveGap
      || (optimization.provenObjectiveCount != null && optimization.provenObjectiveCount < OBJECTIVE_FIELDS.length)
      || explicitProgress
      || Boolean(optimization.stopReason)
    );

    return {
      status: optimization.status,
      fullOptimumProven,
      firstUnresolvedObjectiveIndex,
      primaryGap,
      objectiveGapIndex: hasObjectiveGap ? objectiveDifference.index : null,
      hasExplicitUnresolvedEvidence,
      stopReason: optimization.stopReason,
      provenObjectiveCount: optimization.provenObjectiveCount
    };
  }

  window.NcNestingOptimization = Object.freeze({
    OBJECTIVE_FIELDS,
    normalizeObjective,
    normalizeStatus,
    normalizeStopReason,
    readOptimization,
    compare,
    firstDifference,
    objectiveFromGreedy,
    optimizationOpportunity,
    stoppedAtCalculationLimit,
    resultMessage,
    isGreedyOnlyResult,
    methodologyLinkedHtml
  });
})();
