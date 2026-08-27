(function () {
  "use strict";

  const I18N = window.NCNestingI18n;
  const Layouts = window.NcNestingLayouts;
  const Geometry = window.NcNestingCuttingGeometry;
  let printLanguage = I18N.getLanguage();
  const t = (key, params = {}) => I18N.t(key, params, printLanguage);
  const rich = (key, params = {}) => I18N.richText(key, params, printLanguage);
  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const bdi = value => `<bdi dir="ltr">${esc(value)}</bdi>`;
  const cssString = value => String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replace(/[\r\n]+/g, " ");
  const number = value => I18N.formatNumber(Number(value) || 0, { maximumFractionDigits: 2 }, printLanguage);
  const integer = value => I18N.formatNumber(Number(value) || 0, { maximumFractionDigits: 0 }, printLanguage);
  const decimal = value => I18N.formatNumber(Number(value) || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 }, printLanguage);

  function realNumber(value) {
    if (value == null || (typeof value === "string" && !value.trim())) return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }

  const finite = (value, fallback = 0) => realNumber(value) ?? fallback;
  const percent = (value, total) => Number.isFinite(value) && Number.isFinite(total) && total > 0 ? value / total * 100 : Number.NaN;
  const percentText = value => Number.isFinite(value) ? `${decimal(value)}%` : "—";
  const mm = value => realNumber(value) == null ? "—" : I18N.measurementHtml(Number(value), "mm", { maximumFractionDigits: 2 }, printLanguage);
  const mmText = value => realNumber(value) == null ? "—" : I18N.measurementText(Number(value), "mm", { maximumFractionDigits: 2 }, printLanguage);
  const metres = value => realNumber(value) == null ? "—" : I18N.measurementHtml(Number(value) / 1000, "m", { maximumFractionDigits: 2 }, printLanguage);
  const ton = value => realNumber(value) == null ? "—" : I18N.measurementHtml(Number(value), "ton", { minimumFractionDigits: 1, maximumFractionDigits: 1 }, printLanguage);
  const cleanName = value => String(value || "").trim();

  function formatMoney(value, currency) {
    const amount = realNumber(value);
    const name = cleanName(currency);
    if (amount == null || !name) return "—";
    return I18N.priceHtml(amount, name, { minimumFractionDigits: 0, maximumFractionDigits: 2 }, printLanguage);
  }

  function sourceText(value) {
    const source = String(value || "").trim();
    if (source === "Manual") return t("common.manual");
    if (source === "Demo data") return t("common.demoData");
    if (source === "CSV") return t("common.csv");
    if (/NC/i.test(source)) return t("common.ncFile");
    return source || t("common.manual");
  }

  const PRINTABLE_TABLE_WIDTH_PX = 195 / 25.4 * 96;
  const CELL_CHROME_PX = 2 * 1.7 / 25.4 * 96 + 2;
  let measurementContext;

  function plainText(value) {
    const holder = document.createElement("div");
    holder.innerHTML = typeof value === "object" && value ? String(value.html ?? "") : String(value ?? "");
    return String(holder.textContent || "").replace(/\s+/g, " ").trim();
  }

  function textWidth(value, bold = false) {
    measurementContext ||= document.createElement("canvas").getContext("2d");
    measurementContext.font = `${bold ? "700" : "400"} 10.6pt Arial, Helvetica, sans-serif`;
    return measurementContext.measureText(String(value || "")).width;
  }

  function compactValue(value) {
    const text = plainText(value);
    if (!text || text === "—") return true;
    return /^[-+]?[$€₪¥]?[\d.,]+(?:\s?(?:mm|m|pcs|t|%|kg|CNY|USD|EUR|ILS))?$/.test(text)
      || /^\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?$/i.test(text)
      || /^(?:On|Off|Yes|No|Reusable|Non-reusable)$/i.test(text)
      || (/^[A-Za-z0-9_.]+(?:-[A-Za-z0-9_.]+)*$/.test(text) && text.length <= 18);
  }

  function expandRowForMeasurement(row, columnCount) {
    const expanded = Array(columnCount).fill(null);
    let column = 0;
    for (const rawCell of row) {
      const cell = normalizeCell(rawCell);
      if (cell.skip) {
        column += cell.skip;
        continue;
      }
      if (cell.colspan === 1 && column < columnCount) expanded[column] = cell.html;
      column += cell.colspan;
      if (column >= columnCount) break;
    }
    return expanded;
  }

  function calculateColumnWidths(headers, rows, footerRows = []) {
    const columnCount = headers.length;
    const measuredRows = [...rows, ...footerRows].map(row => expandRowForMeasurement(row, columnCount));
    const textsByColumn = headers.map((header, index) => [header, ...measuredRows.map(row => row[index])].filter(value => value != null));
    const compactColumns = textsByColumn.map(values => values.slice(1).filter(value => plainText(value)).every(compactValue));
    const baseMinimum = columnCount > 9 ? 34 : columnCount > 7 ? 40 : 48;
    const demands = textsByColumn.map((values, index) => {
      const measured = Math.max(...values.map((value, valueIndex) => textWidth(plainText(value), valueIndex === 0)), 0) + CELL_CHROME_PX;
      const min = compactColumns[index] ? baseMinimum : baseMinimum + 14;
      const maxShare = columnCount <= 2 ? .68 : columnCount === 3 ? .48 : compactColumns[index] ? .20 : .34;
      return Math.min(Math.max(measured, min), PRINTABLE_TABLE_WIDTH_PX * maxShare);
    });
    const minimums = demands.map((_, index) => compactColumns[index] ? Math.max(30, baseMinimum - 8) : Math.max(38, baseMinimum + 2));
    let widths = demands.slice();
    let total = widths.reduce((sum, value) => sum + value, 0);

    if (total < PRINTABLE_TABLE_WIDTH_PX) {
      let remaining = PRINTABLE_TABLE_WIDTH_PX - total;
      const weights = demands.map(value => Math.pow(value, 1.35));
      const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1;
      widths = widths.map((value, index) => value + remaining * weights[index] / weightTotal);
    } else if (total > PRINTABLE_TABLE_WIDTH_PX) {
      let excess = total - PRINTABLE_TABLE_WIDTH_PX;
      for (let pass = 0; pass < 4 && excess > .1; pass++) {
        const shrinkable = widths.map((value, index) => Math.max(0, value - minimums[index]));
        const shrinkTotal = shrinkable.reduce((sum, value) => sum + value, 0);
        if (!shrinkTotal) break;
        widths = widths.map((value, index) => value - Math.min(shrinkable[index], excess * shrinkable[index] / shrinkTotal));
        excess = widths.reduce((sum, value) => sum + value, 0) - PRINTABLE_TABLE_WIDTH_PX;
      }
    }

    total = widths.reduce((sum, value) => sum + value, 0) || PRINTABLE_TABLE_WIDTH_PX;
    const percentages = widths.map(value => value / total * 100);
    const correction = 100 - percentages.reduce((sum, value) => sum + value, 0);
    percentages[percentages.length - 1] += correction;
    return { percentages, compactColumns };
  }

  function normalizeCell(cell) {
    if (typeof cell === "object" && cell !== null && !Array.isArray(cell)) {
      return {
        html: String(cell.html ?? ""),
        colspan: Math.max(1, Number(cell.colspan) || 1),
        rowspan: Math.max(1, Number(cell.rowspan) || 1),
        skip: Math.max(0, Number(cell.skip) || 0),
        className: String(cell.className || "")
      };
    }
    return { html: String(cell ?? ""), colspan: 1, rowspan: 1, skip: 0, className: "" };
  }

  function renderRow(row, compactColumns, tag = "td") {
    let logicalColumn = 0;
    return `<tr>${row.map(rawCell => {
      const cell = normalizeCell(rawCell);
      if (cell.skip) {
        logicalColumn += cell.skip;
        return "";
      }
      const nowrap = cell.colspan === 1 && compactColumns[logicalColumn] && compactValue(cell.html);
      const classes = [cell.className, nowrap ? "nowrap" : ""].filter(Boolean).join(" ");
      const attributes = `${cell.colspan > 1 ? ` colspan="${cell.colspan}"` : ""}${cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : ""}${classes ? ` class="${esc(classes)}"` : ""}`;
      logicalColumn += cell.colspan;
      return `<${tag}${attributes}>${cell.html}</${tag}>`;
    }).join("")}</tr>`;
  }

  function table(headers, rows, className = "", footerRows = []) {
    const { percentages, compactColumns } = calculateColumnWidths(headers, rows, footerRows);
    const colgroup = `<colgroup>${percentages.map(width => `<col style="width:${width.toFixed(4)}%">`).join("")}</colgroup>`;
    const head = `<thead>${renderRow(headers.map(header => esc(header)), compactColumns, "th")}</thead>`;
    const body = `<tbody>${rows.length ? rows.map(row => renderRow(row, compactColumns)).join("") : `<tr><td colspan="${headers.length}" class="empty">${esc(t("print.noRows"))}</td></tr>`}</tbody>`;
    const foot = footerRows.length ? `<tfoot>${footerRows.map(row => renderRow(row, compactColumns)).join("")}</tfoot>` : "";
    return `<div class="print-table-wrap"><table class="${esc(className)}">${colgroup}${head}${body}${foot}</table></div>`;
  }

  function metadata(items) {
    const visible = items.filter(([, value]) => cleanName(value));
    return visible.length
      ? `<p class="print-meta">${visible.map(([label, value, ltrValue]) => `<strong>${esc(label)}:</strong> ${ltrValue ? bdi(cleanName(value)) : `<span dir="auto">${esc(cleanName(value))}</span>`}`).join(" · ")}</p>`
      : "";
  }

  function settingRows(project) {
    const settings = project?.cuttingSettings || {};
    const rows = [];
    if (cleanName(project?.projectName)) rows.push([t("common.project"), `<span dir="auto">${esc(cleanName(project.projectName))}</span>`]);
    if (cleanName(project?.batchName)) rows.push([t("common.batchName"), `<span dir="auto">${esc(cleanName(project.batchName))}</span>`]);
    rows.push(
      [t("common.toolWidth"), mm(settings.toolWidth)],
      [t("common.startTrim"), mm(settings.trimStart)],
      [t("common.endTrim"), mm(settings.trimEnd)],
      [t("common.reusableMinimum"), mm(settings.reusableMinimumLength)]
    );
    return rows;
  }

  function renderInput(project, heading = t("page.input.title")) {
    const inputs = project?.inputs || {};
    const hasCurrency = Boolean(cleanName(project?.currency));
    const stockRows = (inputs.stockOrders || []).filter(row => [row.profile, row.steelGrade, row.length, row.price].some(value => String(value ?? "").trim()) || row.unlimited);
    const storageRows = (inputs.storageStock || []).filter(row => [row.profile, row.steelGrade, row.length, row.storageArea].some(value => String(value ?? "").trim()));
    const partRows = (inputs.parts || []).filter(row => [row.position, row.steelGrade, row.profile, row.length].some(value => String(value ?? "").trim()));
    const stockHeaders = [t("common.profile"), t("common.steelGrade"), t("common.length"), t("common.quantity")];
    if (hasCurrency) stockHeaders.push(t("common.price"));
    const renderedStockRows = stockRows.map(row => {
      const grade = cleanName(row.steelGrade);
      const allSteelGrades = row.allSteelGrades === true || (row.allSteelGrades !== false && !grade);
      const result = [
        bdi(row.profile || row.profileName || ""),
        allSteelGrades ? esc(t("common.allSteelGrades")) : (grade ? bdi(grade) : "—"),
        mm(row.length),
        (typeof row.unlimited === "boolean" ? row.unlimited : row.availableQuantity == null) ? esc(t("common.unlimited")) : bdi(integer(row.quantity ?? row.availableQuantity))
      ];
      if (hasCurrency) result.push(String(row.price ?? "").trim() === "" ? "—" : formatMoney(row.price, project.currency));
      return result;
    });

    return `<section class="print-major-section print-input-section">
      <h1>${esc(heading)}</h1>
      <h2>${esc(t("page.jobParameters"))}</h2>
      ${table([t("common.parameter"), t("common.value")], settingRows(project), "compact settings-table")}
      <h2>${esc(t("common.stockOrders"))}</h2>
      ${table(stockHeaders, renderedStockRows, `stock-orders-table${hasCurrency ? "" : " no-price"}`)}
      <h2>${esc(t("common.storageStocks"))}</h2>
      ${table(
        [t("common.profile"), t("common.steelGrade"), t("common.length"), t("common.quantity"), t("common.storageArea")],
        storageRows.map(row => [
          bdi(row.profile || row.profileName || ""), bdi(row.steelGrade || ""), mm(row.length),
          bdi(integer(row.quantity)), row.storageArea ? `<span dir="auto">${esc(row.storageArea)}</span>` : "—"
        ]),
        "storage-stock-table"
      )}
      <h2>${esc(t("common.partsToCut"))}</h2>
      ${table(
        [t("common.position"), t("common.steelGrade"), t("common.quantity"), t("common.profile"), t("common.length"), t("common.source")],
        partRows.map(row => [
          bdi(row.position || row.positionId || ""), bdi(row.steelGrade || ""), bdi(integer(row.quantity)),
          bdi(row.profile || row.profileName || ""), mm(row.length), esc(sourceText(row.source))
        ]),
        "parts-table"
      )}
    </section>`;
  }

  function batchMetrics(group) {
    const stock = finite(group.totalStockLengthConsumed);
    const used = finite(group.totalConsumedLength);
    const part = realNumber(group.totalPartLength) ?? used;
    const storage = finite(group.totalStorageStockLengthConsumed);
    const reusable = finite(group.totalReusableOffcutLength);
    const waste = group.totalOffcutLength == null ? Math.max(stock - used, 0) : Math.max(finite(group.totalOffcutLength), 0);
    return { stock, used, part, storage, reusable, waste };
  }

  function groupCost(group, currency) {
    if (!cleanName(currency)) return null;
    let cost = 0;
    for (const order of group.stockOrders || []) {
      const quantity = finite(order.orderQuantity, finite(order.requiredQuantity));
      const price = realNumber(order.unitPrice);
      if (quantity > 0 && price == null) return null;
      cost += quantity * (price || 0);
    }
    return cost;
  }

  function batchTotals(batchResult, hasCost) {
    const result = (batchResult?.groups || []).reduce((total, group) => {
      const metrics = batchMetrics(group);
      total.stock += metrics.stock;
      total.used += metrics.used;
      total.part += metrics.part;
      total.storage += metrics.storage;
      total.reusable += metrics.reusable;
      total.waste += metrics.waste;
      total.storageQuantity += finite(group.storageStockQuantity);
      if (group.weightTon != null && Number.isFinite(Number(group.weightTon))) total.weight += Number(group.weightTon);
      if (hasCost) {
        const cost = groupCost(group, batchResult.currency);
        if (cost == null) total.costKnown = false;
        else total.cost += cost;
      }
      return total;
    }, { stock: 0, used: 0, part: 0, storage: 0, reusable: 0, waste: 0, storageQuantity: 0, weight: 0, required: 0, ordered: 0, cost: 0, costKnown: true });
    const quantities = NcNesting.calculateBatchOrderTotals(batchResult);
    result.required = quantities.orderQuantity;
    result.ordered = quantities.ordered;
    result.leftover = quantities.leftover;
    return result;
  }

  function renderMetricCards(cards) {
    return `<div class="print-metrics">${cards.map(([label, value, note]) => `<div class="print-metric"><small>${esc(label)}</small><strong>${value}</strong>${note ? `<span class="metric-support">${note}</span>` : ""}</div>`).join("")}</div>`;
  }

  function orderQuantityBreakdown(requiredValue, orderedValue) {
    const required = Math.max(0, Math.trunc(finite(requiredValue)));
    const ordered = Math.max(0, Math.trunc(finite(orderedValue, required)));
    const difference = ordered - required;
    if (!difference) return `<span class="print-order-qty" dir="ltr">${bdi(integer(required))}</span>`;
    const stateClass = difference < 0 ? "missing" : "extra";
    const stateLabel = t(difference < 0 ? "common.missing" : "common.extra");
    const operator = difference < 0 ? "−" : "+";
    return `<span class="print-order-qty print-order-qty--${stateClass}" dir="ltr"><span>${bdi(integer(required))}</span><span class="print-order-operator"> ${operator} </span><span>${bdi(integer(Math.abs(difference)))}</span> <span class="print-order-state" dir="auto">${esc(stateLabel)}</span><span class="print-order-operator"> = </span><span>${bdi(integer(ordered))}</span></span>`;
  }

  function renderBatch(batchResult, heading = t("page.batch.title")) {
    const groups = batchResult?.groups || [];
    const hasCost = Boolean(cleanName(batchResult?.currency)) && groups.some(group => (group.stockOrders || []).some(order => realNumber(order.unitPrice) != null));
    const totals = batchTotals(batchResult, hasCost);
    const completeWeight = groups.length > 0 && groups.every(group => group.weightTon != null && Number.isFinite(Number(group.weightTon)));
    const cards = [
      [t("common.stockOrderQuantity"), I18N.inlineNumberHtml(totals.ordered, { maximumFractionDigits: 0 }, printLanguage), I18N.summaryOrderSupportHtml(totals.required, totals.ordered, printLanguage)],
      [t("common.utilization"), bdi(I18N.summaryPercentageText(NcNestingUtilization.optimisticPercentage(totals.part, totals.waste), printLanguage)), I18N.supportingTextHtml("batch.consumedLength", { length: I18N.summaryLengthHtml(totals.part, printLanguage) }, printLanguage)],
      [t("common.waste"), bdi(I18N.summaryPercentageText(NcNestingUtilization.optimisticWastePercentage(totals.part, totals.waste), printLanguage)), I18N.supportingTextHtml("batch.offcutLength", { length: I18N.summaryLengthHtml(totals.waste, printLanguage) }, printLanguage)]
    ];
    if (completeWeight) cards.push([t("common.batchWeight"), I18N.summaryWeightHtml(totals.weight, printLanguage), I18N.supportingTextHtml("batch.groupCount", { count: I18N.inlineNumberHtml(groups.length, { maximumFractionDigits: 0 }, printLanguage) }, printLanguage)]);
    cards.push(
      [t("common.storageStockShare"), bdi(I18N.summaryPercentageText(percent(totals.storage, totals.stock), printLanguage)), I18N.supportingTextHtml("batch.storageLength", { length: I18N.summaryLengthHtml(totals.storage, printLanguage) }, printLanguage)],
      [t("common.reusableReturned"), bdi(I18N.summaryPercentageText(percent(totals.reusable, totals.stock), printLanguage)), I18N.supportingTextHtml("batch.reusableLength", { length: I18N.summaryLengthHtml(totals.reusable, printLanguage) }, printLanguage)]
    );

    const headers = [t("common.nestingGroup"), t("common.length"), t("common.utilization"), t("common.waste"), t("common.weight")];
    if (hasCost) headers.push(t("common.cost"));
    headers.push(t("common.orderQty"));
    const rows = [];
    groups.forEach(group => {
      const metrics = batchMetrics(group);
      const orders = group.stockOrders?.length ? group.stockOrders : [{ stockTypeId: "No stock order", requiredQuantity: 0, orderQuantity: 0, stockLength: null }];
      const cost = groupCost(group, batchResult.currency);
      orders.forEach((order, index) => {
        const required = finite(order.requiredQuantity);
        const row = index === 0
          ? [
              { html: `<strong>${bdi(group.profileName || "")}</strong><br><span class="muted">${bdi(group.steelGrade || "")}</span>`, rowspan: orders.length, className: "group-cell" },
              order.stockLength == null ? "—" : mm(order.stockLength),
              { html: bdi(percentText(NcNestingUtilization.optimisticPercentage(metrics.part, metrics.waste))), rowspan: orders.length, className: "group-cell" },
              { html: bdi(percentText(NcNestingUtilization.optimisticWastePercentage(metrics.part, metrics.waste))), rowspan: orders.length, className: "group-cell" },
              { html: group.weightTon != null && Number.isFinite(Number(group.weightTon)) ? ton(group.weightTon) : "—", rowspan: orders.length, className: "group-cell" }
            ]
          : [
              { skip: 1 },
              order.stockLength == null ? "—" : mm(order.stockLength),
              { skip: 3 }
            ];
        if (hasCost) {
          if (index === 0) row.push({ html: cost == null ? "—" : formatMoney(cost, batchResult.currency), rowspan: orders.length, className: "group-cell" });
          else row.push({ skip: 1 });
        }
        row.push({ html: orderQuantityBreakdown(required, order.orderQuantity), className: "order-qty-cell" });
        rows.push(row);
      });
    });
    const totalRow = [
      { html: esc(t("common.batchTotalWeighted")), colspan: 2, className: "total-label" },
      bdi(percentText(NcNestingUtilization.optimisticPercentage(totals.part, totals.waste))),
      bdi(percentText(NcNestingUtilization.optimisticWastePercentage(totals.part, totals.waste))),
      completeWeight ? ton(totals.weight) : "—"
    ];
    if (hasCost) totalRow.push(totals.costKnown ? formatMoney(totals.cost, batchResult.currency) : "—");
    totalRow.push({ html: orderQuantityBreakdown(totals.required, totals.ordered), className: "order-qty-cell" });

    return `<section class="print-major-section print-batch-section">
      <h1>${esc(heading)}</h1>
      ${metadata([
        [t("common.project"), batchResult?.projectName, false],
        [t("common.batchName"), batchResult?.batchName, false],
        [t("common.generated"), batchResult?.generatedAt ? I18N.formatDateTime(batchResult.generatedAt, {}, printLanguage) : "", true],
        [t("common.currency"), batchResult?.currency ? I18N.currencyLabel(batchResult.currency, printLanguage) : "", false]
      ])}
      ${renderMetricCards(cards)}
      <h2>${esc(t("page.batchGroups"))}</h2>
      ${table(headers, rows, `batch-table${hasCost ? " has-cost" : ""}`, [totalRow])}
    </section>`;
  }

  function segmentType(segment) {
    const raw = String(segment.type || segment.segmentType || "").replace(/[\s_-]/g, "").toLowerCase();
    const aliases = {
      starttrim: "StartTrim", trimstart: "StartTrim", toolcut: "ToolCut", toolwidthcut: "ToolCut", kerf: "ToolCut",
      part: "Part", nestedpart: "Part", finishedpart: "Part", reusableoffcut: "ReusableOffcut",
      nonreusableoffcut: "NonReusableOffcut", scrapoffcut: "NonReusableOffcut", endtrim: "EndTrim", trimend: "EndTrim"
    };
    if (raw === "offcut") return segment.isReusable ? "ReusableOffcut" : "NonReusableOffcut";
    return aliases[raw] || segment.type || segment.segmentType || "Unknown";
  }

  function canonicalPrintSegments(rawSegments, stockLength, settings) {
    const segments = (rawSegments || []).map(segment => ({
      ...segment,
      type: segmentType(segment),
      length: finite(segment.length),
      partId: segment.partId || segment.id || segment.label || null
    }));
    const looksLegacy = segments[0]?.type === "StartTrim" && segments[1]?.type === "ToolCut";
    if (!looksLegacy || !Geometry?.buildSegments || !Number.isFinite(Number(stockLength))) return segments;
    const parts = segments.filter(segment => segment.type === "Part");
    if (!parts.length) return segments;
    try {
      return Geometry.buildSegments(parts, Number(stockLength), settings)?.segments || segments;
    } catch (_error) {
      return segments;
    }
  }

  function normalizedPiece(piece, settings) {
    const segments = canonicalPrintSegments(piece.segments || piece.layoutSegments || [], piece.stockLength, settings);
    const parts = segments.filter(segment => segment.type === "Part");
    const offcut = segments.find(segment => segment.type === "ReusableOffcut" || segment.type === "NonReusableOffcut");
    const partLength = parts.reduce((sum, segment) => sum + segment.length, 0);
    const cutLength = segments.filter(segment => segment.type === "ToolCut").reduce((sum, segment) => sum + segment.length, 0);
    const stockLength = finite(piece.stockLength);
    const netOffcut = finite(offcut?.length);
    return {
      ...piece,
      stockSource: piece.stockSource === "RegularStock" ? "StockOrder" : piece.stockSource,
      segments,
      parts,
      partLength,
      cutLength,
      consumed: Math.max(0, stockLength - netOffcut),
      offcut: netOffcut,
      reusable: netOffcut > 0 && offcut?.type === "ReusableOffcut"
    };
  }

  function sortedPieces(plan) {
    const settings = { unit: "mm", ...(plan?.settings || plan?.cuttingSettings || {}) };
    return (plan?.stockPieces || []).map(piece => normalizedPiece(piece, settings));
  }

  function segmentLabel(segment) {
    switch (segment.type) {
      case "StartTrim": return [t("common.startTrim"), "trim start-trim"];
      case "EndTrim": return [t("common.endTrim"), "trim end-trim"];
      case "ToolCut": return ["", "tool-cut"];
      case "Part": return [segment.partId || t("common.parts"), "part"];
      case "ReusableOffcut": return [t("common.reusable"), "reusable"];
      case "NonReusableOffcut": return [t("common.nonReusable"), "non-reusable"];
      default: return [t("common.unknown"), "unknown"];
    }
  }

  function renderPrintLegend() {
    const items = [
      ["part", t("common.actualPart")],
      ["trim", t("common.startEndTrim")],
      ["tool-cut", t("common.toolWidthCut")],
      ["reusable", t("common.reusableLeftover")],
      ["non-reusable", t("common.nonReusableWaste")]
    ];
    return `<div class="print-legend" aria-label="${esc(t("common.cuttingPlanLegend"))}">${items.map(([className, label]) => `<div class="print-legend-item"><span class="print-legend-swatch ${className}"></span><span>${esc(label)}</span></div>`).join("")}</div>`;
  }

  function layoutDisplayName(layout) {
    const quantity = layout.quantity > 1 ? ` × ${integer(layout.quantity)}` : "";
    return `${layout.layoutName}${quantity}`;
  }

  function printSegmentWeight(segment, partVisualTotal = 0) {
    const length = Math.max(0, finite(segment.length));
    if (length <= 0) return 0;
    switch (segment.type) {
      case "StartTrim":
      case "EndTrim": return 1;
      case "ReusableOffcut":
      case "NonReusableOffcut": return length;
      case "Part": return Math.max(length, 1100);
      case "ToolCut": return 1;
      default: return length;
    }
  }

  function printOffcutContent(segment, label) {
    if (!(finite(segment.length) > 0)) return "";
    const reusable = segment.type === "ReusableOffcut";
    const labelClass = reusable ? "print-offcut-label--reusable" : "print-offcut-label--non-reusable";
    return `<span class="print-offcut-label ${labelClass}">
      <strong class="print-offcut-full-label">${esc(label)}</strong>
      <small class="print-offcut-measurement">${mm(segment.length)}</small>
    </span>`;
  }

  function printTrimContent(segment) {
    return `<span class="print-trim-label"><small class="print-trim-measurement">${mm(segment.length)}</small></span>`;
  }

  function printKerfWidthMm(segments) {
    const visibleKerfs = Math.max(1, segments.filter(segment => segment.type === "ToolCut" && finite(segment.length) > 0).length);
    return Math.max(.25, Math.min(.8, 20 / visibleKerfs));
  }

  function renderPrintSegments(segments, toolWidth) {
    const partVisualTotal = segments
      .filter(segment => segment.type === "Part")
      .reduce((sum, segment) => sum + printSegmentWeight(segment), 0);
    const markup = [];
    for (const segment of segments) {
      if (segment.type === "ToolCut" && !(finite(segment.length) > 0)) continue;
      if (["ReusableOffcut", "NonReusableOffcut"].includes(segment.type) && !(finite(segment.length) > 0)) continue;

      const [label, className] = segmentLabel(segment);
      const flexWeight = printSegmentWeight(segment, partVisualTotal);
      const title = `${label || t("common.toolCut")} ${mmText(segment.length)}`;
      let text = "";
      if (segment.type === "StartTrim" || segment.type === "EndTrim") {
        text = printTrimContent(segment);
      } else if (segment.type === "Part") {
        text = `<span><strong>${bdi(label)}</strong><small>${mm(segment.length)}</small></span>`;
      } else if (segment.type === "ReusableOffcut" || segment.type === "NonReusableOffcut") {
        text = printOffcutContent(segment, label);
      }
      const boundaryKerf = ["StartTrim", "EndTrim"].includes(segment.type) && Number(toolWidth) > 0 ? " has-boundary-kerf" : "";
      markup.push(`<div class="print-segment ${className}${boundaryKerf}" style="flex-grow:${flexWeight};flex-basis:0" title="${esc(title)}" aria-label="${esc(title)}">${text}</div>`);
    }
    return markup.join("");
  }

  function renderPiece(layout, settings) {
    const source = layout.stockSource === "StorageStock" ? t("common.storageStock") : t("common.stockOrder");
    const segmentMarkup = renderPrintSegments(layout.segments, settings?.toolWidth);
    const kerfWidth = printKerfWidthMm(layout.segments);
    const retrievalIds = layout.storageRecordIds.length ? layout.storageRecordIds.join(", ") : "—";
    const retrieval = layout.stockSource === "StorageStock"
      ? `${t("plan.retrieve", { id: I18N.isolate(retrievalIds) })}: ${layout.storageArea ? t("plan.retrieveArea", { area: I18N.isolate(layout.storageArea) }) : t("plan.unspecifiedArea")}. `
      : "";
    const description = I18N.supportingTextHtml("plan.pieceDescription", {
      partLength: mm(layout.partLength),
      cutLength: mm(layout.cutLength),
      consumed: mm(layout.consumed),
      offcut: mm(layout.offcut),
      status: esc(t(layout.reusable ? "common.reusableLower" : "common.nonReusableLower"))
    }, printLanguage);
    return `<article class="print-piece">
      <div class="print-piece-heading"><strong>${bdi(layoutDisplayName(layout))}</strong><span>${esc(source)} · ${mm(layout.stockLength)} · ${bdi(percentText(NcNestingUtilization.optimisticPercentage(layout.partLength, layout.offcut)))} ${esc(t("common.utilization"))}</span></div>
      <div class="print-stock-bar" dir="ltr" style="--print-kerf-display-width:${kerfWidth.toFixed(4)}mm">${segmentMarkup}</div>
      <p>${esc(retrieval)}${description}</p>
    </article>`;
  }

  function planTotals(plan, pieces) {
    const source = plan?.totals || {};
    const stock = realNumber(source.totalStockLengthConsumed) ?? pieces.reduce((sum, piece) => sum + finite(piece.stockLength), 0);
    const consumed = realNumber(source.totalConsumedLength) ?? pieces.reduce((sum, piece) => sum + piece.consumed, 0);
    const part = realNumber(source.totalPartLength) ?? pieces.reduce((sum, piece) => sum + piece.partLength, 0);
    const offcut = realNumber(source.totalOffcutLength) ?? pieces.reduce((sum, piece) => sum + piece.offcut, 0);
    const storage = realNumber(source.totalStorageStockLengthConsumed) ?? pieces.filter(piece => piece.stockSource === "StorageStock").reduce((sum, piece) => sum + finite(piece.stockLength), 0);
    const reusable = realNumber(source.totalReusableOffcutLength) ?? pieces.filter(piece => piece.reusable).reduce((sum, piece) => sum + piece.offcut, 0);
    return { stock, consumed, part, offcut, storage, reusable };
  }


  function sourceValues(record, stockSource, layouts) {
    const usage = Layouts.usageForRecord(layouts, record, stockSource);
    const matched = usage.matched;
    const id = stockSource === "StorageStock"
      ? (record.storageStockId || record.groupedStorageStockId || record.stockTypeId)
      : (record.stockOrderId || record.stockTypeId);
    const length = realNumber(record.stockLength ?? record.length)
      ?? (matched.length === 1 ? matched[0].stockLength : null);
    const explicitQuantity = realNumber(stockSource === "StorageStock" ? record.quantity : record.selectedPieceCount);
    const quantity = explicitQuantity ?? usage.quantity;
    let totalStockLength = realNumber(stockSource === "StorageStock" ? record.totalRetrievedStockLength : record.selectedStockLength);
    if (totalStockLength == null) totalStockLength = usage.totalStockLength;
    if (totalStockLength == null && quantity != null && length != null) totalStockLength = quantity * length;
    const explicitPartLength = realNumber(stockSource === "StorageStock" ? record.totalPartLength : record.selectedPartLength);
    const partLength = explicitPartLength ?? usage.totalPartLength;
    const suppliedWaste = realNumber(record.wasteLength ?? record.totalWasteLength);
    const wasteLength = suppliedWaste ?? usage.totalOffcutLength;
    const utilization = partLength != null && Number.isFinite(wasteLength)
      ? NcNestingUtilization.optimisticPercentage(partLength, wasteLength)
      : Number.NaN;
    return { id, length, quantity, utilization, wasteLength, matched };
  }

  function renderSourceSummaries(plan, layouts) {
    const orders = (plan.stockOrderOptions || []).filter(order => {
      const count = realNumber(order.selectedPieceCount);
      return count != null
        ? count > 0
        : Layouts.layoutsForRecord(layouts, order, "StockOrder").length > 0;
    });
    const storage = plan.storageRetrievals || [];
    const orderRows = orders.map(order => {
      const values = sourceValues(order, "StockOrder", layouts);
      return [
        values.quantity == null ? "—" : bdi(integer(values.quantity)),
        mm(values.length),
        bdi(percentText(values.utilization))
      ];
    });
    const storageRows = storage.map(record => {
      const values = sourceValues(record, "StorageStock", layouts);
      return [
        record.storageArea ? `<span dir="auto">${esc(record.storageArea)}</span>` : "—",
        values.quantity == null ? "—" : bdi(integer(values.quantity)),
        mm(values.length),
        bdi(percentText(values.utilization))
      ];
    });
    return `<section class="print-source-section"><h2>${esc(t("common.stockOrders"))}</h2>${table([t("common.quantity"), t("common.length"), t("common.utilization")], orderRows, "compact stock-orders-table")}</section><section class="print-source-section"><h2>${esc(t("common.storageRetrievals"))}</h2>${table([t("common.area"), t("common.quantity"), t("common.length"), t("common.utilization")], storageRows, "compact")}</section>`;
  }

  function wasteSourceText(row) {
    return row.stockSource === "StorageStock"
      ? `${t("common.storage")}${row.storageArea ? ` · ${row.storageArea}` : ""}`
      : t("common.stockOrder");
  }

  function wasteLayoutCell(row) {
    const names = row.layoutNames.length ? row.layoutNames : ["—"];
    return `<span class="waste-layout-names">${names.map((name, index) => `<span class="waste-layout-name">${bdi(name)}${index < names.length - 1 ? '<span class="waste-layout-separator">,</span>' : ""}</span>`).join("")}</span>`;
  }

  function renderPlan(plan, identity = {}) {
    const pieces = sortedPieces(plan);
    const layouts = Layouts.groupPieces(pieces);
    const totals = planTotals(plan, pieces);
    const usage = Layouts.aggregateUsage(layouts);
    if (usage.totalStockLength > 0) {
      totals.stock = usage.totalStockLength;
      totals.consumed = usage.totalConsumedLength;
      totals.part = usage.totalPartLength;
      totals.offcut = usage.totalOffcutLength;
    }
    const settings = { unit: "mm", ...(plan.settings || plan.cuttingSettings || {}) };
    const profileName = identity.profileName || plan.profileName || "";
    const steelGrade = identity.steelGrade || plan.steelGrade || "";
    const projectName = cleanName(identity.projectName || plan.projectName);
    const batchName = cleanName(identity.batchName || plan.batchName);
    const summaryHeading = `${profileName} · ${steelGrade} · ${t("page.cutPlanSummary")}`;
    const diagramHeading = `${profileName} · ${steelGrade} · ${t("page.cuttingPlanDiagram")}`;
    const metrics = [
      [t("common.utilization"), bdi(I18N.summaryPercentageText(NcNestingUtilization.optimisticPercentage(totals.part, totals.offcut), printLanguage)), I18N.supportingTextHtml("plan.includesParts", { length: I18N.summaryLengthHtml(totals.part, printLanguage) }, printLanguage)],
      [t("common.totalOffcut"), bdi(I18N.summaryPercentageText(NcNestingUtilization.optimisticWastePercentage(totals.part, totals.offcut), printLanguage)), I18N.supportingTextHtml("plan.totalOffcutNote", { length: I18N.summaryLengthHtml(totals.offcut, printLanguage) }, printLanguage)],
      [t("common.storageStockShare"), bdi(I18N.summaryPercentageText(percent(totals.storage, totals.stock), printLanguage)), I18N.supportingTextHtml("plan.consumedStorageNote", { length: I18N.summaryLengthHtml(totals.storage, printLanguage) }, printLanguage)],
      [t("common.reusableReturned"), bdi(I18N.summaryPercentageText(percent(totals.reusable, totals.stock), printLanguage)), I18N.supportingTextHtml("plan.reusableNote", { length: I18N.summaryLengthHtml(totals.reusable, printLanguage) }, printLanguage)]
    ];
    const wasteRows = Layouts.aggregateWasteRows(layouts).map(row => [
      `<span dir="auto">${esc(wasteSourceText(row))}</span>`,
      wasteLayoutCell(row),
      mm(row.stockLength),
      bdi(percentText(row.utilization)),
      bdi(integer(row.quantity)),
      mm(row.offcut),
      `<span dir="auto">${esc(t(row.reusable ? "common.reusable" : "common.nonReusable"))}</span>`
    ]);
    const nameMeta = metadata([[t("common.project"), projectName, false], [t("common.batchName"), batchName, false]]);

    return `<section class="print-major-section print-plan-summary-section">
      <h1><span dir="ltr">${esc(profileName)} · ${esc(steelGrade)}</span> · ${esc(t("page.cutPlanSummary"))}</h1>
      ${nameMeta}
      <p class="print-meta">${esc(t("common.toolWidth"))}: <strong>${mm(settings.toolWidth)}</strong> · ${esc(t("common.startTrim"))}: <strong>${mm(settings.trimStart)}</strong> · ${esc(t("common.endTrim"))}: <strong>${mm(settings.trimEnd)}</strong> · ${esc(t("common.reusableMinimum"))}: <strong>${mm(settings.reusableMinimumLength)}</strong></p>
      <h2>${esc(t("common.planSummary"))}</h2>${renderMetricCards(metrics)}
      ${renderSourceSummaries(plan, layouts)}
      <h2>${esc(t("common.wasteList"))}</h2>${table([t("common.source"), t("common.layout"), t("common.stockLength"), t("common.utilization"), t("common.quantity"), t("common.offcutLength"), t("common.status")], wasteRows, "compact waste-table")}
    </section>
    <section class="print-major-section print-plan-diagram-section">
      <h1><span dir="ltr">${esc(profileName)} · ${esc(steelGrade)}</span> · ${esc(t("page.cuttingPlanDiagram"))}</h1>
      ${nameMeta}
      ${layouts.length ? layouts.map(layout => renderPiece(layout, settings)).join("") : `<p>${esc(t("plan.noPieces"))}</p>`}
      ${renderPrintLegend()}
    </section>`;
  }

  function printPageStyle(startedAt, qrUrl, language) {
    const timestamp = I18N.formatDateTime(startedAt, {}, language);
    const pagePrefix = I18N.t("print.page", { number: "" }, language);
    return `<style id="print-page-style">
      @page {
        size: A4 portrait;
        margin: 30mm 7.5mm 15mm;
        @top-left { content: "${cssString(timestamp)}"; font: 700 10pt/1.15 Arial, Helvetica, sans-serif; color: #111; text-align: left; vertical-align: middle; }
        @top-center { content: "https://bim-bee.github.io/nc_nesting"; font: 700 10pt/1.15 Arial, Helvetica, sans-serif; color: #111; text-align: center; vertical-align: middle; }
        @top-right { content: url("${cssString(qrUrl)}"); text-align: right; vertical-align: middle; }
        @bottom-center { content: "${cssString(pagePrefix)}" counter(page); font: 9pt/1 Arial, Helvetica, sans-serif; color: #505866; }
      }
    </style>`;
  }

  async function waitForImages(printDocument, language) {
    const images = [...printDocument.images];
    await Promise.all(images.map(image => {
      if (image.complete) return image.naturalWidth > 0 ? Promise.resolve() : Promise.reject(new Error(I18N.t("error.printImage", {}, language)));
      return new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", () => reject(new Error(I18N.t("error.printImage", {}, language))), { once: true });
      });
    }));
  }

  let activePrintJob = null;

  function writePrintDocument(title, body, language) {
    if (activePrintJob) return activePrintJob;
    const capturedLanguage = I18N.normalizeLanguage(language) || "en";
    const direction = I18N.direction(capturedLanguage);
    activePrintJob = new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.tabIndex = -1;
      Object.assign(iframe.style, { position: "fixed", left: "-10000px", top: "0", width: "1px", height: "1px", border: "0", pointerEvents: "none" });
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        iframe.remove();
      };
      iframe.onload = async () => {
        try {
          const printWindow = iframe.contentWindow;
          const printDocument = iframe.contentDocument;
          if (!printWindow || !printDocument) throw new Error(I18N.t("error.printSurface", {}, capturedLanguage));
          if (printDocument.fonts?.ready) await printDocument.fonts.ready;
          await waitForImages(printDocument, capturedLanguage);
          await new Promise(done => printWindow.requestAnimationFrame(() => printWindow.requestAnimationFrame(done)));
          printWindow.addEventListener("afterprint", cleanup, { once: true });
          printWindow.focus();
          printWindow.print();
          if (!cleaned) printWindow.setTimeout(cleanup, 0);
          resolve();
        } catch (error) {
          cleanup();
          reject(error);
        }
      };
      const stylesheet = new URL("styles/print.css", window.location.href).href;
      const qrUrl = new URL("nc_nesting_qr_print.svg", window.location.href).href;
      const startedAt = new Date();
      iframe.srcdoc = `<!doctype html><html lang="${capturedLanguage}" dir="${direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="${esc(stylesheet)}">${printPageStyle(startedAt, qrUrl, capturedLanguage)}</head><body><img class="print-resource-preload" src="${esc(qrUrl)}" alt=""><main class="print-document">${body}</main></body></html>`;
      document.body.appendChild(iframe);
    }).finally(() => { activePrintJob = null; });
    return activePrintJob;
  }

  function beginPrintLanguage() {
    printLanguage = I18N.getLanguage();
    return printLanguage;
  }

  function plansById(plans) {
    if (Array.isArray(plans)) return new Map(plans.map(plan => [plan.groupId || plan.id, plan]));
    return new Map(Object.entries(plans || {}).map(([groupId, plan]) => [groupId, { groupId, ...plan }]));
  }

  function printInput(project) {
    const language = beginPrintLanguage();
    return writePrintDocument(t("page.input.title"), renderInput(project), language);
  }

  function printBatchPage(batchResult) {
    const language = beginPrintLanguage();
    return writePrintDocument(t("page.batch.title"), renderBatch(batchResult), language);
  }

  function printPlanPage(plan) {
    const language = beginPrintLanguage();
    return writePrintDocument(t("page.plan.main"), renderPlan(plan), language);
  }

  function printFullSet(calculation) {
    const language = beginPrintLanguage();
    const project = calculation?.project || {};
    const batchResult = {
      ...(calculation?.batchResult || {}),
      projectName: cleanName(calculation?.batchResult?.projectName || project.projectName),
      batchName: cleanName(calculation?.batchResult?.batchName || project.batchName),
      currency: cleanName(project.currency || calculation?.batchResult?.currency) || null
    };
    const planMap = plansById(calculation?.plans);
    const planSections = (batchResult.groups || []).map(group => {
      const plan = planMap.get(group.groupId);
      const identity = {
        profileName: group.profileName || plan?.profileName || "",
        steelGrade: group.steelGrade || plan?.steelGrade || "",
        projectName: batchResult.projectName,
        batchName: batchResult.batchName
      };
      const profileGrade = `<span dir="ltr">${esc(identity.profileName)} · ${esc(identity.steelGrade)}</span>`;
      return plan
        ? renderPlan({ ...plan, currency: batchResult.currency, projectName: batchResult.projectName, batchName: batchResult.batchName }, identity)
        : `<section class="print-major-section print-plan-summary-section"><h1>${profileGrade} · ${esc(t("page.cutPlanSummary"))}</h1>${metadata([[t("common.project"), identity.projectName, false], [t("common.batchName"), identity.batchName, false]])}<p>${esc(t("plan.unavailable"))}</p></section><section class="print-major-section print-plan-diagram-section"><h1>${profileGrade} · ${esc(t("page.cuttingPlanDiagram"))}</h1>${metadata([[t("common.project"), identity.projectName, false], [t("common.batchName"), identity.batchName, false]])}<p>${esc(t("plan.unavailable"))}</p>${renderPrintLegend()}</section>`;
    }).join("");
    const body = `${renderInput(project)}${renderBatch(batchResult)}${planSections}`;
    const titleName = batchResult.batchName || batchResult.projectName || t("page.fullCalculation");
    return writePrintDocument(`${t("common.ncNesting")} — ${titleName}`, body, language);
  }

  window.NcNestingPrint = Object.freeze({
    printInput,
    printBatchPage,
    printPlanPage,
    printFullSet,
    renderInput,
    renderBatch,
    renderPlan
  });
})();
