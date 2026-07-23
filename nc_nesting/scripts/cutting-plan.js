(function () {
  "use strict";

  const I18N = window.NCNestingI18n;
  const t = (key, params = {}, language) => I18N.t(key, params, language);
  const rich = (key, params = {}, language) => I18N.richText(key, params, language);
  const pageParams = new URLSearchParams(location.search);
  const batchId = pageParams.get("batchId");
  const groupId = pageParams.get("groupId");
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
  let loadErrorDescriptor = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  const bdi = value => `<bdi dir="ltr">${escapeHtml(value)}</bdi>`;

  function localizedError(key, params = {}) {
    const error = new Error(key);
    error.i18nKey = key;
    error.i18nParams = params;
    return error;
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
    if (!batchId || !groupId) throw localizedError("error.returnBatch");
    const stored = await NcNesting.getPlan(batchId, groupId);
    if (!stored) throw localizedError("error.planUnavailable");
    return normalizePlan(stored);
  }

  const mm = value => realNumber(value) == null ? "—" : I18N.measurementHtml(Number(value), "mm", { maximumFractionDigits: 2 });
  const mmText = value => realNumber(value) == null ? "—" : I18N.measurementText(Number(value), "mm", { maximumFractionDigits: 2 });
  const pct = value => Number.isFinite(value) ? `${I18N.formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : "—";
  const percentage = (value, total) => Number.isFinite(value) && Number.isFinite(total) && total > 0 ? value / total * 100 : Number.NaN;
  const isOffcut = type => type === SEGMENT.REUSABLE_OFFCUT || type === SEGMENT.NON_REUSABLE_OFFCUT;

  function retrievalText(storage) {
    const area = String(storage.storageArea || "").trim();
    return area ? t("plan.retrieveArea", { area: I18N.isolate(area) }) : t("plan.unspecifiedArea");
  }

  function validateExplicitSequence(piece) {
    const segments = piece.segments;
    const number = I18N.isolate(piece.pieceNumber ?? "?");
    if (segments.length < 7 || segments.length % 2 === 0) throw localizedError("planError.sequence", { number });
    if (segments[0].type !== SEGMENT.START_TRIM || segments.at(-1).type !== SEGMENT.END_TRIM) throw localizedError("planError.trim", { number });
    for (let index = 1; index < segments.length; index += 2) {
      if (segments[index].type !== SEGMENT.TOOL_CUT) throw localizedError("planError.cut", { number });
    }
    const offcutIndex = segments.length - 3;
    if (!isOffcut(segments[offcutIndex].type)) throw localizedError("planError.offcut", { number });
    for (let index = 2; index < offcutIndex; index += 2) {
      if (segments[index].type !== SEGMENT.PART) throw localizedError("planError.part", { number });
    }
    segments.forEach(segment => {
      if (!Number.isFinite(segment.length) || segment.length < 0) throw localizedError("planError.length", { number });
      if (segment.type === SEGMENT.PART && !segment.partId) throw localizedError("planError.unnamed", { number });
    });
    const segmentTotal = segments.reduce((sum, segment) => sum + segment.length, 0);
    if (Math.abs(segmentTotal - piece.stockLength) > 0.001) throw localizedError("planError.total", { number });
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

  function updateBackArrow() {
    const arrow = document.querySelector("#backLink .back-arrow");
    if (arrow) arrow.textContent = I18N.direction() === "rtl" ? "→" : "←";
  }

  function renderIdentity() {
    document.getElementById("pageHeading").innerHTML = `${bdi(data.profileName)} · ${bdi(data.steelGrade)} · ${escapeHtml(t("common.cutPlan"))}`;
    document.title = `${data.profileName} · ${data.steelGrade} · ${t("page.plan.main")} — ${t("common.ncNesting")}`;
    document.getElementById("jobNames").innerHTML = [
      data.projectName ? `<span>${escapeHtml(t("common.project"))}: <strong dir="auto">${escapeHtml(data.projectName)}</strong></span>` : "",
      data.batchName ? `<span>${escapeHtml(t("common.batchName"))}: <strong dir="auto">${escapeHtml(data.batchName)}</strong></span>` : ""
    ].filter(Boolean).join('<span class="job-name-separator"> · </span>');
    document.getElementById("jobSettings").innerHTML = `
      ${escapeHtml(t("common.toolWidth"))}: <strong>${mm(data.settings.toolWidth)}</strong> ·
      ${escapeHtml(t("common.startTrim"))}: <strong>${mm(data.settings.trimStart)}</strong> ·
      ${escapeHtml(t("common.endTrim"))}: <strong>${mm(data.settings.trimEnd)}</strong> ·
      ${escapeHtml(t("common.reusableMinimum"))}: <strong>${mm(data.settings.reusableMinimumLength)}</strong>
    `;
  }

  function renderAll() {
    I18N.apply();
    updateBackArrow();
    renderIdentity();
    renderSummary();
    renderPieces();
    renderStockOrders();
    renderStorageRetrieval();
    renderLayoutMatrix();
    renderWasteList();
  }

  async function loadAndRender(source) {
    data = source ? normalizePlan(source) : await loadPlan();
    loadErrorDescriptor = null;
    pieces = data.stockPieces.map(calculatePiece);
    document.getElementById("loadError").hidden = true;
    ["printPage", "printFullSet"].forEach(id => { document.getElementById(id).disabled = false; });
    renderAll();
  }

  function renderLoadError() {
    if (!loadErrorDescriptor) return;
    const errorPanel = document.getElementById("loadError");
    errorPanel.textContent = t(loadErrorDescriptor.key, loadErrorDescriptor.params);
    errorPanel.hidden = false;
  }

  function showLoadError(error) {
    loadErrorDescriptor = {
      key: error?.i18nKey || "error.planProcess",
      params: error?.i18nParams || {}
    };
    renderLoadError();
  }

  function renderSummary() {
    const totalStock = finiteNumber(data.totals.totalStockLengthConsumed);
    const totalConsumed = finiteNumber(data.totals.totalConsumedLength);
    const totalOffcut = finiteNumber(data.totals.totalOffcutLength);
    const storageLength = finiteNumber(data.totals.totalStorageStockLengthConsumed);
    const reusableReturned = finiteNumber(data.totals.totalReusableOffcutLength);
    const metrics = [
      [t("common.utilization"), pct(percentage(totalConsumed, totalStock)), I18N.supportingTextHtml("plan.includesParts", { length: mm(totalConsumed) })],
      [t("common.totalOffcut"), pct(percentage(totalOffcut, totalStock)), I18N.supportingTextHtml("plan.totalOffcutNote", { length: mm(totalOffcut) })],
      [t("common.storageStockShare"), pct(percentage(storageLength, totalStock)), I18N.supportingTextHtml("plan.consumedStorageNote", { length: mm(storageLength) })],
      [t("common.reusableReturnedToStorage"), pct(percentage(reusableReturned, totalStock)), I18N.supportingTextHtml("plan.reusableNote", { length: mm(reusableReturned) })]
    ];
    document.getElementById("summary").innerHTML = metrics.map(([label, percentValue, note]) => `
      <div class="metric"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-percent" dir="ltr">${escapeHtml(percentValue)}</div><div class="metric-length">${note}</div></div>
    `).join("");
  }

  function segmentPresentation(segment) {
    switch (segment.type) {
      case SEGMENT.START_TRIM: return { className: "trim start-trim", title: t("common.startTrim"), label: t("common.startTrim") };
      case SEGMENT.END_TRIM: return { className: "trim end-trim", title: t("common.endTrim"), label: t("common.endTrim") };
      case SEGMENT.TOOL_CUT: return { className: "tool-cut", title: t("common.toolWidthCut"), label: t("plan.cutLabel") };
      case SEGMENT.PART: return { className: "nested-part", title: `${t("common.nestedPart")} ${I18N.isolate(segment.partId)}`, label: segment.partId };
      case SEGMENT.REUSABLE_OFFCUT: return { className: "offcut reusable", title: t("common.reusableOffcut"), label: t("common.reusableOffcut") };
      case SEGMENT.NON_REUSABLE_OFFCUT: return { className: "offcut non-reusable", title: t("common.nonReusableOffcut"), label: t("common.nonReusableOffcut") };
      default: throw localizedError("error.unsupportedSegment");
    }
  }

  function segmentMarkup(segment) {
    const presentation = segmentPresentation(segment);
    const title = `${presentation.title}: ${mmText(segment.length)}`;
    const content = segment.type === SEGMENT.TOOL_CUT ? "" : `<div class="segment-label"><strong>${segment.type === SEGMENT.PART ? bdi(presentation.label) : escapeHtml(presentation.label)}</strong><span>${mm(segment.length)}</span></div>`;
    return `<div class="segment ${presentation.className}" style="--segment-length:${segment.length}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${content}</div>`;
  }

  function renderPieces() {
    const displayPieces = [...pieces].sort((left, right) => {
      const leftSourceOrder = left.stockSource === "StorageStock" ? 0 : 1;
      const rightSourceOrder = right.stockSource === "StorageStock" ? 0 : 1;
      return leftSourceOrder - rightSourceOrder || finiteNumber(left.stockLength) - finiteNumber(right.stockLength) || finiteNumber(left.pieceNumber) - finiteNumber(right.pieceNumber);
    });
    document.getElementById("pieces").innerHTML = displayPieces.length ? displayPieces.map(piece => {
      const sourceClass = piece.stockSource === "StorageStock" ? "storage" : "stock-order";
      const sourceLabel = piece.stockSource === "StorageStock" ? t("common.storageStock") : t("common.stockOrder");
      const retrieval = piece.stockSource === "StorageStock"
        ? `<span>${escapeHtml(t("plan.retrieve", { id: I18N.isolate(piece.storageStockId || piece.stockTypeId) }))}: ${escapeHtml(retrievalText(piece))}</span>`
        : `<span>${escapeHtml(t("plan.newStockOrder"))}</span>`;
      const description = I18N.supportingTextHtml("plan.pieceDescription", {
        partLength: mm(piece.partLength),
        cutLength: mm(piece.cutLength),
        consumed: mm(piece.consumed),
        offcut: mm(piece.offcut),
        status: escapeHtml(piece.reusable ? t("common.reusableLower") : t("common.nonReusableLower"))
      });
      return `
        <article class="piece">
          <div class="piece-heading"><div class="piece-title"><strong>${escapeHtml(t("plan.piece", { number: I18N.isolate(piece.pieceNumber) }))}</strong><span class="source-chip ${sourceClass}">${escapeHtml(sourceLabel)}</span><span>${bdi(piece.stockTypeId)} · ${mm(piece.stockLength)}</span></div><div class="utilization"><strong dir="ltr">${pct(piece.partUtilization)}</strong><span>${escapeHtml(t("common.partYield"))} · ${mm(piece.partLength)}</span></div></div>
          <div class="bar-wrap" dir="ltr"><div class="bar" dir="ltr">${piece.segments.map(segmentMarkup).join("")}</div></div>
          <div class="piece-details">${retrieval}<span>${description}</span></div>
        </article>`;
    }).join("") : `<p>${escapeHtml(t("plan.noPieces"))}</p>`;
    const legend = [
      [t("plan.nestedParts"), "var(--nested-part)"],
      [t("common.startEndTrim"), "var(--trim)"],
      [t("common.toolWidthCut"), "var(--tool-cut)"],
      [t("common.reusableOffcut"), "var(--reusable)"],
      [t("common.nonReusableOffcut"), "var(--non-reusable)"]
    ];
    const legendElement = document.getElementById("legend");
    legendElement.setAttribute("aria-label", t("common.cuttingPlanLegend"));
    legendElement.innerHTML = legend.map(([label, background]) => `<span class="legend-item"><span class="swatch" style="background:${background}"></span>${escapeHtml(label)}</span>`).join("");
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
    return I18N.priceHtml(amount, data.currency, { maximumFractionDigits: 2 });
  }

  function summaryRecord(title, subtitleHtml, quantity, length, utilization, wasteLength) {
    const percentageValue = Number.isFinite(utilization) ? pct(utilization) : "—";
    const wasteText = Number.isFinite(wasteLength)
      ? I18N.supportingTextHtml("plan.wasteLength", { length: mm(wasteLength) })
      : `<span class="supporting-text" dir="auto">${escapeHtml(t("plan.wasteNotSupplied"))}</span>`;
    const percentageDetails = I18N.inlineValuesHtml([
      `<strong class="summary-percentage" dir="ltr">${escapeHtml(percentageValue)}</strong>`,
      wasteText
    ], { className: "summary-percentage-line" });
    return `
      <article class="source-summary-record">
        <div class="source-summary-heading"><strong>${bdi(title || "—")}</strong><span class="source-summary-support">${subtitleHtml}</span></div>
        <div class="source-table-wrap"><table class="source-summary-table"><thead><tr><th>${escapeHtml(t("common.quantity"))}</th><th>${escapeHtml(t("common.length"))}</th><th>${escapeHtml(t("common.percentage"))}</th></tr></thead><tbody><tr><td><strong dir="ltr">${quantity == null ? "—" : escapeHtml(I18N.formatNumber(quantity))}</strong></td><td><strong>${mm(length)}</strong></td><td>${percentageDetails}</td></tr></tbody></table></div>
      </article>`;
  }

  function renderStorageRetrieval() {
    if (data.storageRetrievals.length === 0) {
      document.getElementById("storageRetrieval").innerHTML = `<p class="empty-summary">${escapeHtml(t("plan.noStorage"))}</p>`;
      return;
    }
    document.getElementById("storageRetrieval").innerHTML = data.storageRetrievals.map(record => {
      const values = derivedSourceValues(record, "StorageStock");
      return summaryRecord(values.id, `<span class="supporting-text" dir="auto">${escapeHtml(retrievalText(record))}</span>`, values.quantity, values.length, values.utilization, values.wasteLength);
    }).join("");
  }

  function renderStockOrders() {
    const selected = data.stockOrderOptions.filter(stock => {
      const count = realNumber(stock.selectedPieceCount);
      return count != null ? count > 0 : matchingPieces(stock.stockOrderId || stock.stockTypeId, "StockOrder", stock.length ?? stock.stockLength).length > 0;
    });
    if (selected.length === 0) {
      document.getElementById("stockOrders").innerHTML = `<p class="empty-summary">${escapeHtml(t("plan.noOrders"))}</p>`;
      return;
    }
    document.getElementById("stockOrders").innerHTML = selected.map(stock => {
      const values = derivedSourceValues(stock, "StockOrder");
      const availability = stock.isUnlimited ? t("common.unlimited") : t("common.limitedTo", { quantity: I18N.isolate(I18N.formatNumber(stock.availableQuantity)) });
      const cost = data.currency ? formatMoney(stock.cost) : "";
      const subtitle = `<span class="supporting-text" dir="auto">${escapeHtml(availability)}${cost ? ` <span class="inline-separator" aria-hidden="true">·</span> ${cost}` : ""}</span>`;
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
      <tr><th rowspan="2">${escapeHtml(t("common.source"))}</th><th rowspan="2" class="right">${escapeHtml(t("common.stockLength"))}</th><th rowspan="2" class="right">${escapeHtml(t("common.stockQtyShort"))}</th><th rowspan="2" class="right">${escapeHtml(t("common.offcutLength"))}</th><th rowspan="2" class="right">${escapeHtml(t("common.utilization"))}</th><th colspan="${parts.length}" class="center">${escapeHtml(t("common.partsPerLayout"))}</th></tr>
      <tr>${parts.map((part, index) => `<th class="matrix-part-header"><strong><bdi dir="ltr">${index + 1}: ${escapeHtml(part.partId)}</bdi></strong><span>${mm(part.length)}</span></th>`).join("")}</tr>`;
    const rows = layouts.map(layout => `
      <tr><td>${escapeHtml(layout.stockSource === "StorageStock" ? t("common.storage") : t("common.stockOrder"))}</td><td class="right">${mm(layout.stockLength)}</td><td class="right" dir="ltr">${I18N.formatNumber(layout.quantity)}</td><td class="right">${mm(layout.offcut)}</td><td class="right" dir="ltr">${pct(layout.partUtilization)}</td>${parts.map(part => `<td class="center" dir="ltr">${layout.counts[part.partId] || ""}</td>`).join("")}</tr>`).join("");
    document.getElementById("layoutMatrix").innerHTML = `<thead>${header}</thead><tbody>${rows}</tbody>`;
  }

  function groupedWasteRows() {
    const groups = new Map();
    pieces.forEach(piece => {
      const source = piece.stockSource === "StorageStock" ? "Storage" : "StockOrder";
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
      <thead><tr><th>${escapeHtml(t("common.piece"))}</th><th>${escapeHtml(t("common.source"))}</th><th>${escapeHtml(t("common.stockId"))}</th><th class="right">${escapeHtml(t("common.offcutLength"))}</th><th>${escapeHtml(t("common.status"))}</th></tr></thead>
      <tbody>${rows.map(row => {
        const source = row.source === "Storage" ? t("common.storage") : t("common.stockOrder");
        const stockDisplay = row.quantity >= 2 ? `${row.quantity} x ${row.stockId}` : row.stockId;
        return `<tr><td dir="ltr">${escapeHtml(row.pieceNumbers.join(", "))}</td><td>${escapeHtml(source)}</td><td dir="ltr">${escapeHtml(stockDisplay)}</td><td class="right">${mm(row.offcut)}</td><td>${escapeHtml(row.reusable ? t("common.reusable") : t("common.nonReusable"))}</td></tr>`;
      }).join("")}</tbody>`;
  }


  async function printCurrentPage() {
    try {
      await NcNestingPrint.printPlanPage(data);
    } catch {
      window.alert(t("error.printSurface"));
    }
  }

  async function printFullSet() {
    try {
      const calculation = await NcNesting.getSolvedBatch(batchId);
      if (!calculation) throw new Error();
      await NcNestingPrint.printFullSet(calculation);
    } catch {
      window.alert(t("error.fullPrint"));
    }
  }

  function retranslatePlanPage() {
    I18N.apply();
    updateBackArrow();
    if (data) renderAll();
    else renderLoadError();
  }

  I18N.apply();
  updateBackArrow();
  I18N.listen(retranslatePlanPage);
  window.addEventListener("site-navbar:ready", retranslatePlanPage, { once: true });
  if (batchId) document.getElementById("backLink").href = `batch-result.html?batchId=${encodeURIComponent(batchId)}`;
  document.getElementById("printPage").addEventListener("click", printCurrentPage);
  document.getElementById("printFullSet").addEventListener("click", printFullSet);
  loadAndRender().catch(showLoadError);
})();
