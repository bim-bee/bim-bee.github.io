(function () {
  "use strict";

  const pageParams = new URLSearchParams(location.search);
  const batchId = pageParams.get("batchId");
  const groupId = pageParams.get("groupId");
  const fmt = value => new Intl.NumberFormat().format(value);
  const SEGMENT = Object.freeze({
    START_TRIM: "StartTrim",
    TOOL_CUT: "ToolCut",
    PART: "Part",
    REUSABLE_OFFCUT: "ReusableOffcut",
    NON_REUSABLE_OFFCUT: "NonReusableOffcut",
    END_TRIM: "EndTrim"
  });

  let data;
  let pieces = [];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function realNumber(value) {
    if (value == null || (typeof value === "string" && !value.trim())) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function finiteNumber(value, fallback = 0) {
    const number = realNumber(value);
    return number == null ? fallback : number;
  }

  function normalizeSegmentType(segment) {
    const raw = String(segment.type || segment.segmentType || "").replace(/[\s_-]/g, "").toLowerCase();
    const aliases = {
      starttrim: SEGMENT.START_TRIM,
      trimstart: SEGMENT.START_TRIM,
      toolcut: SEGMENT.TOOL_CUT,
      toolwidthcut: SEGMENT.TOOL_CUT,
      kerf: SEGMENT.TOOL_CUT,
      part: SEGMENT.PART,
      nestedpart: SEGMENT.PART,
      finishedpart: SEGMENT.PART,
      reusableoffcut: SEGMENT.REUSABLE_OFFCUT,
      nonreusableoffcut: SEGMENT.NON_REUSABLE_OFFCUT,
      scrapoffcut: SEGMENT.NON_REUSABLE_OFFCUT,
      endtrim: SEGMENT.END_TRIM,
      trimend: SEGMENT.END_TRIM
    };
    if (raw === "offcut") return segment.isReusable ? SEGMENT.REUSABLE_OFFCUT : SEGMENT.NON_REUSABLE_OFFCUT;
    return aliases[raw] || segment.type || segment.segmentType;
  }

  function normalizeSegment(segment) {
    return {
      ...segment,
      type: normalizeSegmentType(segment),
      length: finiteNumber(segment.length),
      partId: segment.partId || segment.id || segment.label || null
    };
  }

  function normalizePlan(source) {
    const plan = structuredClone(source);
    plan.settings = { unit: "mm", ...(plan.settings || {}) };
    plan.projectName = String(plan.projectName || "").trim();
    plan.batchName = String(plan.batchName || "").trim();
    plan.currency = String(plan.currency || "").trim() || null;
    plan.stockOrderOptions = plan.stockOrderOptions || plan.regularStockOptions || [];
    plan.stockPieces = (plan.stockPieces || []).map(piece => ({
      ...piece,
      stockSource: piece.stockSource === "RegularStock" ? "StockOrder" : piece.stockSource,
      segments: (piece.segments || piece.layoutSegments || []).map(normalizeSegment)
    }));
    plan.storageRetrievals = plan.storageRetrievals || [];
    plan.requestedParts = plan.requestedParts || [];
    plan.totals = plan.totals || {};
    plan.totals.totalStockOrderLengthOrdered = plan.totals.totalStockOrderLengthOrdered ?? plan.totals.totalRegularStockLengthOrdered ?? 0;
    plan.totals.stockOrderPieceCount = plan.totals.stockOrderPieceCount ?? plan.totals.regularStockPieceCount ?? 0;
    return plan;
  }

  async function loadPlan() {
    if (!batchId || !groupId) throw new Error("Return to the Batch Result page and open a cutting plan.");
    const stored = await NcNesting.getPlan(batchId, groupId);
    if (!stored) throw new Error("This cutting plan is not available in this browser. Solve the job again.");
    return normalizePlan(stored);
  }

  const mm = value => realNumber(value) == null ? "—" : `${fmt(Number(value))} ${data.settings.unit}`;
  const pct = value => Number.isFinite(value) ? `${value.toFixed(1)}%` : "—";
  const percentage = (value, total) => Number.isFinite(value) && Number.isFinite(total) && total > 0 ? value / total * 100 : Number.NaN;
  const isOffcut = type => type === SEGMENT.REUSABLE_OFFCUT || type === SEGMENT.NON_REUSABLE_OFFCUT;

  function retrievalText(storage) {
    return String(storage.storageArea || "").trim() || "Unspecified storage area";
  }

  function validateExplicitSequence(piece) {
    const segments = piece.segments;
    const label = `Piece ${piece.pieceNumber ?? "?"}`;
    if (segments.length < 7 || segments.length % 2 === 0) throw new Error(`${label} has an invalid segment sequence.`);
    if (segments[0].type !== SEGMENT.START_TRIM || segments.at(-1).type !== SEGMENT.END_TRIM) throw new Error(`${label} has invalid trim segments.`);
    for (let index = 1; index < segments.length; index += 2) {
      if (segments[index].type !== SEGMENT.TOOL_CUT) throw new Error(`${label} has a missing cut segment.`);
    }
    const offcutIndex = segments.length - 3;
    if (!isOffcut(segments[offcutIndex].type)) throw new Error(`${label} has an invalid offcut segment.`);
    for (let index = 2; index < offcutIndex; index += 2) {
      if (segments[index].type !== SEGMENT.PART) throw new Error(`${label} has an invalid part segment.`);
    }
    segments.forEach(segment => {
      if (!Number.isFinite(segment.length) || segment.length < 0) throw new Error(`${label} has an invalid segment length.`);
      if (segment.type === SEGMENT.PART && !segment.partId) throw new Error(`${label} has an unnamed part segment.`);
    });
    const segmentTotal = segments.reduce((sum, segment) => sum + segment.length, 0);
    if (Math.abs(segmentTotal - piece.stockLength) > 0.001) throw new Error(`${label} lengths do not match the selected stock.`);
  }

  function calculatePiece(piece) {
    validateExplicitSequence(piece);
    const partSegments = piece.segments.filter(segment => segment.type === SEGMENT.PART);
    const cutSegments = piece.segments.filter(segment => segment.type === SEGMENT.TOOL_CUT);
    const offcutSegment = piece.segments.find(segment => isOffcut(segment.type));
    const trimSegments = piece.segments.filter(segment => segment.type === SEGMENT.START_TRIM || segment.type === SEGMENT.END_TRIM);
    const partLength = partSegments.reduce((sum, segment) => sum + segment.length, 0);
    const cutLength = cutSegments.reduce((sum, segment) => sum + segment.length, 0);
    const trimLength = trimSegments.reduce((sum, segment) => sum + segment.length, 0);
    const offcut = offcutSegment.length;
    const consumed = partLength + cutLength + trimLength;
    return {
      ...piece,
      parts: partSegments.map(segment => ({ partId: segment.partId, length: segment.length })),
      partLength,
      cutLength,
      consumed,
      offcut,
      partUtilization: percentage(partLength, piece.stockLength),
      processUtilization: percentage(consumed, piece.stockLength),
      reusable: offcutSegment.type === SEGMENT.REUSABLE_OFFCUT
    };
  }

  async function loadAndRender(source) {
    data = source ? normalizePlan(source) : await loadPlan();
    pieces = data.stockPieces.map(calculatePiece);
    document.getElementById("loadError").hidden = true;
    document.getElementById("pageHeading").textContent = `${data.profileName} · ${data.steelGrade} · Cut Plan`;
    document.title = `${data.profileName} · ${data.steelGrade} · Cut Plan — NC Nesting`;
    document.getElementById("jobNames").innerHTML = [
      data.projectName ? `<span>Project: <strong>${escapeHtml(data.projectName)}</strong></span>` : "",
      data.batchName ? `<span>Batch name: <strong>${escapeHtml(data.batchName)}</strong></span>` : ""
    ].filter(Boolean).join('<span class="job-name-separator"> · </span>');
    document.getElementById("jobSettings").innerHTML = `
      Tool width: <strong>${mm(data.settings.toolWidth)}</strong> ·
      Start trim: <strong>${mm(data.settings.trimStart)}</strong> ·
      End trim: <strong>${mm(data.settings.trimEnd)}</strong> ·
      Reusable minimum: <strong>${mm(data.settings.reusableMinimumLength)}</strong>
    `;
    renderSummary();
    renderPieces();
    renderStockOrders();
    renderStorageRetrieval();
    renderLayoutMatrix();
    renderWasteList();
  }

  function showLoadError() {
    const errorPanel = document.getElementById("loadError");
    errorPanel.textContent = "The cutting plan could not be processed. Return to the Batch Result page and try again.";
    errorPanel.hidden = false;
  }

  function renderSummary() {
    const totalStock = finiteNumber(data.totals.totalStockLengthConsumed);
    const totalConsumed = finiteNumber(data.totals.totalConsumedLength);
    const totalOffcut = finiteNumber(data.totals.totalOffcutLength);
    const storageLength = finiteNumber(data.totals.totalStorageStockLengthConsumed);
    const reusableReturned = finiteNumber(data.totals.totalReusableOffcutLength);
    const metrics = [
      ["Utilization", pct(percentage(totalConsumed, totalStock)), `${mm(totalConsumed)} including parts, trims and tool cuts`],
      ["Waste", pct(percentage(totalOffcut, totalStock)), `${mm(totalOffcut)} total offcut`],
      ["Storage stock share", pct(percentage(storageLength, totalStock)), `${mm(storageLength)} consumed from storage`],
      ["Reusable returned to storage", pct(percentage(reusableReturned, totalStock)), `${mm(reusableReturned)} reusable offcut`]
    ];
    document.getElementById("summary").innerHTML = metrics.map(([label, percentValue, note]) => `
      <div class="metric"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-percent">${escapeHtml(percentValue)}</div><div class="metric-length">${escapeHtml(note)}</div></div>
    `).join("");
  }

  function segmentPresentation(segment) {
    switch (segment.type) {
      case SEGMENT.START_TRIM: return { className: "trim start-trim", title: "Start trim", label: "Start trim" };
      case SEGMENT.END_TRIM: return { className: "trim end-trim", title: "End trim", label: "End trim" };
      case SEGMENT.TOOL_CUT: return { className: "tool-cut", title: "Tool-width cut", label: "Cut" };
      case SEGMENT.PART: return { className: "nested-part", title: `Nested part ${segment.partId}`, label: segment.partId };
      case SEGMENT.REUSABLE_OFFCUT: return { className: "offcut reusable", title: "Reusable offcut", label: "Reusable offcut" };
      case SEGMENT.NON_REUSABLE_OFFCUT: return { className: "offcut non-reusable", title: "Non-reusable offcut", label: "Non-reusable offcut" };
      default: throw new Error("The cutting plan contains an unsupported segment.");
    }
  }

  function segmentMarkup(segment) {
    const presentation = segmentPresentation(segment);
    const title = `${presentation.title}: ${mm(segment.length)}`;
    const content = segment.type === SEGMENT.TOOL_CUT ? "" : `<div class="segment-label"><strong>${escapeHtml(presentation.label)}</strong><span>${escapeHtml(mm(segment.length))}</span></div>`;
    return `<div class="segment ${presentation.className}" style="--segment-length:${segment.length}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${content}</div>`;
  }

  function renderPieces() {
    const displayPieces = [...pieces].sort((left, right) => {
      const leftSourceOrder = left.stockSource === "StorageStock" ? 0 : 1;
      const rightSourceOrder = right.stockSource === "StorageStock" ? 0 : 1;
      return leftSourceOrder - rightSourceOrder || finiteNumber(left.stockLength) - finiteNumber(right.stockLength) || finiteNumber(left.pieceNumber) - finiteNumber(right.pieceNumber);
    });
    document.getElementById("pieces").innerHTML = displayPieces.map(piece => {
      const sourceClass = piece.stockSource === "StorageStock" ? "storage" : "stock-order";
      const sourceLabel = piece.stockSource === "StorageStock" ? "Storage stock" : "Stock order";
      const retrieval = piece.stockSource === "StorageStock"
        ? `<span>Retrieve ${escapeHtml(piece.storageStockId)}: ${escapeHtml(retrievalText(piece))}</span>`
        : "<span>New stock order</span>";
      return `
        <article class="piece">
          <div class="piece-heading"><div class="piece-title"><strong>Piece ${escapeHtml(piece.pieceNumber)}</strong><span class="source-chip ${sourceClass}">${sourceLabel}</span><span>${escapeHtml(piece.stockTypeId)} · ${escapeHtml(mm(piece.stockLength))}</span></div><div class="utilization"><strong>${pct(piece.partUtilization)}</strong><span>part yield · ${escapeHtml(mm(piece.partLength))}</span></div></div>
          <div class="bar-wrap"><div class="bar">${piece.segments.map(segmentMarkup).join("")}</div></div>
          <div class="piece-details">${retrieval}<span>Tool cuts ${escapeHtml(mm(piece.cutLength))}</span><span>Consumed ${escapeHtml(mm(piece.consumed))} (${pct(piece.processUtilization)})</span><span>Offcut ${escapeHtml(mm(piece.offcut))} ${piece.reusable ? "(reusable)" : "(non-reusable)"}</span></div>
        </article>`;
    }).join("");
    const legend = [
      ["Nested parts", "var(--nested-part)"],
      ["Start/end trim", "var(--trim)"],
      ["Tool-width cut", "var(--tool-cut)"],
      ["Reusable offcut", "var(--reusable)"],
      ["Non-reusable offcut", "var(--non-reusable)"]
    ];
    document.getElementById("legend").innerHTML = legend.map(([label, background]) => `<span class="legend-item"><span class="swatch" style="background:${background}"></span>${escapeHtml(label)}</span>`).join("");
  }

  function sourceIds(piece) {
    const values = piece.stockSource === "StorageStock"
      ? [piece.storageStockId, piece.groupedStorageStockId, piece.stockTypeId]
      : [piece.stockOrderId, piece.stockTypeId];
    return [...new Set(values.map(value => String(value || "").trim().toLowerCase()).filter(Boolean))];
  }

  function matchingPieces(id, stockSource, length) {
    const normalizedId = String(id || "").trim().toLowerCase();
    const targetLength = realNumber(length);
    return pieces.filter(piece => {
      if (stockSource === "StorageStock" && piece.stockSource !== "StorageStock") return false;
      if (stockSource !== "StorageStock" && piece.stockSource === "StorageStock") return false;
      const ids = sourceIds(piece);
      if (normalizedId && ids.length) return ids.includes(normalizedId);
      return targetLength != null && realNumber(piece.stockLength) === targetLength;
    });
  }

  function derivedSourceValues(record, stockSource) {
    const id = stockSource === "StorageStock"
      ? (record.storageStockId || record.groupedStorageStockId)
      : (record.stockOrderId || record.stockTypeId);
    const length = realNumber(record.stockLength ?? record.length);
    const matched = matchingPieces(id, stockSource, length);
    const explicitQuantity = realNumber(stockSource === "StorageStock" ? record.quantity : record.selectedPieceCount);
    const quantity = explicitQuantity ?? (matched.length ? matched.length : null);
    let totalStockLength = realNumber(stockSource === "StorageStock" ? record.totalRetrievedStockLength : record.selectedStockLength);
    if (totalStockLength == null && quantity != null && length != null) totalStockLength = quantity * length;
    if (totalStockLength == null && matched.length) totalStockLength = matched.reduce((sum, piece) => sum + finiteNumber(piece.stockLength), 0);
    const explicitPartLength = realNumber(stockSource === "StorageStock" ? record.totalPartLength : record.selectedPartLength);
    const partLength = explicitPartLength ?? (matched.length ? matched.reduce((sum, piece) => sum + piece.partLength, 0) : null);
    const suppliedUtilization = realNumber(record.utilizationPercentage);
    const utilization = suppliedUtilization ?? (partLength != null && totalStockLength != null ? percentage(partLength, totalStockLength) : Number.NaN);
    const suppliedWaste = realNumber(record.wasteLength ?? record.totalWasteLength);
    const wasteLength = suppliedWaste ?? (matched.length ? matched.reduce((sum, piece) => sum + piece.offcut, 0) : Number.NaN);
    return { id, length, quantity, utilization, wasteLength };
  }

  function formatMoney(value) {
    const amount = realNumber(value);
    if (amount == null || !data.currency) return "";
    const aliases = { "Israeli New Shekel": "ILS", "US Dollar": "USD", "Euro": "EUR", "Chinese Yuan (CNY)": "CNY" };
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: aliases[data.currency] || data.currency, maximumFractionDigits: 2 }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${data.currency}`;
    }
  }

  function summaryRecord(title, subtitle, quantity, length, utilization, wasteLength) {
    const percentageValue = Number.isFinite(utilization) ? pct(utilization) : "—";
    const wasteText = Number.isFinite(wasteLength) ? `${mm(wasteLength)} waste` : "Waste not supplied";
    return `
      <article class="source-summary-record">
        <div class="source-summary-heading"><strong>${escapeHtml(title || "—")}</strong><span>${escapeHtml(subtitle)}</span></div>
        <div class="source-table-wrap"><table class="source-summary-table"><thead><tr><th>Quantity</th><th>Length</th><th>Percentage</th></tr></thead><tbody><tr><td><strong>${quantity == null ? "—" : escapeHtml(quantity)}</strong></td><td><strong>${escapeHtml(mm(length))}</strong></td><td><strong class="summary-percentage">${escapeHtml(percentageValue)}</strong><span class="summary-secondary">${escapeHtml(wasteText)}</span></td></tr></tbody></table></div>
      </article>`;
  }

  function renderStorageRetrieval() {
    if (data.storageRetrievals.length === 0) {
      document.getElementById("storageRetrieval").innerHTML = '<p class="empty-summary">No storage stock is selected for this plan.</p>';
      return;
    }
    document.getElementById("storageRetrieval").innerHTML = data.storageRetrievals.map(record => {
      const values = derivedSourceValues(record, "StorageStock");
      return summaryRecord(values.id, retrievalText(record), values.quantity, values.length, values.utilization, values.wasteLength);
    }).join("");
  }

  function renderStockOrders() {
    const selected = data.stockOrderOptions.filter(stock => {
      const count = realNumber(stock.selectedPieceCount);
      return count != null ? count > 0 : matchingPieces(stock.stockOrderId || stock.stockTypeId, "StockOrder", stock.length ?? stock.stockLength).length > 0;
    });
    if (selected.length === 0) {
      document.getElementById("stockOrders").innerHTML = '<p class="empty-summary">No stock orders are selected for this plan.</p>';
      return;
    }
    document.getElementById("stockOrders").innerHTML = selected.map(stock => {
      const values = derivedSourceValues(stock, "StockOrder");
      const availability = stock.isUnlimited ? "Unlimited" : `Limited to ${stock.availableQuantity}`;
      const cost = data.currency ? formatMoney(stock.cost) : "";
      const subtitle = `${availability}${cost ? ` · ${cost}` : ""}`;
      return summaryRecord(values.id, subtitle, values.quantity, values.length, values.utilization, values.wasteLength);
    }).join("");
  }

  function groupedLayouts() {
    const map = new Map();
    pieces.forEach(piece => {
      const counts = {};
      piece.parts.forEach(part => counts[part.partId] = (counts[part.partId] || 0) + 1);
      const key = `${piece.stockSource}|${piece.stockTypeId}|${piece.stockLength}|${piece.layoutId}|${JSON.stringify(counts)}|${piece.offcut}`;
      if (!map.has(key)) map.set(key, { stockSource: piece.stockSource, stockLength: piece.stockLength, offcut: piece.offcut, partUtilization: piece.partUtilization, quantity: 0, counts });
      map.get(key).quantity++;
    });
    return [...map.values()];
  }

  function renderLayoutMatrix() {
    const parts = data.requestedParts;
    const layouts = groupedLayouts();
    const header = `
      <tr><th rowspan="2">Source</th><th rowspan="2" class="right">Stock length</th><th rowspan="2" class="right">Stock qty.</th><th rowspan="2" class="right">Offcut length</th><th rowspan="2" class="right">Utilization</th><th colspan="${parts.length}" class="center">Parts per layout</th></tr>
      <tr>${parts.map((part, index) => `<th class="matrix-part-header"><strong>${index + 1}: ${escapeHtml(part.partId)}</strong><span>${escapeHtml(mm(part.length))}</span></th>`).join("")}</tr>`;
    const rows = layouts.map(layout => `
      <tr><td>${layout.stockSource === "StorageStock" ? "Storage" : "Stock order"}</td><td class="right">${escapeHtml(mm(layout.stockLength))}</td><td class="right">${layout.quantity}</td><td class="right">${escapeHtml(mm(layout.offcut))}</td><td class="right">${pct(layout.partUtilization)}</td>${parts.map(part => `<td class="center">${layout.counts[part.partId] || ""}</td>`).join("")}</tr>`).join("");
    document.getElementById("layoutMatrix").innerHTML = `<thead>${header}</thead><tbody>${rows}</tbody>`;
  }

  function groupedWasteRows() {
    const groups = new Map();
    pieces.forEach(piece => {
      const source = piece.stockSource === "StorageStock" ? "Storage" : "Stock order";
      const stockId = piece.stockSource === "StorageStock" ? (piece.storageStockId || piece.stockTypeId) : (piece.stockOrderId || piece.stockTypeId);
      const key = `${source}\u0000${stockId}\u0000${piece.offcut}\u0000${piece.reusable}`;
      if (!groups.has(key)) groups.set(key, { pieceNumbers: [], source, stockId, offcut: piece.offcut, reusable: piece.reusable });
      groups.get(key).pieceNumbers.push(piece.pieceNumber);
    });
    return [...groups.values()].map(row => ({
      ...row,
      pieceNumbers: row.pieceNumbers.sort((a, b) => finiteNumber(a) - finiteNumber(b)),
      quantity: row.pieceNumbers.length
    })).sort((left, right) => right.offcut - left.offcut);
  }

  function renderWasteList() {
    const rows = groupedWasteRows();
    document.getElementById("wasteList").innerHTML = `
      <thead><tr><th>Piece</th><th>Source</th><th>Stock ID</th><th class="right">Offcut length</th><th>Status</th></tr></thead>
      <tbody>${rows.map(row => `<tr><td>${escapeHtml(row.pieceNumbers.join(", "))}</td><td>${escapeHtml(row.source)}</td><td>${escapeHtml(row.quantity >= 2 ? `${row.quantity} x ${row.stockId}` : row.stockId)}</td><td class="right">${escapeHtml(mm(row.offcut))}</td><td>${row.reusable ? "Reusable" : "Non-reusable"}</td></tr>`).join("")}</tbody>`;
  }

  async function printFullSet() {
    try {
      const calculation = await NcNesting.getSolvedBatch(batchId);
      if (!calculation) throw new Error();
      await NcNestingPrint.printFullSet(calculation);
    } catch {
      window.alert("The full print set could not be created.");
    }
  }

  if (batchId) document.getElementById("backLink").href = `batch-result.html?batchId=${encodeURIComponent(batchId)}`;
  document.getElementById("printPage").addEventListener("click", () => NcNestingPrint.printPlanPage(data));
  document.getElementById("printFullSet").addEventListener("click", printFullSet);
  loadAndRender().catch(showLoadError);
})();
