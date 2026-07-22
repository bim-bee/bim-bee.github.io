(function () {
  "use strict";

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const cssString = value => String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replace(/[\r\n]+/g, " ");
  const numberFormat = new Intl.NumberFormat();
  const decimalFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const number = value => numberFormat.format(Number(value) || 0);
  const decimal = value => decimalFormat.format(Number(value) || 0);

  function realNumber(value) {
    if (value == null || (typeof value === "string" && !value.trim())) return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }

  const finite = (value, fallback = 0) => realNumber(value) ?? fallback;
  const percent = (value, total) => Number.isFinite(value) && Number.isFinite(total) && total > 0 ? value / total * 100 : Number.NaN;
  const percentText = value => Number.isFinite(value) ? `${decimal(value)}%` : "—";
  const mm = value => realNumber(value) == null ? "—" : `${number(value)} mm`;
  const metres = value => realNumber(value) == null ? "—" : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value) / 1000)} m`;
  const cleanName = value => String(value || "").trim();
  const generatedOrderId = value => /^Stock-[A-Z]+$/i.test(String(value || "").trim())
    ? String(value).trim().replace(/^Stock-/i, "Order-")
    : String(value || "").trim();
  const orderId = row => String(row.stockId || row.stockOrderId || "").trim() || generatedOrderId(row.generatedId) || "—";
  const storageId = row => String(row.storageId || row.storageStockId || "").trim() || String(row.generatedId || "").trim() || "—";
  const currencyCodes = { "Israeli New Shekel": "ILS", "US Dollar": "USD", "Euro": "EUR", "Chinese Yuan (CNY)": "CNY" };

  function formatMoney(value, currency) {
    const amount = realNumber(value);
    const name = cleanName(currency);
    if (amount == null || !name) return "—";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currencyCodes[name] || name,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(amount);
    } catch {
      return `${number(amount)} ${name}`;
    }
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
    return typeof cell === "object" && cell !== null && !Array.isArray(cell)
      ? { html: String(cell.html ?? ""), colspan: Math.max(1, Number(cell.colspan) || 1), className: String(cell.className || "") }
      : { html: String(cell ?? ""), colspan: 1, className: "" };
  }

  function renderRow(row, compactColumns, tag = "td") {
    let logicalColumn = 0;
    return `<tr>${row.map(rawCell => {
      const cell = normalizeCell(rawCell);
      const nowrap = cell.colspan === 1 && compactColumns[logicalColumn] && compactValue(cell.html);
      const classes = [cell.className, nowrap ? "nowrap" : ""].filter(Boolean).join(" ");
      const attributes = `${cell.colspan > 1 ? ` colspan="${cell.colspan}"` : ""}${classes ? ` class="${esc(classes)}"` : ""}`;
      logicalColumn += cell.colspan;
      return `<${tag}${attributes}>${cell.html}</${tag}>`;
    }).join("")}</tr>`;
  }

  function table(headers, rows, className = "", footerRows = []) {
    const { percentages, compactColumns } = calculateColumnWidths(headers, rows, footerRows);
    const colgroup = `<colgroup>${percentages.map(width => `<col style="width:${width.toFixed(4)}%">`).join("")}</colgroup>`;
    const head = `<thead>${renderRow(headers.map(header => esc(header)), compactColumns, "th")}</thead>`;
    const body = `<tbody>${rows.length ? rows.map(row => renderRow(row, compactColumns)).join("") : `<tr><td colspan="${headers.length}" class="empty">No rows</td></tr>`}</tbody>`;
    const foot = footerRows.length ? `<tfoot>${footerRows.map(row => renderRow(row, compactColumns)).join("")}</tfoot>` : "";
    return `<div class="print-table-wrap"><table class="${esc(className)}">${colgroup}${head}${body}${foot}</table></div>`;
  }

  function metadata(items) {
    const visible = items.filter(([, value]) => cleanName(value));
    return visible.length
      ? `<p class="print-meta">${visible.map(([label, value]) => `<strong>${esc(label)}:</strong> ${esc(cleanName(value))}`).join(" · ")}</p>`
      : "";
  }

  function settingRows(project) {
    const settings = project?.cuttingSettings || {};
    const rows = [];
    if (cleanName(project?.projectName)) rows.push(["Project", esc(cleanName(project.projectName))]);
    if (cleanName(project?.batchName)) rows.push(["Batch name", esc(cleanName(project.batchName))]);
    rows.push(
      ["Tool width", mm(settings.toolWidth)],
      ["Start trim", mm(settings.trimStart)],
      ["End trim", mm(settings.trimEnd)],
      ["Reusable minimum", mm(settings.reusableMinimumLength)]
    );
    if (cleanName(project?.currency)) rows.push(["Currency", esc(project.currency)]);
    return rows;
  }

  function renderInput(project, heading = "NC Nesting Input Page") {
    const inputs = project?.inputs || {};
    const hasCurrency = Boolean(cleanName(project?.currency));
    const stockRows = (inputs.stockOrders || []).filter(row => [row.stockId, row.profile, row.steelGrade, row.length, row.price].some(value => String(value ?? "").trim()) || row.unlimited);
    const storageRows = (inputs.storageStock || []).filter(row => [row.storageId, row.profile, row.steelGrade, row.length, row.storageArea].some(value => String(value ?? "").trim()));
    const partRows = (inputs.parts || []).filter(row => [row.position, row.steelGrade, row.profile, row.length].some(value => String(value ?? "").trim()));
    const stockHeaders = ["Stock order ID", "Profile", "Steel grade", "Length", "Quantity"];
    if (hasCurrency) stockHeaders.push(`Price (${project.currency})`);
    const renderedStockRows = stockRows.map(row => {
      const result = [
        esc(orderId(row)),
        esc(row.profile || row.profileName || ""),
        esc(row.steelGrade || ""),
        esc(mm(row.length)),
        (typeof row.unlimited === "boolean" ? row.unlimited : row.availableQuantity == null) ? "Unlimited" : esc(number(row.quantity ?? row.availableQuantity))
      ];
      if (hasCurrency) result.push(String(row.price ?? "").trim() === "" ? "—" : esc(formatMoney(row.price, project.currency)));
      return result;
    });

    return `<section class="print-major-section print-input-section">
      <h1>${esc(heading)}</h1>
      <h2>Job parameters</h2>
      ${table(["Parameter", "Value"], settingRows(project).map(([label, value]) => [esc(label), value]), "compact settings-table")}
      <h2>Stock orders</h2>
      ${table(stockHeaders, renderedStockRows, `stock-orders-table${hasCurrency ? "" : " no-price"}`)}
      <h2>Storage stocks</h2>
      ${table(
        ["Storage ID", "Profile", "Steel grade", "Length", "Quantity", "Storage area"],
        storageRows.map(row => [
          esc(storageId(row)), esc(row.profile || row.profileName || ""), esc(row.steelGrade || ""), esc(mm(row.length)),
          esc(number(row.quantity)), esc(row.storageArea || "—")
        ]),
        "storage-stock-table"
      )}
      <h2>Parts to cut</h2>
      ${table(
        ["Position", "Steel grade", "Quantity", "Profile", "Length", "Source"],
        partRows.map(row => [
          esc(row.position || row.positionId || ""), esc(row.steelGrade || ""), esc(number(row.quantity)),
          esc(row.profile || row.profileName || ""), esc(mm(row.length)), esc(String(row.source || "Manual").trim() || "Manual")
        ]),
        "parts-table"
      )}
    </section>`;
  }

  function batchMetrics(group) {
    const stock = finite(group.totalStockLengthConsumed);
    const used = finite(group.totalConsumedLength);
    const storage = finite(group.totalStorageStockLengthConsumed);
    const reusable = finite(group.totalReusableOffcutLength);
    const waste = group.totalOffcutLength == null ? Math.max(stock - used, 0) : Math.max(finite(group.totalOffcutLength), 0);
    return { stock, used, storage, reusable, waste };
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
    }, { stock: 0, used: 0, storage: 0, reusable: 0, waste: 0, storageQuantity: 0, weight: 0, required: 0, ordered: 0, cost: 0, costKnown: true });
    const quantities = NcNesting.calculateBatchOrderTotals(batchResult);
    result.required = quantities.orderQuantity;
    result.ordered = quantities.ordered;
    result.leftover = quantities.leftover;
    return result;
  }

  function renderMetricCards(cards) {
    return `<div class="print-metrics">${cards.map(([label, value, note]) => `<div class="print-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(note)}</span></div>`).join("")}</div>`;
  }

  function renderBatch(batchResult, heading = "NC Nesting Batch Result") {
    const groups = batchResult?.groups || [];
    const hasCost = Boolean(cleanName(batchResult?.currency)) && groups.some(group => (group.stockOrders || []).some(order => realNumber(order.unitPrice) != null));
    const totals = batchTotals(batchResult, hasCost);
    const completeWeight = groups.length > 0 && groups.every(group => group.weightTon != null && Number.isFinite(Number(group.weightTon)));
    const cards = [
      ["Stock order quantity", number(totals.ordered), `${number(totals.required)} required`],
      ["Utilization", percentText(percent(totals.used, totals.stock)), `${metres(totals.used)} consumed`],
      ["Waste", percentText(percent(totals.waste, totals.stock)), `${metres(totals.waste)} offcut`]
    ];
    if (completeWeight) cards.push(["Batch weight", `${decimal(totals.weight)} t`, `${number(groups.length)} nesting groups`]);
    cards.push(
      ["Storage stock share", percentText(percent(totals.storage, totals.stock)), `${metres(totals.storage)} from storage`],
      ["Reusable returned", percentText(percent(totals.reusable, totals.stock)), `${metres(totals.reusable)} reusable`]
    );

    const headers = ["Nesting group", "Stock order ID", "Length", "Utilization", "Waste", "Weight"];
    if (hasCost) headers.push(`Cost (${batchResult.currency})`);
    headers.push("Order QTY");
    const rows = [];
    groups.forEach(group => {
      const metrics = batchMetrics(group);
      const orders = group.stockOrders?.length ? group.stockOrders : [{ stockTypeId: "No stock order", requiredQuantity: 0, orderQuantity: 0, stockLength: null }];
      const cost = groupCost(group, batchResult.currency);
      orders.forEach((order, index) => {
        const required = finite(order.requiredQuantity);
        const row = [
          index === 0 ? `<strong>${esc(group.profileName || "")}</strong><br><span class="muted">${esc(group.steelGrade || "")}</span>` : "",
          esc(order.stockOrderId || order.stockTypeId || "—"),
          order.stockLength == null ? "—" : esc(mm(order.stockLength)),
          index === 0 ? percentText(percent(metrics.used, metrics.stock)) : "",
          index === 0 ? percentText(percent(metrics.waste, metrics.stock)) : "",
          index === 0 ? (group.weightTon != null && Number.isFinite(Number(group.weightTon)) ? `${decimal(group.weightTon)} t` : "—") : ""
        ];
        if (hasCost) row.push(index === 0 ? (cost == null ? "—" : esc(formatMoney(cost, batchResult.currency))) : "");
        row.push(esc(number(required)));
        rows.push(row);
      });
    });
    const totalRow = [
      { html: "Batch total / weighted result", colspan: 3, className: "total-label" },
      percentText(percent(totals.used, totals.stock)),
      percentText(percent(totals.waste, totals.stock)),
      completeWeight ? `${decimal(totals.weight)} t` : "—"
    ];
    if (hasCost) totalRow.push(totals.costKnown ? esc(formatMoney(totals.cost, batchResult.currency)) : "—");
    totalRow.push(esc(number(totals.required)));
    const leftoverRows = [[esc(number(totals.required)), esc(number(totals.ordered)), esc(String(totals.leftover))]];

    return `<section class="print-major-section print-batch-section">
      <h1>${esc(heading)}</h1>
      ${metadata([
        ["Project", batchResult?.projectName],
        ["Batch name", batchResult?.batchName],
        ["Generated", batchResult?.generatedAt ? new Date(batchResult.generatedAt).toLocaleString() : ""],
        ["Currency", batchResult?.currency]
      ])}
      ${renderMetricCards(cards)}
      <h2>Batch nesting groups</h2>
      ${table(headers, rows, `batch-table${hasCost ? " has-cost" : ""}`, [totalRow])}
      <h2>Expected leftovers</h2>
      ${table(["Order QTY", "ORDERED", "LEFTOVER"], leftoverRows, "expected-leftovers-table compact")}
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

  function normalizedPiece(piece) {
    const segments = (piece.segments || piece.layoutSegments || []).map(segment => ({
      ...segment,
      type: segmentType(segment),
      length: finite(segment.length),
      partId: segment.partId || segment.id || segment.label || null
    }));
    const parts = segments.filter(segment => segment.type === "Part");
    const offcut = segments.find(segment => segment.type === "ReusableOffcut" || segment.type === "NonReusableOffcut");
    const partLength = parts.reduce((sum, segment) => sum + segment.length, 0);
    const cutLength = segments.filter(segment => segment.type === "ToolCut").reduce((sum, segment) => sum + segment.length, 0);
    const trimLength = segments.filter(segment => segment.type === "StartTrim" || segment.type === "EndTrim").reduce((sum, segment) => sum + segment.length, 0);
    return {
      ...piece,
      stockSource: piece.stockSource === "RegularStock" ? "StockOrder" : piece.stockSource,
      segments,
      parts,
      partLength,
      cutLength,
      consumed: partLength + cutLength + trimLength,
      offcut: finite(offcut?.length),
      reusable: offcut?.type === "ReusableOffcut"
    };
  }

  function sortedPieces(plan) {
    return (plan?.stockPieces || []).map(normalizedPiece).sort((left, right) => {
      const source = (left.stockSource === "StorageStock" ? 0 : 1) - (right.stockSource === "StorageStock" ? 0 : 1);
      return source || finite(left.stockLength) - finite(right.stockLength) || finite(left.pieceNumber) - finite(right.pieceNumber);
    });
  }

  function segmentLabel(segment) {
    switch (segment.type) {
      case "StartTrim": return ["Start trim", "trim"];
      case "EndTrim": return ["End trim", "trim"];
      case "ToolCut": return ["", "tool-cut"];
      case "Part": return [segment.partId || "Part", "part"];
      case "ReusableOffcut": return ["Reusable", "reusable"];
      case "NonReusableOffcut": return ["Waste", "non-reusable"];
      default: return [segment.type, "unknown"];
    }
  }

  function renderPrintLegend() {
    const items = [
      ["part", "Actual part"],
      ["trim", "Start/end trim"],
      ["tool-cut", "Tool-width cut"],
      ["reusable", "Reusable leftover"],
      ["non-reusable", "Non-reusable waste"]
    ];
    return `<div class="print-legend" aria-label="Cutting-plan legend">${items.map(([className, label]) => `<div class="print-legend-item"><span class="print-legend-swatch ${className}"></span><span>${esc(label)}</span></div>`).join("")}</div>`;
  }

  function renderPiece(piece) {
    const source = piece.stockSource === "StorageStock" ? "Storage stock" : "Stock order";
    const sourceId = piece.stockSource === "StorageStock" ? (piece.storageStockId || piece.stockTypeId) : (piece.stockOrderId || piece.stockTypeId);
    const segmentMarkup = piece.segments.map(segment => {
      const [label, className] = segmentLabel(segment);
      const width = piece.stockLength > 0 ? Math.max(segment.length / piece.stockLength * 100, segment.type === "ToolCut" ? 0.35 : 0.6) : 1;
      return `<div class="print-segment ${className}" style="width:${width}%" title="${esc(label)} ${esc(mm(segment.length))}">${label ? `<span><strong>${esc(label)}</strong><small>${esc(mm(segment.length))}</small></span>` : ""}</div>`;
    }).join("");
    return `<article class="print-piece">
      <div class="print-piece-heading"><strong>Piece ${esc(piece.pieceNumber)}</strong><span>${esc(source)} · ${esc(sourceId || "—")} · ${esc(mm(piece.stockLength))} · ${percentText(percent(piece.partLength, piece.stockLength))} part yield</span></div>
      <div class="print-stock-bar">${segmentMarkup}</div>
      <p>${piece.stockSource === "StorageStock" ? `Retrieve from ${esc(piece.storageArea || "unspecified storage area")}. ` : ""}Parts ${esc(mm(piece.partLength))}; tool cuts ${esc(mm(piece.cutLength))}; consumed ${esc(mm(piece.consumed))}; offcut ${esc(mm(piece.offcut))} (${piece.reusable ? "reusable" : "non-reusable"}).</p>
    </article>`;
  }

  function planTotals(plan, pieces) {
    const source = plan?.totals || {};
    const stock = realNumber(source.totalStockLengthConsumed) ?? pieces.reduce((sum, piece) => sum + finite(piece.stockLength), 0);
    const consumed = realNumber(source.totalConsumedLength) ?? pieces.reduce((sum, piece) => sum + piece.consumed, 0);
    const offcut = realNumber(source.totalOffcutLength) ?? pieces.reduce((sum, piece) => sum + piece.offcut, 0);
    const storage = realNumber(source.totalStorageStockLengthConsumed) ?? pieces.filter(piece => piece.stockSource === "StorageStock").reduce((sum, piece) => sum + finite(piece.stockLength), 0);
    const reusable = realNumber(source.totalReusableOffcutLength) ?? pieces.filter(piece => piece.reusable).reduce((sum, piece) => sum + piece.offcut, 0);
    return { stock, consumed, offcut, storage, reusable };
  }

  function groupedLayouts(plan, pieces) {
    const partIds = (plan.requestedParts || []).map(part => part.partId);
    const map = new Map();
    pieces.forEach(piece => {
      const counts = {};
      piece.parts.forEach(part => counts[part.partId] = (counts[part.partId] || 0) + 1);
      const key = `${piece.stockSource}|${piece.stockTypeId}|${piece.stockLength}|${piece.layoutId}|${JSON.stringify(counts)}|${piece.offcut}`;
      if (!map.has(key)) map.set(key, { piece, counts, quantity: 0 });
      map.get(key).quantity++;
    });
    const headers = ["Source", "Stock length", "Stock qty.", "Offcut", "Utilization", ...partIds];
    const rows = [...map.values()].map(({ piece, counts, quantity }) => [
      piece.stockSource === "StorageStock" ? "Storage" : "Stock order",
      esc(mm(piece.stockLength)), esc(number(quantity)), esc(mm(piece.offcut)), percentText(percent(piece.partLength, piece.stockLength)),
      ...partIds.map(partId => esc(counts[partId] || ""))
    ]);
    return table(headers, rows, "matrix-table no-stock-id");
  }

  function sourceIds(piece) {
    const values = piece.stockSource === "StorageStock"
      ? [piece.storageStockId, piece.groupedStorageStockId, piece.stockTypeId]
      : [piece.stockOrderId, piece.stockTypeId];
    return [...new Set(values.map(value => cleanName(value).toLowerCase()).filter(Boolean))];
  }

  function matchingPieces(pieces, id, stockSource, length) {
    const normalizedId = cleanName(id).toLowerCase();
    const targetLength = realNumber(length);
    return pieces.filter(piece => {
      if (stockSource === "StorageStock" && piece.stockSource !== "StorageStock") return false;
      if (stockSource !== "StorageStock" && piece.stockSource === "StorageStock") return false;
      const ids = sourceIds(piece);
      if (normalizedId && ids.length) return ids.includes(normalizedId);
      return targetLength != null && realNumber(piece.stockLength) === targetLength;
    });
  }

  function derivedSourceValues(record, stockSource, pieces) {
    const id = stockSource === "StorageStock"
      ? (record.storageStockId || record.groupedStorageStockId)
      : (record.stockOrderId || record.stockTypeId);
    const length = realNumber(record.stockLength ?? record.length);
    const matched = matchingPieces(pieces, id, stockSource, length);
    const explicitQuantity = realNumber(stockSource === "StorageStock" ? record.quantity : record.selectedPieceCount);
    const quantity = explicitQuantity ?? (matched.length ? matched.length : null);
    let totalStockLength = realNumber(stockSource === "StorageStock" ? record.totalRetrievedStockLength : record.selectedStockLength);
    if (totalStockLength == null && quantity != null && length != null) totalStockLength = quantity * length;
    if (totalStockLength == null && matched.length) totalStockLength = matched.reduce((sum, piece) => sum + finite(piece.stockLength), 0);
    const explicitPartLength = realNumber(stockSource === "StorageStock" ? record.totalPartLength : record.selectedPartLength);
    const partLength = explicitPartLength ?? (matched.length ? matched.reduce((sum, piece) => sum + piece.partLength, 0) : null);
    const suppliedUtilization = realNumber(record.utilizationPercentage);
    const utilization = suppliedUtilization ?? (partLength != null && totalStockLength != null ? percent(partLength, totalStockLength) : Number.NaN);
    const suppliedWaste = realNumber(record.wasteLength ?? record.totalWasteLength);
    const wasteLength = suppliedWaste ?? (matched.length ? matched.reduce((sum, piece) => sum + piece.offcut, 0) : null);
    return { id, length, quantity, utilization, wasteLength };
  }

  function renderSourceSummaries(plan, pieces) {
    const currency = cleanName(plan.currency);
    const selectedOrders = (plan.stockOrderOptions || []).filter(order => {
      const count = realNumber(order.selectedPieceCount);
      return count != null ? count > 0 : matchingPieces(pieces, order.stockOrderId || order.stockTypeId, "StockOrder", order.length ?? order.stockLength).length > 0;
    });
    const showCost = Boolean(currency) && selectedOrders.some(order => realNumber(order.cost) != null);
    const orderHeaders = ["Stock ID", "Quantity", "Length", "Utilization", "Waste"];
    if (showCost) orderHeaders.push(`Price (${currency})`);
    const orderRows = selectedOrders.map(order => {
      const values = derivedSourceValues(order, "StockOrder", pieces);
      const row = [esc(values.id || "—"), values.quantity == null ? "—" : esc(number(values.quantity)), esc(mm(values.length)), percentText(values.utilization), values.wasteLength == null ? "—" : esc(mm(values.wasteLength))];
      if (showCost) row.push(realNumber(order.cost) == null ? "—" : esc(formatMoney(order.cost, currency)));
      return row;
    });
    const storageRows = (plan.storageRetrievals || []).map(record => {
      const values = derivedSourceValues(record, "StorageStock", pieces);
      return [esc(values.id || "—"), esc(record.storageArea || "—"), values.quantity == null ? "—" : esc(number(values.quantity)), esc(mm(values.length)), percentText(values.utilization), values.wasteLength == null ? "—" : esc(mm(values.wasteLength))];
    });
    return `<section class="print-source-section"><h2>Stock orders</h2>${table(orderHeaders, orderRows, `compact${showCost ? " has-cost" : ""}`)}</section><section class="print-source-section"><h2>Storage retrievals</h2>${table(["Storage ID", "Area", "Quantity", "Length", "Utilization", "Waste"], storageRows, "compact")}</section>`;
  }

  function groupedWasteRows(pieces) {
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
      pieceNumbers: row.pieceNumbers.sort((a, b) => finite(a) - finite(b)),
      quantity: row.pieceNumbers.length
    })).sort((left, right) => right.offcut - left.offcut);
  }

  function renderPlan(plan, identity = {}) {
    const pieces = sortedPieces(plan);
    const totals = planTotals(plan, pieces);
    const settings = { unit: "mm", ...(plan.settings || plan.cuttingSettings || {}) };
    const profileName = identity.profileName || plan.profileName || "";
    const steelGrade = identity.steelGrade || plan.steelGrade || "";
    const projectName = cleanName(identity.projectName || plan.projectName);
    const batchName = cleanName(identity.batchName || plan.batchName);
    const summaryHeading = `${profileName} · ${steelGrade} · Cut Plan Summary`;
    const diagramHeading = `${profileName} · ${steelGrade} · Cutting Plan Diagram`;
    const metrics = [
      ["Utilization", percentText(percent(totals.consumed, totals.stock)), `${mm(totals.consumed)} consumed`],
      ["Waste", percentText(percent(totals.offcut, totals.stock)), `${mm(totals.offcut)} offcut`],
      ["Storage stock share", percentText(percent(totals.storage, totals.stock)), `${mm(totals.storage)} from storage`],
      ["Reusable returned", percentText(percent(totals.reusable, totals.stock)), `${mm(totals.reusable)} reusable`]
    ];
    const wasteRows = groupedWasteRows(pieces).map(row => [
      esc(row.pieceNumbers.join(", ")),
      esc(row.source),
      esc(row.quantity >= 2 ? `${row.quantity} x ${row.stockId}` : row.stockId),
      esc(mm(row.offcut)),
      row.reusable ? "Reusable" : "Non-reusable"
    ]);
    const nameMeta = metadata([["Project", projectName], ["Batch name", batchName]]);

    return `<section class="print-major-section print-plan-summary-section">
      <h1>${esc(summaryHeading)}</h1>
      ${nameMeta}
      <p class="print-meta">Tool width: <strong>${esc(mm(settings.toolWidth))}</strong> · Start trim: <strong>${esc(mm(settings.trimStart))}</strong> · End trim: <strong>${esc(mm(settings.trimEnd))}</strong> · Reusable minimum: <strong>${esc(mm(settings.reusableMinimumLength))}</strong></p>
      <h2>Plan summary</h2>${renderMetricCards(metrics)}
      <h2>Stocks matrix — parts per layout</h2>${groupedLayouts(plan, pieces)}
      ${renderSourceSummaries(plan, pieces)}
      <h2>Waste list</h2>${table(["Piece", "Source", "Stock ID", "Offcut length", "Status"], wasteRows, "compact")}
    </section>
    <section class="print-major-section print-plan-diagram-section">
      <h1>${esc(diagramHeading)}</h1>
      ${nameMeta}
      ${pieces.length ? pieces.map(renderPiece).join("") : "<p>No stock pieces.</p>"}
      ${renderPrintLegend()}
    </section>`;
  }

  function printPageStyle(startedAt, qrUrl) {
    const timestamp = startedAt.toLocaleString();
    return `<style id="print-page-style">
      @page {
        size: A4 portrait;
        margin: 30mm 7.5mm 15mm;
        @top-left { content: "${cssString(timestamp)}"; font: 700 10pt/1.15 Arial, Helvetica, sans-serif; color: #111; text-align: left; vertical-align: middle; }
        @top-center { content: "https://bim-bee.github.io/nc_nesting"; font: 700 10pt/1.15 Arial, Helvetica, sans-serif; color: #111; text-align: center; vertical-align: middle; }
        @top-right { content: url("${cssString(qrUrl)}"); text-align: right; vertical-align: middle; }
        @bottom-center { content: "Page " counter(page); font: 9pt/1 Arial, Helvetica, sans-serif; color: #505866; }
      }
    </style>`;
  }

  async function waitForImages(printDocument) {
    const images = [...printDocument.images];
    await Promise.all(images.map(image => {
      if (image.complete) return image.naturalWidth > 0 ? Promise.resolve() : Promise.reject(new Error("A print image could not be loaded."));
      return new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", () => reject(new Error("A print image could not be loaded.")), { once: true });
      });
    }));
  }

  let activePrintJob = null;

  function writePrintDocument(title, body) {
    if (activePrintJob) return activePrintJob;
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
          if (!printWindow || !printDocument) throw new Error("The print surface could not be created.");
          if (printDocument.fonts?.ready) await printDocument.fonts.ready;
          await waitForImages(printDocument);
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
      iframe.srcdoc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="${esc(stylesheet)}">${printPageStyle(startedAt, qrUrl)}</head><body><img class="print-resource-preload" src="${esc(qrUrl)}" alt=""><main class="print-document">${body}</main></body></html>`;
      document.body.appendChild(iframe);
    }).finally(() => { activePrintJob = null; });
    return activePrintJob;
  }

  function plansById(plans) {
    if (Array.isArray(plans)) return new Map(plans.map(plan => [plan.groupId || plan.id, plan]));
    return new Map(Object.entries(plans || {}).map(([groupId, plan]) => [groupId, { groupId, ...plan }]));
  }

  function printInput(project) {
    return writePrintDocument("NC Nesting Input Page", renderInput(project));
  }

  function printBatchPage(batchResult) {
    return writePrintDocument("NC Nesting Batch Result", renderBatch(batchResult));
  }

  function printPlanPage(plan) {
    return writePrintDocument("NC Nesting Cutting Plan", renderPlan(plan));
  }

  function printFullSet(calculation) {
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
      return plan
        ? renderPlan({ ...plan, currency: batchResult.currency, projectName: batchResult.projectName, batchName: batchResult.batchName }, identity)
        : `<section class="print-major-section print-plan-summary-section"><h1>${esc(identity.profileName)} · ${esc(identity.steelGrade)} · Cut Plan Summary</h1>${metadata([["Project", identity.projectName], ["Batch name", identity.batchName]])}<p>Plan data is unavailable for this nesting group.</p></section><section class="print-major-section print-plan-diagram-section"><h1>${esc(identity.profileName)} · ${esc(identity.steelGrade)} · Cutting Plan Diagram</h1>${metadata([["Project", identity.projectName], ["Batch name", identity.batchName]])}<p>Plan data is unavailable for this nesting group.</p>${renderPrintLegend()}</section>`;
    }).join("");
    const body = `${renderInput(project)}${renderBatch(batchResult)}${planSections}`;
    const titleName = batchResult.batchName || batchResult.projectName || "Full Calculation";
    return writePrintDocument(`NC Nesting — ${titleName}`, body);
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
