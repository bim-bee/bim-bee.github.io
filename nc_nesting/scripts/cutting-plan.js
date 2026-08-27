(function () {
  "use strict";

  const I18N = window.NCNestingI18n;
  const Layouts = window.NcNestingLayouts;
  const Optimization = window.NcNestingOptimization;
  const Geometry = window.NcNestingCuttingGeometry;
  const t = (key, params = {}, language) => I18N.t(key, params, language);
  const rich = (key, params = {}, language) => I18N.richText(key, params, language);
  const pageParams = new URLSearchParams(location.search);
  const batchId = pageParams.get("batchId");
  const groupId = pageParams.get("groupId");
  const greedyComparisonView = pageParams.get("view") === "greedy";
  const greedyComparisonEnabled = Boolean(window.NcNestingConfig?.featureFlags?.greedyCutPlanComparison);
  const validationDiagnosticsEnabled = Boolean(window.NcNestingConfig?.featureFlags?.cutPlanValidationDiagnostics);
  const backLink = document.getElementById("backLink");
  if (backLink && greedyComparisonView) {
    backLink.hidden = true;
    document.querySelector("site-navbar")?.syncPageBack?.();
  }
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
  let layouts = [];
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

  function buildValidationDiagnostic(piece, failure) {
    if (!validationDiagnosticsEnabled || !piece) return null;

    const segments = Array.isArray(piece.segments) ? piece.segments : [];
    const partSegments = segments.filter(segment => segment?.type === SEGMENT.PART);
    const totalPartLength = partSegments.reduce((sum, segment) => sum + finiteNumber(segment?.length), 0);
    const stockLength = realNumber(piece.stockLength);
    const measurement = stockLength != null && partSegments.length > 0
      ? Geometry?.measureLayout(stockLength, totalPartLength, partSegments.length, data?.settings)
      : null;
    const segmentTotal = segments.reduce((sum, segment) => sum + finiteNumber(segment?.length), 0);
    const expectedCount = partSegments.length > 0 ? (2 * partSegments.length) + 3 : null;
    const acceptedSegmentCounts = expectedCount == null
      ? []
      : measurement?.terminalKerfCharge === 0
        ? [expectedCount, expectedCount - 1]
        : [expectedCount];

    return {
      failure: String(failure || "validation failed"),
      view: greedyComparisonView ? "greedy DEV comparison" : "regular optimized plan",
      pieceNumber: piece.pieceNumber ?? null,
      stockSource: piece.stockSource ?? null,
      stockLength,
      stockOrderId: piece.stockOrderId ?? null,
      storageStockId: piece.storageStockId ?? null,
      segmentCount: segments.length,
      expectedCount,
      acceptedSegmentCounts,
      segmentTotal,
      partCount: partSegments.length,
      totalPartLength,
      settings: {
        trimStart: realNumber(data?.settings?.trimStart),
        trimEnd: realNumber(data?.settings?.trimEnd),
        toolWidth: realNumber(data?.settings?.toolWidth),
        reusableMinimumLength: realNumber(data?.settings?.reusableMinimumLength)
      },
      measurement: measurement ? {
        fits: measurement.fits,
        fitRequirement: measurement.fitRequirement,
        rawRemainder: measurement.rawRemainder,
        terminalKerfCharge: measurement.terminalKerfCharge,
        netOffcut: measurement.netOffcut,
        actualConsumedLength: measurement.actualConsumedLength,
        reusable: measurement.reusable
      } : null,
      segments: segments.map((segment, index) => ({
        index,
        type: segment?.type ?? null,
        length: realNumber(segment?.length),
        rawLength: segment?.length ?? null,
        partId: segment?.partId ?? null
      }))
    };
  }

  function pieceValidationError(key, piece, failure) {
    const error = localizedError(key, { number: I18N.isolate(piece?.pieceNumber ?? "?") });
    error.validationDiagnostic = buildValidationDiagnostic(piece, failure);
    return error;
  }

  function validationDiagnosticText(diagnostic) {
    if (!diagnostic) return "";
    const value = item => item == null ? "—" : String(item);
    const lines = [
      `View: ${diagnostic.view}`,
      `Failure: ${diagnostic.failure}`,
      `Piece: ${value(diagnostic.pieceNumber)}`,
      `Stock source: ${value(diagnostic.stockSource)}`,
      `Stock length: ${value(diagnostic.stockLength)} mm`,
      `Stock order ID: ${value(diagnostic.stockOrderId)}`,
      `Storage stock ID: ${value(diagnostic.storageStockId)}`,
      `Segment count: ${diagnostic.segmentCount}${diagnostic.expectedCount == null ? "" : ` (accepted ${diagnostic.acceptedSegmentCounts?.join(" or ") || diagnostic.expectedCount} for ${diagnostic.partCount} part(s))`}`,
      `Segment total: ${value(diagnostic.segmentTotal)} mm`,
      `Part total: ${value(diagnostic.totalPartLength)} mm`,
      `Settings: start trim ${value(diagnostic.settings?.trimStart)} mm; end trim ${value(diagnostic.settings?.trimEnd)} mm; tool width ${value(diagnostic.settings?.toolWidth)} mm; reusable minimum ${value(diagnostic.settings?.reusableMinimumLength)} mm`,
      "Expected structure: StartTrim -> Part -> [ToolCut -> Part]... -> [terminal ToolCut when required] -> Offcut -> EndTrim"
    ];
    if (diagnostic.measurement) {
      lines.push(
        `Expected geometry: fits=${diagnostic.measurement.fits}; fit requirement=${value(diagnostic.measurement.fitRequirement)} mm; raw remainder=${value(diagnostic.measurement.rawRemainder)} mm; terminal cut=${value(diagnostic.measurement.terminalKerfCharge)} mm; net offcut=${value(diagnostic.measurement.netOffcut)} mm; consumed=${value(diagnostic.measurement.actualConsumedLength)} mm; reusable=${diagnostic.measurement.reusable}`
      );
    }
    lines.push("Segments:");
    diagnostic.segments.forEach(segment => {
      const part = segment.partId ? `; partId=${segment.partId}` : "";
      const raw = segment.length == null && segment.rawLength != null ? `; rawLength=${String(segment.rawLength)}` : "";
      lines.push(`  [${segment.index}] ${value(segment.type)}; length=${value(segment.length)} mm${part}${raw}`);
    });
    return lines.join("\n");
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

  function canonicalizeLegacySegments(segments, stockLength, settings) {
    if (!segments.length || segments[0]?.type !== SEGMENT.START_TRIM || segments.at(-1)?.type !== SEGMENT.END_TRIM) return segments;
    if (segments[1]?.type !== SEGMENT.TOOL_CUT) return segments;
    const parts = segments.filter(segment => segment.type === SEGMENT.PART);
    const rebuilt = Geometry?.buildSegments(parts, stockLength, settings);
    return rebuilt?.segments || segments;
  }

  function normalizePlan(source) {
    const plan = structuredClone(source);
    plan.settings = { unit: "mm", ...(plan.settings || {}), ...(plan.cuttingSettings || {}) };
    plan.projectName = String(plan.projectName || "").trim();
    plan.batchName = String(plan.batchName || "").trim();
    plan.currency = String(plan.currency || "").trim() || null;
    plan.stockOrderOptions = plan.stockOrderOptions || plan.regularStockOptions || [];
    plan.stockPieces = (plan.stockPieces || []).map(piece => {
      const normalizedSegments = (piece.segments || piece.layoutSegments || []).map(normalizeSegment);
      return {
        ...piece,
        stockSource: piece.stockSource === "RegularStock" ? "StockOrder" : piece.stockSource,
        segments: canonicalizeLegacySegments(normalizedSegments, finiteNumber(piece.stockLength), plan.settings)
      };
    });
    plan.storageRetrievals = plan.storageRetrievals || [];
    plan.requestedParts = plan.requestedParts || [];
    plan.totals = plan.totals || {};
    plan.totals.totalStockOrderLengthOrdered = plan.totals.totalStockOrderLengthOrdered ?? plan.totals.totalRegularStockLengthOrdered ?? 0;
    plan.totals.stockOrderPieceCount = plan.totals.stockOrderPieceCount ?? plan.totals.regularStockPieceCount ?? 0;
    return plan;
  }

  async function loadPlan() {
    if (!batchId || !groupId) throw localizedError("error.returnBatch");
    if (greedyComparisonView) {
      if (!greedyComparisonEnabled || typeof NcNesting.getGreedyPlan !== "function") {
        throw localizedError("error.greedyPlanUnavailable");
      }
      const greedy = await NcNesting.getGreedyPlan(batchId, groupId);
      if (!greedy) throw localizedError("error.greedyPlanUnavailable");
      return normalizePlan(greedy);
    }
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
    if (segments.length < 4) {
      throw pieceValidationError("planError.sequence", piece, `segment count ${segments.length} is below the minimum valid count of 4`);
    }
    if (segments[0].type !== SEGMENT.START_TRIM || segments.at(-1).type !== SEGMENT.END_TRIM) {
      throw pieceValidationError("planError.trim", piece, `first/last segment types are ${segments[0]?.type || "missing"} / ${segments.at(-1)?.type || "missing"}`);
    }

    segments.forEach((segment, index) => {
      if (!Number.isFinite(segment.length) || segment.length < 0) {
        throw pieceValidationError("planError.length", piece, `segment ${index} (${segment.type || "unknown"}) has invalid length ${String(segment.length)}`);
      }
      if (segment.type === SEGMENT.PART && !segment.partId) {
        throw pieceValidationError("planError.unnamed", piece, `part segment ${index} has no partId`);
      }
    });

    const partSegments = segments.filter(segment => segment.type === SEGMENT.PART);
    const partLength = partSegments.reduce((sum, segment) => sum + segment.length, 0);
    const measurement = Geometry?.measureLayout(piece.stockLength, partLength, partSegments.length, data.settings);
    if (!measurement?.fits) {
      throw pieceValidationError("planError.total", piece, `parts do not fit stock according to cutting geometry; raw remainder=${measurement?.rawRemainder ?? "unavailable"}`);
    }

    const offcutIndex = segments.length - 2;
    if (!isOffcut(segments[offcutIndex]?.type)) {
      throw pieceValidationError("planError.offcut", piece, `segment ${offcutIndex} should be an offcut but is ${segments[offcutIndex]?.type || "missing"}`);
    }

    // A terminal ToolCut is normally present before the offcut. For an exact-fit bar,
    // the terminal kerf charge is 0 mm and solver output may legitimately omit that
    // zero-length segment entirely. Accept both representations, but only when the
    // geometry itself proves that no terminal cut is required.
    const candidateTerminalCutIndex = offcutIndex - 1;
    const hasExplicitTerminalCut = segments[candidateTerminalCutIndex]?.type === SEGMENT.TOOL_CUT;
    const terminalCutOmittedForExactFit = !hasExplicitTerminalCut
      && measurement.terminalKerfCharge === 0
      && segments[candidateTerminalCutIndex]?.type === SEGMENT.PART;

    if (!hasExplicitTerminalCut && !terminalCutOmittedForExactFit) {
      throw pieceValidationError(
        "planError.cut",
        piece,
        `segment ${candidateTerminalCutIndex} should be terminal ToolCut; omission is only valid when expected terminal kerf is 0 mm`
      );
    }

    const finalPartIndex = hasExplicitTerminalCut ? candidateTerminalCutIndex - 1 : candidateTerminalCutIndex;
    for (let index = 1; index <= finalPartIndex; index++) {
      const expected = index % 2 === 1 ? SEGMENT.PART : SEGMENT.TOOL_CUT;
      if (segments[index].type !== expected) {
        throw pieceValidationError(
          expected === SEGMENT.PART ? "planError.part" : "planError.cut",
          piece,
          `segment ${index} should be ${expected} but is ${segments[index]?.type || "missing"}`
        );
      }
    }

    const expectedPartCount = Math.ceil(finalPartIndex / 2);
    if (partSegments.length !== expectedPartCount) {
      throw pieceValidationError(
        "planError.sequence",
        piece,
        `sequence contains ${partSegments.length} part segment(s); structure implies ${expectedPartCount}`
      );
    }

    const same = (left, right) => Math.abs(Number(left) - Number(right)) <= 0.001;
    if (!same(segments[0].length, measurement.trimStart) || !same(segments.at(-1).length, measurement.trimEnd)) {
      throw pieceValidationError("planError.trim", piece, `trim lengths are ${segments[0].length}/${segments.at(-1).length} mm; expected ${measurement.trimStart}/${measurement.trimEnd} mm`);
    }
    for (let index = 2; index < finalPartIndex; index += 2) {
      if (!same(segments[index].length, measurement.toolWidth)) {
        throw pieceValidationError("planError.cut", piece, `internal cut at segment ${index} is ${segments[index].length} mm; expected ${measurement.toolWidth} mm`);
      }
    }
    if (hasExplicitTerminalCut && !same(segments[candidateTerminalCutIndex].length, measurement.terminalKerfCharge)) {
      throw pieceValidationError("planError.cut", piece, `terminal cut is ${segments[candidateTerminalCutIndex].length} mm; expected ${measurement.terminalKerfCharge} mm`);
    }
    if (!same(segments[offcutIndex].length, measurement.netOffcut)) {
      throw pieceValidationError("planError.offcut", piece, `offcut is ${segments[offcutIndex].length} mm; expected ${measurement.netOffcut} mm`);
    }
    const expectedOffcutType = measurement.reusable ? SEGMENT.REUSABLE_OFFCUT : SEGMENT.NON_REUSABLE_OFFCUT;
    if (segments[offcutIndex].type !== expectedOffcutType) {
      throw pieceValidationError("planError.offcut", piece, `offcut type is ${segments[offcutIndex].type}; expected ${expectedOffcutType}`);
    }

    const segmentTotal = segments.reduce((sum, segment) => sum + segment.length, 0);
    if (!same(segmentTotal, piece.stockLength)) {
      throw pieceValidationError("planError.total", piece, `segment total is ${segmentTotal} mm; stock length is ${piece.stockLength} mm`);
    }
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
    const measurement = Geometry.measureLayout(piece.stockLength, partLength, partSegments.length, data.settings);
    const consumed = measurement.actualConsumedLength;
    return {
      ...piece,
      parts: partSegments.map(segment => ({ partId: segment.partId, length: segment.length })),
      partLength,
      cutLength,
      consumed,
      offcut,
      partUtilization: NcNestingUtilization.optimisticPercentage(partLength, offcut),
      processUtilization: percentage(consumed, piece.stockLength),
      reusable: offcutSegment.type === SEGMENT.REUSABLE_OFFCUT
    };
  }

  function updateBackArrow() {
    const arrow = document.querySelector("#backLink .back-arrow");
    if (arrow) arrow.textContent = I18N.direction() === "rtl" ? "→" : "←";
  }

  function renderIdentity() {
    const comparisonLabel = greedyComparisonView ? ` · ${escapeHtml(t("plan.greedyComparisonLabel"))}` : "";
    document.getElementById("pageHeading").innerHTML = `${bdi(data.profileName)} · ${bdi(data.steelGrade)} · ${escapeHtml(t("common.cutPlan"))}${comparisonLabel}`;
    document.title = `${data.profileName} · ${data.steelGrade} · ${greedyComparisonView ? `${t("plan.greedyComparisonLabel")} · ` : ""}${t("page.plan.main")} — ${t("common.ncNesting")}`;
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
    renderOptimizationComparison();
    renderPieces();
    renderStockOrders();
    renderStorageRetrieval();
    renderWasteList();
  }

  async function loadAndRender(source) {
    data = source ? normalizePlan(source) : await loadPlan();
    loadErrorDescriptor = null;
    pieces = data.stockPieces.map(calculatePiece);
    layouts = Layouts.groupPieces(pieces);
    document.getElementById("loadError").hidden = true;
    ["downloadCsv", "printPage", "printFullSet"].forEach(id => { document.getElementById(id).disabled = false; });
    document.getElementById("backLink").hidden = greedyComparisonView;
    document.querySelector("site-navbar")?.syncPageBack?.();
    document.getElementById("printFullSet").hidden = greedyComparisonView;
    renderAll();
  }

  function renderLoadError() {
    if (!loadErrorDescriptor) return;
    const errorPanel = document.getElementById("loadError");
    const message = t(loadErrorDescriptor.key, loadErrorDescriptor.params);
    const diagnostic = loadErrorDescriptor.validationDiagnostic;
    if (validationDiagnosticsEnabled && diagnostic) {
      errorPanel.innerHTML = `
        <div>${escapeHtml(message)}</div>
        <details class="validation-diagnostic" open>
          <summary>${escapeHtml(t("planError.devDetails"))}</summary>
          <pre dir="ltr">${escapeHtml(validationDiagnosticText(diagnostic))}</pre>
        </details>
      `;
    } else {
      errorPanel.textContent = message;
    }
    errorPanel.hidden = false;
  }

  function showLoadError(error) {
    loadErrorDescriptor = {
      key: error?.i18nKey || "error.planProcess",
      params: error?.i18nParams || {},
      validationDiagnostic: error?.validationDiagnostic || null
    };
    renderLoadError();
  }

  function greedyComparisonGateway(message) {
    const hasExactGreedySnapshot = Array.isArray(data?.greedyBaseline?.pieces)
      && data.greedyBaseline.pieces.length > 0;
    const genuinelyImproved = Number.isInteger(message?.improvementIndex)
      && message.improvementIndex >= 0;

    if (!greedyComparisonEnabled
      || greedyComparisonView
      || !genuinelyImproved
      || !hasExactGreedySnapshot
      || !batchId
      || !groupId) {
      return null;
    }

    return `cutting-plan.html?batchId=${encodeURIComponent(batchId)}&groupId=${encodeURIComponent(groupId)}&view=greedy`;
  }

  function optimizationDetailHtml(text, comparisonUrl = null) {
    return Optimization?.methodologyLinkedHtml?.(
      text,
      comparisonUrl ? { href: comparisonUrl, forceNewTab: true } : {}
    ) || escapeHtml(text);
  }

  function renderOptimizationComparison() {
    const panel = document.getElementById("optimizationPanel");
    const container = document.getElementById("optimizationComparison");
    const heading = document.getElementById("optimizationHeading");
    const message = Optimization?.resultMessage?.(data, data?.greedyBaseline);
    const comparisonUrl = greedyComparisonGateway(message);

    heading.textContent = greedyComparisonView ? t("plan.greedyComparisonHeading") : t("optimization.comparison");
    if (greedyComparisonView) {
      container.innerHTML = `<div class="optimization-result-message"><div class="optimization-message-header"><span class="optimization-status optimization-status-greedyonly">DEV</span><span class="optimization-message-title">${escapeHtml(t("plan.greedyComparisonTitle"))}</span></div><div class="optimization-message-detail">${escapeHtml(t("plan.greedyComparisonDetail"))}</div></div>`;
      panel.hidden = false;
      return;
    }
    if (!message) {
      panel.hidden = true;
      container.innerHTML = "";
      return;
    }

    const tone = String(message.tone || "bestknown").replace(/[^a-z0-9_-]/gi, "").toLowerCase();
    const stackedHeader = message.status === "Optimal" || message.status === "BestKnown";
    const detailLead = message.detailLead || message.detail;
    const detailContinuation = message.detailContinuation || "";
    container.innerHTML = `
      <div class="optimization-result-message">
        ${stackedHeader
          ? `<div class="optimization-message-header"><span class="optimization-status optimization-status-${escapeHtml(tone)}">${escapeHtml(message.statusLabel || message.status)}</span><span class="optimization-message-title">${escapeHtml(message.headline)}</span></div>
        <div class="optimization-message-detail">${optimizationDetailHtml(detailLead, comparisonUrl)}</div>${detailContinuation ? `
        <div class="optimization-message-detail">${optimizationDetailHtml(detailContinuation, comparisonUrl)}</div>` : ""}`
          : `<span class="optimization-status optimization-status-${escapeHtml(tone)}">${escapeHtml(message.statusLabel || message.status)}</span>
        <div class="optimization-message-title">${escapeHtml(message.headline)}</div>
        <div class="optimization-message-detail">${optimizationDetailHtml(message.detail, comparisonUrl)}</div>`}
      </div>
    `;
    panel.hidden = false;
  }

  function renderSummary() {
    const usage = Layouts.aggregateUsage(layouts);
    const totalStock = usage.totalStockLength || finiteNumber(data.totals.totalStockLengthConsumed);
    const totalPart = usage.totalPartLength || NcNestingUtilization.totalPartLengthFromPlan(data);
    const totalOffcut = finiteNumber(data.totals.totalOffcutLength, usage.totalOffcutLength);
    const storageLength = finiteNumber(data.totals.totalStorageStockLengthConsumed);
    const reusableReturned = finiteNumber(data.totals.totalReusableOffcutLength);
    const metrics = [
      [t("common.utilization"), I18N.summaryPercentageText(NcNestingUtilization.optimisticPercentage(totalPart, totalOffcut)), I18N.supportingTextHtml("plan.includesParts", { length: I18N.summaryLengthHtml(totalPart) })],
      [t("common.totalOffcut"), I18N.summaryPercentageText(NcNestingUtilization.optimisticWastePercentage(totalPart, totalOffcut)), I18N.supportingTextHtml("plan.totalOffcutNote", { length: I18N.summaryLengthHtml(totalOffcut) })],
      [t("common.storageStockShare"), I18N.summaryPercentageText(percentage(storageLength, totalStock)), I18N.supportingTextHtml("plan.consumedStorageNote", { length: I18N.summaryLengthHtml(storageLength) })],
      [t("common.reusableReturnedToStorage"), I18N.summaryPercentageText(percentage(reusableReturned, totalStock)), I18N.supportingTextHtml("plan.reusableNote", { length: I18N.summaryLengthHtml(reusableReturned) })]
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

  function trimSegmentContent(segment) {
    return `<div class="segment-label segment-label--trim"><span class="segment-measurement">${mm(segment.length)}</span></div>`;
  }

  function offcutSegmentContent(segment, presentation) {
    if (!(segment.length > 0)) return "";
    const reusable = segment.type === SEGMENT.REUSABLE_OFFCUT;
    const labelClass = reusable ? "offcut-label--reusable" : "offcut-label--non-reusable";
    return `<div class="segment-label offcut-label ${labelClass}">
      <strong class="offcut-full-label">${escapeHtml(presentation.label)}</strong>
      <span class="offcut-measurement">${mm(segment.length)}</span>
    </div>`;
  }

  function segmentMarkup(segment) {
    if (segment.type === SEGMENT.TOOL_CUT && !(segment.length > 0)) return "";
    if (isOffcut(segment.type) && !(segment.length > 0)) return "";
    const presentation = segmentPresentation(segment);
    const title = `${presentation.title}: ${mmText(segment.length)}`;
    let content = "";
    if ([SEGMENT.START_TRIM, SEGMENT.END_TRIM].includes(segment.type)) {
      content = trimSegmentContent(segment);
    } else if (segment.type === SEGMENT.PART) {
      content = `<div class="segment-label"><strong>${bdi(presentation.label)}</strong><span>${mm(segment.length)}</span></div>`;
    } else if (isOffcut(segment.type)) {
      content = offcutSegmentContent(segment, presentation);
    }
    const boundaryKerf = [SEGMENT.START_TRIM, SEGMENT.END_TRIM].includes(segment.type) && Number(data?.settings?.toolWidth) > 0 ? " has-boundary-kerf" : "";
    return `<div class="segment ${presentation.className}${boundaryKerf}" style="--segment-length:${segment.length}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${content}</div>`;
  }

  function kerfDisplayWidthPx(segments) {
    const visibleKerfs = Math.max(1, segments.filter(segment => segment.type === SEGMENT.TOOL_CUT && segment.length > 0).length);
    return Math.min(5, 220 / visibleKerfs);
  }

  function barSegmentsMarkup(segments) {
    return segments.map(segmentMarkup).join("");
  }

  function layoutDisplayName(layout) {
    const quantity = layout.quantity > 1 ? ` × ${I18N.formatNumber(layout.quantity, { maximumFractionDigits: 0 })}` : "";
    return `${layout.layoutName}${quantity}`;
  }

  function renderPieces() {
    document.getElementById("pieces").innerHTML = layouts.length ? layouts.map(layout => {
      const sourceClass = layout.stockSource === "StorageStock" ? "storage" : "stock-order";
      const sourceLabel = layout.stockSource === "StorageStock" ? t("common.storageStock") : t("common.stockOrder");
      const retrievalIds = layout.storageRecordIds.length ? layout.storageRecordIds.join(", ") : "—";
      const retrieval = layout.stockSource === "StorageStock"
        ? `<span>${escapeHtml(t("plan.retrieve", { id: I18N.isolate(retrievalIds) }))}: ${escapeHtml(layout.storageArea ? t("plan.retrieveArea", { area: I18N.isolate(layout.storageArea) }) : t("plan.unspecifiedArea"))}</span>`
        : `<span>${escapeHtml(t("plan.newStockOrder"))}</span>`;
      const description = I18N.supportingTextHtml("plan.pieceDescription", {
        partLength: mm(layout.partLength),
        cutLength: mm(layout.cutLength),
        consumed: mm(layout.consumed),
        offcut: mm(layout.offcut),
        status: escapeHtml(layout.reusable ? t("common.reusableLower") : t("common.nonReusableLower"))
      });
      return `
        <article class="piece">
          <div class="piece-heading"><div class="piece-title"><strong>${bdi(layoutDisplayName(layout))}</strong><span class="source-chip ${sourceClass}">${escapeHtml(sourceLabel)}</span><span>${mm(layout.stockLength)}</span></div><div class="utilization"><strong dir="ltr">${pct(layout.partUtilization)}</strong><span>${escapeHtml(t("common.utilization"))} · ${mm(layout.partLength)}</span></div></div>
          <div class="bar-wrap" dir="ltr"><div class="bar" dir="ltr" style="--kerf-display-width:${kerfDisplayWidthPx(layout.segments).toFixed(3)}px">${barSegmentsMarkup(layout.segments)}</div></div>
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
    const suppliedWaste = realNumber(record.wasteLength ?? record.totalWasteLength);
    const wasteLength = suppliedWaste ?? (matched.length ? matched.reduce((sum, piece) => sum + piece.offcut, 0) : Number.NaN);
    const utilization = partLength != null && Number.isFinite(wasteLength)
      ? NcNestingUtilization.optimisticPercentage(partLength, wasteLength)
      : Number.NaN;
    return { id, length, quantity, utilization, wasteLength };
  }

  function formatMoney(value) {
    const amount = realNumber(value);
    if (amount == null || !data.currency) return "";
    return I18N.priceHtml(amount, data.currency, { maximumFractionDigits: 2 });
  }

  function summaryRecord(title, subtitleHtml, quantity, length, utilization, wasteLength, options = {}) {
    const percentageValue = Number.isFinite(utilization) ? pct(utilization) : "—";
    const wasteText = Number.isFinite(wasteLength)
      ? I18N.supportingTextHtml("plan.wasteLength", { length: mm(wasteLength) })
      : `<span class="supporting-text" dir="auto">${escapeHtml(t("plan.wasteNotSupplied"))}</span>`;
    const percentageDetails = I18N.inlineValuesHtml([
      `<strong class="summary-percentage" dir="ltr">${escapeHtml(percentageValue)}</strong>`,
      wasteText
    ], { className: "summary-percentage-line" });
    const heading = options.showHeading === false
      ? ""
      : `<div class="source-summary-heading"><strong>${bdi(title || "—")}</strong><span class="source-summary-support">${subtitleHtml}</span></div>`;
    return `
      <article class="source-summary-record${options.showHeading === false ? " source-summary-record--table-only" : ""}">
        ${heading}
        <div class="source-table-wrap"><table class="source-summary-table"><thead><tr><th>${escapeHtml(t("common.quantity"))}</th><th>${escapeHtml(t("common.length"))}</th><th>${escapeHtml(t("common.utilization"))}</th></tr></thead><tbody><tr><td><strong dir="ltr">${quantity == null ? "—" : escapeHtml(I18N.formatNumber(quantity))}</strong></td><td><strong>${mm(length)}</strong></td><td>${percentageDetails}</td></tr></tbody></table></div>
      </article>`;
  }

  function layoutNamesForRecord(record, stockSource) {
    const names = Layouts.layoutsForRecord(layouts, record, stockSource).map(layout => layout.layoutName);
    return names.length ? names.join(", ") : "—";
  }

  function renderStorageRetrieval() {
    const storageRecords = data.storageRetrievals || [];
    if (storageRecords.length === 0) {
      document.getElementById("storageRetrieval").innerHTML = `<p class="empty-summary">${escapeHtml(t("plan.noStorage"))}</p>`;
      return;
    }
    document.getElementById("storageRetrieval").innerHTML = storageRecords.map(storage => {
      const values = derivedSourceValues(storage, "StorageStock");
      const retrievalLabel = values.id ? t("plan.retrieve", { id: I18N.isolate(values.id) }) : t("common.storageRetrievals");
      const areaLabel = retrievalText(storage);
      const subtitle = `<span class="supporting-text" dir="auto">${escapeHtml(retrievalLabel)} <span class="inline-separator" aria-hidden="true">·</span> ${escapeHtml(areaLabel)}</span>`;
      return summaryRecord(layoutNamesForRecord(storage, "StorageStock"), subtitle, values.quantity, values.length, values.utilization, values.wasteLength);
    }).join("");
  }

  function renderStockOrders() {
    const selectedOrders = (data.stockOrderOptions || []).filter(stock => {
      const count = realNumber(stock.selectedPieceCount);
      return count != null
        ? count > 0
        : Layouts.layoutsForRecord(layouts, stock, "StockOrder").length > 0;
    });
    if (selectedOrders.length === 0) {
      document.getElementById("stockOrders").innerHTML = `<p class="empty-summary">${escapeHtml(t("plan.noOrders"))}</p>`;
      return;
    }
    document.getElementById("stockOrders").innerHTML = selectedOrders.map(stock => {
      const values = derivedSourceValues(stock, "StockOrder");
      return summaryRecord(
        "",
        "",
        values.quantity,
        values.length,
        values.utilization,
        values.wasteLength,
        { showHeading: false }
      );
    }).join("");
  }

  function layoutSourceText(layout) {
    return layout.stockSource === "StorageStock"
      ? `${t("common.storage")}${layout.storageArea ? ` · ${layout.storageArea}` : ""}`
      : t("common.stockOrder");
  }

  function wasteLayoutNamesHtml(row) {
    const names = row.layoutNames.length ? row.layoutNames : ["—"];
    return `<span class="waste-layout-names">${names.map((name, index) => `<span class="waste-layout-name">${bdi(name)}${index < names.length - 1 ? '<span class="waste-layout-separator">,</span>' : ""}</span>`).join("")}</span>`;
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function safeFilePart(value) {
    return String(value || "")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 80);
  }

  function downloadCsv() {
    const language = I18N.getLanguage();
    const tr = key => t(key, {}, language);
    const requestedParts = data.requestedParts || [];
    const headers = [
      tr("common.layout"),
      tr("common.source"),
      tr("common.stockLength"),
      tr("common.stockQtyShort"),
      tr("common.offcutLength"),
      tr("common.utilization"),
      ...requestedParts.map((part, index) => `${index + 1}: ${part.partId} (${I18N.measurementText(part.length, "mm", { maximumFractionDigits: 2 }, language)})`)
    ];
    const rows = [headers];
    layouts.forEach(layout => {
      rows.push([
        layout.layoutName,
        layoutSourceText(layout),
        layout.stockLength,
        layout.quantity,
        layout.offcut,
        pct(layout.partUtilization),
        ...requestedParts.map(part => layout.counts[part.partId] || 0)
      ]);
    });
    const blob = new Blob(["\uFEFF" + rows.map(row => row.map(csvEscape).join(",")).join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const identity = safeFilePart([data.projectName, data.batchName, data.profileName, data.steelGrade].filter(Boolean).join("-"));
    link.download = `NC-Nesting-Cutting-Plan${identity ? `-${identity}` : ""}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }


  function renderWasteList() {
    const wasteRows = Layouts.aggregateWasteRows(layouts);
    document.getElementById("wasteList").innerHTML = `
      <thead><tr><th>${escapeHtml(t("common.source"))}</th><th>${escapeHtml(t("common.layout"))}</th><th>${escapeHtml(t("common.stockLength"))}</th><th>${escapeHtml(t("common.utilization"))}</th><th>${escapeHtml(t("common.quantity"))}</th><th>${escapeHtml(t("common.offcutLength"))}</th><th>${escapeHtml(t("common.status"))}</th></tr></thead>
      <tbody>${wasteRows.map(row => `<tr><td><span dir="auto">${escapeHtml(layoutSourceText(row))}</span></td><td>${wasteLayoutNamesHtml(row)}</td><td>${mm(row.stockLength)}</td><td dir="ltr">${escapeHtml(pct(row.utilization))}</td><td dir="ltr">${escapeHtml(I18N.formatNumber(row.quantity))}</td><td>${mm(row.offcut)}</td><td><span dir="auto">${escapeHtml(row.reusable ? t("common.reusable") : t("common.nonReusable"))}</span></td></tr>`).join("")}</tbody>`;
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
  document.getElementById("downloadCsv").addEventListener("click", downloadCsv);
  document.getElementById("printPage").addEventListener("click", printCurrentPage);
  document.getElementById("printFullSet").addEventListener("click", printFullSet);
  loadAndRender().catch(showLoadError);
})();
