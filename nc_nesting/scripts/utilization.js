(function initNcNestingUtilization() {
  "use strict";

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizedSegmentType(segment) {
    const raw = String(segment?.type || segment?.segmentType || "")
      .replace(/[\s_-]/g, "")
      .toLowerCase();
    return ["part", "nestedpart", "finishedpart"].includes(raw) ? "Part" : raw;
  }

  function optimisticPercentage(partLength, remainingWasteLength) {
    const parts = Math.max(0, finite(partLength));
    const waste = Math.max(0, finite(remainingWasteLength));
    const denominator = parts + waste;
    return denominator > 0 ? parts / denominator * 100 : Number.NaN;
  }

  function optimisticWastePercentage(partLength, remainingWasteLength) {
    const parts = Math.max(0, finite(partLength));
    const waste = Math.max(0, finite(remainingWasteLength));
    const denominator = parts + waste;
    return denominator > 0 ? waste / denominator * 100 : Number.NaN;
  }

  function totalPartLengthFromSegments(segments) {
    return (Array.isArray(segments) ? segments : []).reduce((total, segment) => (
      normalizedSegmentType(segment) === "Part"
        ? total + Math.max(0, finite(segment?.length))
        : total
    ), 0);
  }

  function totalPartLengthFromPlan(plan) {
    const explicit = Number(plan?.totals?.totalPartLength ?? plan?.totalPartLength);
    if (Number.isFinite(explicit) && explicit >= 0) return explicit;

    const requested = Array.isArray(plan?.requestedParts) ? plan.requestedParts : [];
    if (requested.length) {
      const total = requested.reduce((sum, part) => {
        const length = Math.max(0, finite(part?.length));
        const quantity = Math.max(0, Math.trunc(finite(part?.requestedQuantity ?? part?.quantity)));
        return sum + length * quantity;
      }, 0);
      if (total > 0) return total;
    }

    return (Array.isArray(plan?.stockPieces) ? plan.stockPieces : []).reduce((total, piece) => (
      total + totalPartLengthFromSegments(piece?.segments || piece?.layoutSegments)
    ), 0);
  }

  globalThis.NcNestingUtilization = Object.freeze({
    optimisticPercentage,
    optimisticWastePercentage,
    totalPartLengthFromSegments,
    totalPartLengthFromPlan
  });
})();
