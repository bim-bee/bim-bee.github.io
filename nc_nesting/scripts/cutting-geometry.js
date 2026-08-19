(function () {
  "use strict";

  function integer(value, minimum = 0) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= minimum ? number : null;
  }

  function normalizeSettings(settings) {
    const toolWidth = integer(settings?.toolWidth);
    const trimStart = integer(settings?.trimStart);
    const trimEnd = integer(settings?.trimEnd);
    const reusableMinimumLength = integer(settings?.reusableMinimumLength);
    if ([toolWidth, trimStart, trimEnd, reusableMinimumLength].some(value => value == null)) return null;
    return { toolWidth, trimStart, trimEnd, reusableMinimumLength };
  }

  function effectiveItemSize(partLength, toolWidth) {
    const length = integer(partLength, 1);
    const kerf = integer(toolWidth);
    if (length == null || kerf == null) return null;
    const result = length + kerf;
    return Number.isSafeInteger(result) ? result : null;
  }

  function effectiveFitCapacity(stockLength, settings) {
    const normalized = normalizeSettings(settings);
    const length = integer(stockLength, 1);
    if (!normalized || length == null) return null;
    const result = length - normalized.trimStart - normalized.trimEnd + normalized.toolWidth;
    return Number.isSafeInteger(result) ? result : null;
  }

  function netOffcutFromRaw(rawRemainder, toolWidth) {
    const raw = integer(rawRemainder);
    const kerf = integer(toolWidth);
    if (raw == null || kerf == null) return null;
    return Math.max(0, raw - kerf);
  }

  function measureLayout(stockLength, totalPartLength, partCount, settings) {
    const normalized = normalizeSettings(settings);
    const length = integer(stockLength, 1);
    const finishedPartLength = integer(totalPartLength);
    const count = integer(partCount, 1);
    if (!normalized || length == null || finishedPartLength == null || count == null) return null;

    const internalKerfCount = count - 1;
    const internalKerfLength = internalKerfCount * normalized.toolWidth;
    const fitRequirement = normalized.trimStart + normalized.trimEnd + finishedPartLength + internalKerfLength;
    if (![internalKerfLength, fitRequirement].every(Number.isSafeInteger)) return null;

    const rawRemainder = length - fitRequirement;
    if (!Number.isSafeInteger(rawRemainder)) return null;
    const fits = rawRemainder >= 0;
    if (!fits) {
      return {
        ...normalized,
        stockLength: length,
        partCount: count,
        finishedPartLength,
        internalKerfCount,
        internalKerfLength,
        fitRequirement,
        fits,
        rawRemainder,
        terminalKerfCharge: null,
        netOffcut: null,
        actualConsumedLength: null,
        totalToolCutLength: null,
        reusable: false
      };
    }

    const terminalKerfCharge = Math.min(normalized.toolWidth, rawRemainder);
    const netOffcut = rawRemainder - terminalKerfCharge;
    const actualConsumedLength = length - netOffcut;
    const totalToolCutLength = internalKerfLength + terminalKerfCharge;
    const reusable = netOffcut > 0 && netOffcut >= normalized.reusableMinimumLength;

    return {
      ...normalized,
      stockLength: length,
      partCount: count,
      finishedPartLength,
      internalKerfCount,
      internalKerfLength,
      fitRequirement,
      fits,
      rawRemainder,
      terminalKerfCharge,
      netOffcut,
      actualConsumedLength,
      totalToolCutLength,
      reusable
    };
  }

  function buildSegments(partSegments, stockLength, settings) {
    const parts = Array.isArray(partSegments) ? partSegments : [];
    const totalPartLength = parts.reduce((total, part) => {
      const length = integer(part?.length, 1);
      return length == null || total == null ? null : total + length;
    }, 0);
    if (!parts.length || totalPartLength == null || !Number.isSafeInteger(totalPartLength)) return null;

    const measurement = measureLayout(stockLength, totalPartLength, parts.length, settings);
    if (!measurement?.fits) return null;

    const segments = [{ type: "StartTrim", length: measurement.trimStart }];
    parts.forEach((part, index) => {
      segments.push({ ...part, type: "Part", length: integer(part.length, 1) });
      if (index < parts.length - 1) segments.push({ type: "ToolCut", length: measurement.toolWidth });
    });
    segments.push(
      { type: "ToolCut", length: measurement.terminalKerfCharge },
      { type: measurement.reusable ? "ReusableOffcut" : "NonReusableOffcut", length: measurement.netOffcut },
      { type: "EndTrim", length: measurement.trimEnd }
    );
    return { measurement, segments };
  }

  window.NcNestingCuttingGeometry = Object.freeze({
    normalizeSettings,
    effectiveItemSize,
    effectiveFitCapacity,
    netOffcutFromRaw,
    measureLayout,
    buildSegments
  });
})();
