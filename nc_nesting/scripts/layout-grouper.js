(function () {
  "use strict";

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function percentage(value, total) {
    return Number.isFinite(value) && Number.isFinite(total) && total > 0 ? value / total * 100 : Number.NaN;
  }

  function clean(value) {
    return String(value ?? "").normalize("NFKC").trim();
  }

  function normalizedArea(value) {
    return clean(value).replace(/\s+/g, " ").toLocaleLowerCase();
  }

  function letterSuffix(sequence) {
    let value = Math.max(1, Math.trunc(Number(sequence) || 1));
    let suffix = "";
    while (value > 0) {
      value--;
      suffix = String.fromCharCode(65 + (value % 26)) + suffix;
      value = Math.floor(value / 26);
    }
    return suffix;
  }

  function normalizedSource(piece) {
    return piece?.stockSource === "StorageStock" ? "StorageStock" : "StockOrder";
  }

  function normalizedSegmentType(segment) {
    const raw = clean(segment?.type || segment?.segmentType).replace(/[\s_-]/g, "").toLowerCase();
    const aliases = {
      starttrim: "StartTrim",
      trimstart: "StartTrim",
      toolcut: "ToolCut",
      toolwidthcut: "ToolCut",
      kerf: "ToolCut",
      part: "Part",
      nestedpart: "Part",
      finishedpart: "Part",
      reusableoffcut: "ReusableOffcut",
      nonreusableoffcut: "NonReusableOffcut",
      scrapoffcut: "NonReusableOffcut",
      endtrim: "EndTrim",
      trimend: "EndTrim"
    };
    if (raw === "offcut") return segment?.isReusable ? "ReusableOffcut" : "NonReusableOffcut";
    return aliases[raw] || clean(segment?.type || segment?.segmentType);
  }

  function segmentSignature(segment) {
    const type = normalizedSegmentType(segment);
    return [
      type,
      finite(segment?.length),
      type === "Part" ? clean(segment?.partId || segment?.id || segment?.label) : ""
    ];
  }

  function physicalSignature(piece) {
    return JSON.stringify([
      finite(piece?.stockLength),
      (piece?.segments || piece?.layoutSegments || []).map(segmentSignature)
    ]);
  }

  function sourceIds(piece) {
    const values = normalizedSource(piece) === "StorageStock"
      ? [piece?.storageStockId, piece?.groupedStorageStockId, piece?.stockTypeId]
      : [piece?.stockOrderId, piece?.stockTypeId];
    return [...new Set(values.map(clean).filter(Boolean))];
  }

  function partCounts(piece) {
    const counts = {};
    const parts = Array.isArray(piece?.parts)
      ? piece.parts
      : (piece?.segments || []).filter(segment => normalizedSegmentType(segment) === "Part");
    parts.forEach(part => {
      const partId = clean(part?.partId || part?.id || part?.label);
      if (partId) counts[partId] = (counts[partId] || 0) + 1;
    });
    return counts;
  }

  function mergeIds(target, values) {
    values.forEach(value => target.add(value));
  }

  function groupPieces(inputPieces) {
    const map = new Map();

    (inputPieces || []).forEach((piece, originalIndex) => {
      const stockSource = normalizedSource(piece);
      const area = stockSource === "StorageStock" ? clean(piece?.storageArea) : "";
      const areaKey = stockSource === "StorageStock" ? normalizedArea(area) : "";
      const signature = physicalSignature(piece);
      const key = JSON.stringify([stockSource, areaKey, signature]);

      if (!map.has(key)) {
        map.set(key, {
          key,
          signature,
          stockSource,
          storageArea: area,
          storageAreaKey: areaKey,
          stockLength: finite(piece?.stockLength),
          segments: piece?.segments || piece?.layoutSegments || [],
          piece,
          pieces: [],
          quantity: 0,
          counts: partCounts(piece),
          partLength: finite(piece?.partLength),
          cutLength: finite(piece?.cutLength),
          consumed: finite(piece?.consumed),
          offcut: finite(piece?.offcut),
          reusable: Boolean(piece?.reusable),
          partUtilization: globalThis.NcNestingUtilization.optimisticPercentage(
            finite(piece?.partLength),
            finite(piece?.offcut)
          ),
          processUtilization: Number.isFinite(Number(piece?.processUtilization))
            ? Number(piece.processUtilization)
            : percentage(finite(piece?.consumed), finite(piece?.stockLength)),
          sourceIdsSet: new Set(),
          storageRecordIdsSet: new Set(),
          stockOrderIdsSet: new Set(),
          firstIndex: originalIndex
        });
      }

      const group = map.get(key);
      group.pieces.push(piece);
      group.quantity++;
      mergeIds(group.sourceIdsSet, sourceIds(piece));
      if (stockSource === "StorageStock") {
        mergeIds(group.storageRecordIdsSet, [
          clean(piece?.storageStockId),
          clean(piece?.groupedStorageStockId)
        ].filter(Boolean));
      } else {
        mergeIds(group.stockOrderIdsSet, [clean(piece?.stockOrderId || piece?.stockTypeId)].filter(Boolean));
      }
      if (!group.storageArea && area) group.storageArea = area;
    });

    const layouts = [...map.values()].sort((left, right) => {
      const sourceOrder = (left.stockSource === "StorageStock" ? 0 : 1) - (right.stockSource === "StorageStock" ? 0 : 1);
      if (sourceOrder) return sourceOrder;
      const offcutOrder = right.offcut - left.offcut;
      if (offcutOrder) return offcutOrder;
      if (left.stockSource === "StorageStock") {
        const areaOrder = left.storageAreaKey.localeCompare(right.storageAreaKey, undefined, { sensitivity: "base", numeric: true });
        if (areaOrder) return areaOrder;
      }
      const lengthOrder = right.stockLength - left.stockLength;
      if (lengthOrder) return lengthOrder;
      const signatureOrder = left.signature.localeCompare(right.signature, undefined, { numeric: true });
      return signatureOrder || left.firstIndex - right.firstIndex;
    });

    let storageSequence = 0;
    let orderSequence = 0;
    layouts.forEach(layout => {
      const sequence = layout.stockSource === "StorageStock" ? ++storageSequence : ++orderSequence;
      layout.layoutName = `${layout.stockSource === "StorageStock" ? "Storage" : "Order"}-${letterSuffix(sequence)}`;
      layout.sourceIds = [...layout.sourceIdsSet];
      layout.storageRecordIds = [...layout.storageRecordIdsSet];
      layout.stockOrderIds = [...layout.stockOrderIdsSet];
      delete layout.sourceIdsSet;
      delete layout.storageRecordIdsSet;
      delete layout.stockOrderIdsSet;
    });

    return layouts;
  }

  function recordIds(record, stockSource) {
    const values = stockSource === "StorageStock"
      ? [record?.storageStockId, record?.groupedStorageStockId, record?.stockTypeId]
      : [record?.stockOrderId, record?.stockTypeId];
    return [...new Set(values.map(clean).filter(Boolean))];
  }

  function layoutsForRecord(layouts, record, stockSource) {
    const ids = recordIds(record, stockSource).map(value => value.toLocaleLowerCase());
    const targetLength = Number(record?.stockLength ?? record?.length);
    const sourceLayouts = (layouts || []).filter(layout => layout.stockSource === stockSource);
    if (ids.length) {
      const idMatches = sourceLayouts.filter(layout => {
        const layoutIds = layout.sourceIds.map(value => value.toLocaleLowerCase());
        return layoutIds.length && ids.some(id => layoutIds.includes(id));
      });
      if (idMatches.length) return idMatches;
    }
    return Number.isFinite(targetLength)
      ? sourceLayouts.filter(layout => layout.stockLength === targetLength)
      : [];
  }

  function aggregateUsage(layouts) {
    const totals = (layouts || []).reduce((result, layout) => {
      const quantity = Math.max(0, Math.trunc(finite(layout?.quantity)));
      result.quantity += quantity;
      result.totalStockLength += finite(layout?.stockLength) * quantity;
      result.totalConsumedLength += finite(layout?.consumed) * quantity;
      result.totalPartLength += finite(layout?.partLength) * quantity;
      result.totalOffcutLength += finite(layout?.offcut) * quantity;
      return result;
    }, {
      quantity: 0,
      totalStockLength: 0,
      totalConsumedLength: 0,
      totalPartLength: 0,
      totalOffcutLength: 0
    });
    totals.utilizationPercentage = globalThis.NcNestingUtilization.optimisticPercentage(
      totals.totalPartLength,
      totals.totalOffcutLength
    );
    totals.partUtilizationPercentage = totals.utilizationPercentage;
    return totals;
  }

  function usageForRecord(layouts, record, stockSource) {
    const matched = layoutsForRecord(layouts, record, stockSource);
    return { matched, ...aggregateUsage(matched) };
  }

  function displayedUtilization(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 10) / 10 : Number.NaN;
  }

  function aggregateWasteRows(layouts) {
    const groups = new Map();

    (layouts || []).forEach((layout, index) => {
      const stockSource = normalizedSource(layout);
      const storageArea = stockSource === "StorageStock" ? clean(layout?.storageArea) : "";
      const utilization = displayedUtilization(layout?.partUtilization);
      const stockLength = finite(layout?.stockLength);
      const offcut = finite(layout?.offcut);
      const reusable = Boolean(layout?.reusable);
      const key = JSON.stringify([
        stockSource,
        stockSource === "StorageStock" ? normalizedArea(storageArea) : "",
        stockLength,
        Number.isFinite(utilization) ? utilization.toFixed(1) : "",
        offcut,
        reusable
      ]);

      if (!groups.has(key)) {
        groups.set(key, {
          stockSource,
          storageArea,
          stockLength,
          utilization,
          offcut,
          reusable,
          layoutNames: [],
          quantity: 0,
          firstIndex: index
        });
      }

      const group = groups.get(key);
      const layoutName = clean(layout?.layoutName);
      if (layoutName) group.layoutNames.push(layoutName);
      group.quantity += Math.max(0, Math.trunc(finite(layout?.quantity)));
      if (!group.storageArea && storageArea) group.storageArea = storageArea;
    });

    return [...groups.values()]
      .sort((left, right) => left.firstIndex - right.firstIndex)
      .map(({ firstIndex, ...row }) => row);
  }

  window.NcNestingLayouts = Object.freeze({
    groupPieces,
    layoutsForRecord,
    recordIds,
    normalizedArea,
    physicalSignature,
    letterSuffix,
    aggregateUsage,
    usageForRecord,
    aggregateWasteRows
  });
})();
