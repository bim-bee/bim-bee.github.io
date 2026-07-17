(function () {
  "use strict";

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const numberFormat = new Intl.NumberFormat();
  const decimalFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const number = value => numberFormat.format(Number(value) || 0);
  const decimal = value => decimalFormat.format(Number(value) || 0);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const percent = (value, total) => total > 0 ? value / total * 100 : 0;
  const mm = value => `${number(finite(value))} mm`;
  const metres = value => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(finite(value) / 1000)} m`;
  const generatedOrderId = value => /^Stock-[A-Z]+$/i.test(String(value || "").trim())
    ? String(value).trim().replace(/^Stock-/i, "Order-")
    : String(value || "").trim();
  const orderId = row => String(row.stockId || row.stockOrderId || "").trim() || generatedOrderId(row.generatedId) || "—";
  const storageId = row => String(row.storageId || row.storageStockId || "").trim() || String(row.generatedId || "").trim() || "—";

  function table(headers, rows, className = "") {
    return `<div class="print-table-wrap"><table class="${esc(className)}"><thead><tr>${headers.map(header => `<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows.length
      ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${headers.length}" class="empty">No rows</td></tr>`}</tbody></table></div>`;
  }

  function settingRows(project) {
    const settings = project?.cuttingSettings || {};
    return [
      ["Tool width", mm(settings.toolWidth)],
      ["Start trim", mm(settings.trimStart)],
      ["End trim", mm(settings.trimEnd)],
      ["Reusable minimum", mm(settings.reusableMinimumLength)],
      ["Currency", esc(project?.currency || "—")],
      ["Auto-fill orders", project?.autoFillOrders === false ? "Off" : "On"]
    ];
  }

  function renderInput(project, heading = "Batch input and job information") {
    const inputs = project?.inputs || {};
    const stockRows = (inputs.stockOrders || []).filter(row => [row.stockId, row.profile, row.steelGrade, row.length, row.price].some(value => String(value ?? "").trim()) || row.unlimited);
    const storageRows = (inputs.storageStock || []).filter(row => [row.storageId, row.profile, row.steelGrade, row.length, row.storageArea].some(value => String(value ?? "").trim()));
    const partRows = (inputs.parts || []).filter(row => [row.position, row.steelGrade, row.profile, row.length].some(value => String(value ?? "").trim()));

    return `<section class="print-major-section print-input-section">
      <h1>${esc(heading)}</h1>
      ${project?.projectId ? `<p class="print-meta"><strong>Project:</strong> ${esc(project.projectId)}</p>` : ""}
      <h2>Job parameters</h2>
      ${table(["Parameter", "Value"], settingRows(project).map(([label, value]) => [esc(label), value]), "compact")}
      <h2>Stock orders</h2>
      ${table(
        ["Stock order ID", "Profile", "Steel grade", "Length", "Quantity", "Price"],
        stockRows.map(row => [
          esc(orderId(row)), esc(row.profile || row.profileName || ""), esc(row.steelGrade || ""), esc(mm(row.length)),
          (typeof row.unlimited === "boolean" ? row.unlimited : row.availableQuantity == null) ? "Unlimited" : esc(number(row.quantity ?? row.availableQuantity)),
          String(row.price ?? "").trim() === "" ? "—" : esc(row.price)
        ])
      )}
      <h2>Storage stocks</h2>
      ${table(
        ["Storage ID", "Profile", "Steel grade", "Length", "Quantity", "Storage area"],
        storageRows.map(row => [
          esc(storageId(row)), esc(row.profile || row.profileName || ""), esc(row.steelGrade || ""), esc(mm(row.length)),
          esc(number(row.quantity)), esc(row.storageArea || "—")
        ])
      )}
      <h2>Parts to cut</h2>
      ${table(
        ["Position", "Steel grade", "Quantity", "Profile", "Length", "Source"],
        partRows.map(row => [
          esc(row.position || row.positionId || ""), esc(row.steelGrade || ""), esc(number(row.quantity)),
          esc(row.profile || row.profileName || ""), esc(mm(row.length)), esc(String(row.source || "Manual").trim() || "Manual")
        ])
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

  function batchTotals(batchResult) {
    return (batchResult?.groups || []).reduce((total, group) => {
      const metrics = batchMetrics(group);
      total.stock += metrics.stock;
      total.used += metrics.used;
      total.storage += metrics.storage;
      total.reusable += metrics.reusable;
      total.waste += metrics.waste;
      total.storageQuantity += finite(group.storageStockQuantity);
      if (group.weightTon != null && Number.isFinite(Number(group.weightTon))) total.weight += Number(group.weightTon);
      (group.stockOrders || []).forEach(order => {
        total.required += finite(order.requiredQuantity);
        total.ordered += finite(order.orderQuantity, finite(order.requiredQuantity));
      });
      return total;
    }, { stock: 0, used: 0, storage: 0, reusable: 0, waste: 0, storageQuantity: 0, weight: 0, required: 0, ordered: 0 });
  }

  function renderMetricCards(cards) {
    return `<div class="print-metrics">${cards.map(([label, value, note]) => `<div class="print-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(note)}</span></div>`).join("")}</div>`;
  }

  function renderBatch(batchResult, heading = "Batch Result") {
    const groups = batchResult?.groups || [];
    const totals = batchTotals(batchResult);
    const completeWeight = groups.length > 0 && groups.every(group => group.weightTon != null && Number.isFinite(Number(group.weightTon)));
    const cards = [
      ["Stock order quantity", number(totals.ordered), `${number(totals.required)} required`],
      ["Utilization", `${decimal(percent(totals.used, totals.stock))}%`, `${metres(totals.used)} consumed`],
      ["Waste", `${decimal(percent(totals.waste, totals.stock))}%`, `${metres(totals.waste)} offcut`]
    ];
    if (completeWeight) cards.push(["Batch weight", `${decimal(totals.weight)} t`, `${number(groups.length)} nesting groups`]);
    cards.push(
      ["Storage stock share", `${decimal(percent(totals.storage, totals.stock))}%`, `${metres(totals.storage)} from storage`],
      ["Reusable returned", `${decimal(percent(totals.reusable, totals.stock))}%`, `${metres(totals.reusable)} reusable`]
    );

    const rows = [];
    groups.forEach(group => {
      const metrics = batchMetrics(group);
      const orders = group.stockOrders?.length ? group.stockOrders : [{ stockTypeId: "No stock order", requiredQuantity: 0, orderQuantity: 0, stockLength: null }];
      orders.forEach((order, index) => {
        const required = finite(order.requiredQuantity);
        const ordered = finite(order.orderQuantity, required);
        rows.push([
          index === 0 ? `<strong>${esc(group.profileName || "")}</strong><br><span class="muted">${esc(group.steelGrade || "")}</span>` : "",
          esc(order.stockOrderId || order.stockTypeId || "—"),
          order.stockLength == null ? "—" : esc(mm(order.stockLength)),
          index === 0 ? `${decimal(percent(metrics.used, metrics.stock))}%` : "",
          index === 0 ? `${decimal(percent(metrics.waste, metrics.stock))}%` : "",
          index === 0 ? (group.weightTon != null && Number.isFinite(Number(group.weightTon)) ? `${decimal(group.weightTon)} t` : "—") : "",
          index === 0 ? `${number(group.storageStockQuantity)} pcs · ${metres(group.totalStorageStockLengthConsumed)}` : "",
          esc(number(required)), esc(number(ordered)), esc(String(ordered - required))
        ]);
      });
    });

    return `<section class="print-major-section print-batch-section">
      <h1>${esc(heading)}</h1>
      <p class="print-meta"><strong>Batch:</strong> ${esc(batchResult?.batchId || "—")}${batchResult?.generatedAt ? ` · <strong>Generated:</strong> ${esc(new Date(batchResult.generatedAt).toLocaleString())}` : ""}${batchResult?.currency ? ` · <strong>Currency:</strong> ${esc(batchResult.currency)}` : ""}</p>
      ${renderMetricCards(cards)}
      <h2>Batch nesting groups</h2>
      ${table(["Nesting group", "Stock order ID", "Length", "Utilization", "Waste", "Weight", "Storage QTY", "Order QTY", "ORDER", "LEFTOVER"], rows, "batch-table")}
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

  function renderPiece(piece) {
    const source = piece.stockSource === "StorageStock" ? "Storage stock" : "Stock order";
    const sourceId = piece.stockSource === "StorageStock" ? (piece.storageStockId || piece.stockTypeId) : (piece.stockOrderId || piece.stockTypeId);
    const segmentMarkup = piece.segments.map(segment => {
      const [label, className] = segmentLabel(segment);
      const width = piece.stockLength > 0 ? Math.max(segment.length / piece.stockLength * 100, segment.type === "ToolCut" ? 0.35 : 0.6) : 1;
      return `<div class="print-segment ${className}" style="width:${width}%" title="${esc(label)} ${esc(mm(segment.length))}">${label ? `<span><strong>${esc(label)}</strong><small>${esc(mm(segment.length))}</small></span>` : ""}</div>`;
    }).join("");
    return `<article class="print-piece">
      <div class="print-piece-heading"><strong>Piece ${esc(piece.pieceNumber)}</strong><span>${esc(source)} · ${esc(sourceId || "—")} · ${esc(mm(piece.stockLength))} · ${decimal(percent(piece.partLength, piece.stockLength))}% part yield</span></div>
      <div class="print-stock-bar">${segmentMarkup}</div>
      <p>${piece.stockSource === "StorageStock" ? `Retrieve from ${esc(piece.storageArea || "unspecified storage area")}. ` : ""}Parts ${esc(mm(piece.partLength))}; tool cuts ${esc(mm(piece.cutLength))}; consumed ${esc(mm(piece.consumed))}; offcut ${esc(mm(piece.offcut))} (${piece.reusable ? "reusable" : "non-reusable"}).</p>
    </article>`;
  }

  function planTotals(plan, pieces) {
    const source = plan?.totals || {};
    const stock = Number.isFinite(Number(source.totalStockLengthConsumed)) ? Number(source.totalStockLengthConsumed) : pieces.reduce((sum, piece) => sum + finite(piece.stockLength), 0);
    const consumed = Number.isFinite(Number(source.totalConsumedLength)) ? Number(source.totalConsumedLength) : pieces.reduce((sum, piece) => sum + piece.consumed, 0);
    const offcut = Number.isFinite(Number(source.totalOffcutLength)) ? Number(source.totalOffcutLength) : pieces.reduce((sum, piece) => sum + piece.offcut, 0);
    const storage = Number.isFinite(Number(source.totalStorageStockLengthConsumed)) ? Number(source.totalStorageStockLengthConsumed) : pieces.filter(piece => piece.stockSource === "StorageStock").reduce((sum, piece) => sum + finite(piece.stockLength), 0);
    const reusable = Number.isFinite(Number(source.totalReusableOffcutLength)) ? Number(source.totalReusableOffcutLength) : pieces.filter(piece => piece.reusable).reduce((sum, piece) => sum + piece.offcut, 0);
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
    const headers = ["Source", "Stock ID", "Stock length", "Stock qty.", "Offcut", "Utilization", ...partIds];
    const rows = [...map.values()].map(({ piece, counts, quantity }) => [
      piece.stockSource === "StorageStock" ? "Storage" : "Stock order",
      esc(piece.stockSource === "StorageStock" ? (piece.storageStockId || piece.stockTypeId) : piece.stockTypeId),
      esc(mm(piece.stockLength)), esc(number(quantity)), esc(mm(piece.offcut)), `${decimal(percent(piece.partLength, piece.stockLength))}%`,
      ...partIds.map(partId => esc(counts[partId] || ""))
    ]);
    return table(headers, rows, "matrix-table");
  }

  function renderSourceSummaries(plan) {
    const selectedOrders = (plan.stockOrderOptions || []).filter(order => finite(order.selectedPieceCount) > 0);
    const orderRows = selectedOrders.map(order => {
      const quantity = finite(order.selectedPieceCount);
      const length = finite(order.length ?? order.stockLength);
      const selectedLength = finite(order.selectedStockLength, quantity * length);
      const utilization = Number.isFinite(Number(order.utilizationPercentage)) ? Number(order.utilizationPercentage) : percent(finite(order.selectedPartLength), selectedLength);
      return [esc(order.stockOrderId || order.stockTypeId || "—"), esc(number(quantity)), esc(mm(length)), `${decimal(utilization)}%`, order.wasteLength == null ? "—" : esc(mm(order.wasteLength))];
    });
    const storageRows = (plan.storageRetrievals || []).map(record => {
      const quantity = finite(record.quantity);
      const length = finite(record.stockLength ?? record.length);
      const utilization = Number.isFinite(Number(record.utilizationPercentage)) ? Number(record.utilizationPercentage) : percent(finite(record.totalPartLength), quantity * length);
      return [esc(record.storageStockId || record.groupedStorageStockId || "—"), esc(record.storageArea || "—"), esc(number(quantity)), esc(mm(length)), `${decimal(utilization)}%`, record.wasteLength == null ? "—" : esc(mm(record.wasteLength))];
    });
    return `<section class="print-source-section"><h2>Stock orders</h2>${table(["Stock ID", "Quantity", "Length", "Utilization", "Waste"], orderRows, "compact")}</section><section class="print-source-section"><h2>Storage retrievals</h2>${table(["Storage ID", "Area", "Quantity", "Length", "Utilization", "Waste"], storageRows, "compact")}</section>`;
  }

  function renderPlan(plan, identity = {}) {
    const pieces = sortedPieces(plan);
    const totals = planTotals(plan, pieces);
    const settings = { unit: "mm", ...(plan.settings || plan.cuttingSettings || {}) };
    const profileName = identity.profileName || plan.profileName || "";
    const steelGrade = identity.steelGrade || plan.steelGrade || "";
    const summaryHeading = `${profileName} · ${steelGrade} · Cut Plan Summery`;
    const diagramHeading = `${profileName} · ${steelGrade} · Cutting Plan Diagram`;
    const metrics = [
      ["Utilization", `${decimal(percent(totals.consumed, totals.stock))}%`, `${mm(totals.consumed)} consumed`],
      ["Waste", `${decimal(percent(totals.offcut, totals.stock))}%`, `${mm(totals.offcut)} offcut`],
      ["Storage stock share", `${decimal(percent(totals.storage, totals.stock))}%`, `${mm(totals.storage)} from storage`],
      ["Reusable returned", `${decimal(percent(totals.reusable, totals.stock))}%`, `${mm(totals.reusable)} reusable`]
    ];
    const wasteRows = [...pieces].sort((left, right) => right.offcut - left.offcut).map(piece => [
      esc(piece.pieceNumber), piece.stockSource === "StorageStock" ? "Storage" : "Stock order",
      esc(piece.stockSource === "StorageStock" ? (piece.storageStockId || piece.stockTypeId) : piece.stockTypeId),
      esc(mm(piece.offcut)), piece.reusable ? "Reusable" : "Non-reusable"
    ]);

    return `<section class="print-major-section print-plan-summary-section">
      <h1>${esc(summaryHeading)}</h1>
      <p class="print-meta">Tool width: <strong>${esc(mm(settings.toolWidth))}</strong> · Start trim: <strong>${esc(mm(settings.trimStart))}</strong> · End trim: <strong>${esc(mm(settings.trimEnd))}</strong> · Reusable minimum: <strong>${esc(mm(settings.reusableMinimumLength))}</strong></p>
      <h2>Plan summary</h2>${renderMetricCards(metrics)}
      <h2>Stocks matrix — parts per layout</h2>${groupedLayouts(plan, pieces)}
      ${renderSourceSummaries(plan)}
      <h2>Waste list</h2>${table(["Piece", "Source", "Stock ID", "Offcut length", "Status"], wasteRows, "compact")}
    </section>
    <section class="print-major-section print-plan-diagram-section">
      <h1>${esc(diagramHeading)}</h1>
      ${pieces.length ? pieces.map(renderPiece).join("") : "<p>No stock pieces.</p>"}
    </section>`;
  }

  let activePrintJob = null;

  function writePrintDocument(title, body) {
    if (activePrintJob) return activePrintJob;

    activePrintJob = new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.tabIndex = -1;
      Object.assign(iframe.style, {
        position: "fixed",
        left: "-10000px",
        top: "0",
        width: "1px",
        height: "1px",
        border: "0",
        pointerEvents: "none"
      });

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
      iframe.srcdoc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="${esc(stylesheet)}"></head><body><main class="print-document">${body}</main></body></html>`;
      document.body.appendChild(iframe);
    }).finally(() => {
      activePrintJob = null;
    });

    return activePrintJob;
  }

  function plansById(plans) {
    if (Array.isArray(plans)) return new Map(plans.map(plan => [plan.groupId || plan.id, plan]));
    return new Map(Object.entries(plans || {}).map(([groupId, plan]) => [groupId, { groupId, ...plan }]));
  }

  function printInput(project) {
    return writePrintDocument("NC Nesting — Batch Input", renderInput(project, "NC Nesting — Batch Input"));
  }

  function printBatchPage(batchResult) {
    return writePrintDocument("NC Nesting — Batch Result", renderBatch(batchResult, "NC Nesting — Batch Result"));
  }

  function printPlanPage(plan) {
    return writePrintDocument("NC Nesting — Cutting Plan", renderPlan(plan));
  }

  function printFullSet(calculation) {
    const project = calculation?.project || {};
    const batchResult = calculation?.batchResult || {};
    const planMap = plansById(calculation?.plans);
    const planSections = (batchResult.groups || []).map(group => {
      const plan = planMap.get(group.groupId);
      const identity = {
        profileName: group.profileName || plan?.profileName || "",
        steelGrade: group.steelGrade || plan?.steelGrade || ""
      };
      return plan
        ? renderPlan(plan, identity)
        : `<section class="print-major-section print-plan-summary-section"><h1>${esc(identity.profileName)} · ${esc(identity.steelGrade)} · Cut Plan Summery</h1><p>Plan data is unavailable for this nesting group.</p></section><section class="print-major-section print-plan-diagram-section"><h1>${esc(identity.profileName)} · ${esc(identity.steelGrade)} · Cutting Plan Diagram</h1><p>Plan data is unavailable for this nesting group.</p></section>`;
    }).join("");
    const body = `${renderInput(project)}${renderBatch(batchResult)}${planSections}`;
    return writePrintDocument(`NC Nesting — ${batchResult.batchId || "Full Calculation"}`, body);
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
