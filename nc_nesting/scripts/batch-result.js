(function () {
  "use strict";

  const I18N = window.NCNestingI18n;
  const t = (key, params = {}, language) => I18N.t(key, params, language);
  const Optimization = window.NcNestingOptimization;
  let data;
  let hasCost = false;
  let hasCompleteWeight = false;
  let stateMessageKey = "batch.loadSolved";

  const n = value => I18N.formatNumber(Number(value) || 0, { maximumFractionDigits: 0 });
  const d = value => I18N.formatNumber(Number(value) || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pct = (a, b) => b > 0 ? a / b * 100 : 0;
  const metres = mm => I18N.measurementHtml((Number(mm) || 0) / 1000, "m", { maximumFractionDigits: 2 });
  const len = mm => mm == null ? "—" : Number(mm) >= 1000 ? metres(mm) : I18N.measurementHtml(Number(mm), "mm", { maximumFractionDigits: 0 });
  const ton = value => I18N.measurementHtml(Number(value) || 0, "ton", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  const bdi = value => `<bdi dir="ltr">${esc(value)}</bdi>`;
  const balanceClass = value => value > 0 ? "positive" : value < 0 ? "negative" : "zero";
  const signed = value => value > 0 ? `+${n(value)}` : n(value);

  function localizedError(key) {
    const error = new Error(key);
    error.i18nKey = key;
    return error;
  }

  function linkedGreedyAlgorithmHtml(text) {
    return Optimization?.methodologyLinkedHtml?.(text) || esc(text);
  }


  function formatCost(value) {
    if (value == null) return "—";
    const amount = Math.round(Number(value) || 0);
    return I18N.priceHtml(amount, data?.currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function isGreedyOnly(group) {
    if (Optimization?.isGreedyOnlyResult) return Optimization.isGreedyOnlyResult(group);
    return String(group?.status || "").replace(/[\s_-]/g, "").toLowerCase() === "greedyonly"
      || String(group?.resultSource || "").replace(/[\s_-]/g, "").toLowerCase() === "frontendgreedy";
  }

  function optimizationComparisonHtml(group) {
    const message = Optimization?.resultMessage?.(group, group?.greedyBaseline);
    if (!message) return "";
    const tone = String(message.tone || "bestknown").replace(/[^a-z0-9_-]/gi, "").toLowerCase();
    const stackedHeader = message.status === "Optimal" || message.status === "BestKnown";
    const detailLead = message.detailLead || message.detail;
    const detailContinuation = message.detailContinuation || "";
    return `<div class="optimization-compare">
      ${stackedHeader
        ? `<div class="optimization-message-header"><span class="optimization-status optimization-status-${esc(tone)}">${esc(message.statusLabel || message.status)}</span><span class="optimization-message-title">${esc(message.headline)}</span></div>
      <span class="optimization-message-detail">${linkedGreedyAlgorithmHtml(detailLead)}</span>${detailContinuation ? `
      <span class="optimization-message-detail">${linkedGreedyAlgorithmHtml(detailContinuation)}</span>` : ""}`
        : `<span class="optimization-status optimization-status-${esc(tone)}">${esc(message.statusLabel || message.status)}</span>
      <span class="optimization-message-title">${esc(message.headline)}</span>
      <span class="optimization-message-detail">${linkedGreedyAlgorithmHtml(message.detail)}</span>`}
      ${data?.isDemoResult ? `<span class="optimization-message-detail optimization-demo-message">${esc(t("batch.demoMessage"))}</span>` : ""}
    </div>`;
  }

  function metrics(group) {
    const stock = Number(group.totalStockLengthConsumed) || 0;
    const used = Number(group.totalConsumedLength) || 0;
    const part = Number.isFinite(Number(group.totalPartLength))
      ? Math.max(0, Number(group.totalPartLength))
      : used;
    const storage = Number(group.totalStorageStockLengthConsumed) || 0;
    const reusable = Number(group.totalReusableOffcutLength) || 0;
    const waste = group.totalOffcutLength == null
      ? Math.max(stock - used, 0)
      : Math.max(Number(group.totalOffcutLength) || 0, 0);
    return {
      stock,
      used,
      part,
      storage,
      reusable,
      waste,
      utilization: NcNestingUtilization.optimisticPercentage(part, waste),
      wastePercent: NcNestingUtilization.optimisticWastePercentage(part, waste)
    };
  }

  function normalize(source) {
    const normalized = structuredClone(source);
    normalized.projectName = String(normalized.projectName || "").trim();
    normalized.batchName = String(normalized.batchName || "").trim();
    normalized.currency = String(normalized.currency || "").trim() || null;
    normalized.groups = (normalized.groups || []).map(group => {
      group.storageStockQuantity = Math.max(0, Math.trunc(Number(group.storageStockQuantity) || 0));
      const catalogueWeight = group.profileWeightSource === "profile-catalogue"
        && group.profileKeilogramPerMeter != null
        && Number.isFinite(Number(group.profileKeilogramPerMeter))
        && Number(group.profileKeilogramPerMeter) >= 0
        ? Number(group.profileKeilogramPerMeter)
        : null;
      group.profileKeilogramPerMeter = catalogueWeight;
      group.weightTon = group.profileKeilogramPerMeter == null
        ? null
        : (Number(group.totalStockLengthConsumed) || 0) / 1000000 * group.profileKeilogramPerMeter;
      group.storageStockWeightTon = group.profileKeilogramPerMeter == null
        ? null
        : (Number(group.totalStorageStockLengthConsumed) || 0) / 1000000 * group.profileKeilogramPerMeter;
      group.stockOrders = (group.stockOrders?.length
        ? group.stockOrders
        : [{ stockTypeId: "No stock order", stockLength: null, requiredQuantity: 0, unitPrice: null }]
      ).map(order => ({
        ...order,
        stockLength: order.stockLength == null
          ? (Number.isFinite(Number(order.length)) ? Number(order.length) : null)
          : Number(order.stockLength),
        requiredQuantity: Math.max(0, Math.trunc(Number(order.requiredQuantity) || 0)),
        unitPrice: order.unitPrice == null ? null : Number(order.unitPrice),
        orderQuantity: Math.max(0, Math.trunc(order.orderQuantity == null
          ? Number(order.requiredQuantity) || 0
          : Number(order.orderQuantity) || 0))
      }));
      return group;
    });
    return normalized;
  }

  async function load() {
    const params = new URLSearchParams(location.search);
    const batchId = params.get("batchId");
    if (!batchId) throw localizedError("error.openSolvedBatch");
    document.getElementById("backInput").href = `index.html?batchId=${encodeURIComponent(batchId)}`;
    const stored = await NcNesting.getBatchResult(batchId);
    if (!stored) throw localizedError("error.batchUnavailable");
    const normalized = normalize(stored);
    normalized.groups.forEach(group => {
      group.detailedPlanUrl = `cutting-plan.html?batchId=${encodeURIComponent(batchId)}&groupId=${encodeURIComponent(group.groupId)}`;
    });
    return normalized;
  }

  function groupCost(group) {
    if (!data.currency) return null;
    let cost = 0;
    for (const order of group.stockOrders) {
      const quantity = Number(order.orderQuantity) || 0;
      if (quantity > 0 && order.unitPrice == null) return null;
      cost += quantity * (Number(order.unitPrice) || 0);
    }
    return cost;
  }

  function totals() {
    const result = data.groups.reduce((total, group) => {
      const groupMetrics = metrics(group);
      total.stock += groupMetrics.stock;
      total.used += groupMetrics.used;
      total.part += groupMetrics.part;
      total.storageLength += groupMetrics.storage;
      total.reusable += groupMetrics.reusable;
      total.waste += groupMetrics.waste;
      if (group.weightTon != null) total.weight += Number(group.weightTon) || 0;
      total.storageQuantity += Number(group.storageStockQuantity) || 0;
      if (group.storageStockWeightTon != null) total.storageWeight += Number(group.storageStockWeightTon) || 0;
      if (hasCost) {
        const calculatedCost = groupCost(group);
        if (calculatedCost == null) total.costKnown = false;
        else total.cost += calculatedCost;
      }
      return total;
    }, {
      stock: 0,
      used: 0,
      part: 0,
      storageLength: 0,
      reusable: 0,
      waste: 0,
      weight: 0,
      storageQuantity: 0,
      storageWeight: 0,
      cost: 0,
      costKnown: true,
      quantity: 0,
      order: 0
    });
    const quantities = NcNesting.calculateBatchOrderTotals(data);
    result.quantity = quantities.orderQuantity;
    result.order = quantities.ordered;
    return result;
  }

  function renderMeta() {
    document.getElementById("meta").innerHTML = `
      ${data.generatedAt ? `<span><strong>${esc(t("common.generated"))}:</strong> <bdi dir="ltr">${esc(I18N.formatDateTime(data.generatedAt))}</bdi></span>` : ""}
      <span><strong>${esc(t("common.groups"))}:</strong> <bdi dir="ltr">${n(data.groups.length)}</bdi></span>
      ${data.currency ? `<span><strong>${esc(t("common.currency"))}:</strong> ${esc(I18N.currencyLabel(data.currency))}</span>` : ""}
    `;
  }

  function renderBatchMetadata() {
    const container = document.getElementById("batchMetadata");
    const items = [
      [t("common.project"), data.projectName],
      [t("common.batchName"), data.batchName]
    ].filter(([, value]) => String(value || "").trim());
    container.innerHTML = items.map(([label, value]) => `
      <div class="metadata-field"><span>${esc(label)}</span><strong dir="auto">${esc(value)}</strong></div>
    `).join("");
    container.hidden = items.length === 0;
  }

  function renderGreedyFallbackNotice() {
    const notice = document.getElementById("greedyFallbackNotice");
    const hasGreedyOnly = data.groups.some(isGreedyOnly);
    notice.textContent = hasGreedyOnly ? t("batch.greedyFallbackNotice") : "";
    notice.hidden = !hasGreedyOnly;
  }

  function renderSummary() {
    const total = totals();
    const cards = [
      [t("common.stockOrderQuantity"), I18N.inlineNumberHtml(total.order, { maximumFractionDigits: 0 }), I18N.supportingTextHtml("batch.required", { quantity: I18N.inlineNumberHtml(total.quantity, { maximumFractionDigits: 0 }) })],
      [t("common.utilization"), `<bdi dir="ltr">${esc(d(NcNestingUtilization.optimisticPercentage(total.part, total.waste)))}%</bdi>`, I18N.supportingTextHtml("batch.consumedLength", { length: len(total.part) })],
      [t("common.waste"), `<bdi dir="ltr">${esc(d(NcNestingUtilization.optimisticWastePercentage(total.part, total.waste)))}%</bdi>`, I18N.supportingTextHtml("batch.offcutLength", { length: len(total.waste) })]
    ];
    if (hasCompleteWeight) cards.push([t("common.batchWeight"), ton(total.weight), I18N.supportingTextHtml("batch.groupCount", { count: I18N.inlineNumberHtml(data.groups.length, { maximumFractionDigits: 0 }) })]);
    cards.push(
      [t("common.storageStockShare"), `<bdi dir="ltr">${esc(d(pct(total.storageLength, total.stock)))}%</bdi>`, I18N.supportingTextHtml("batch.storageLength", { length: len(total.storageLength) })],
      [t("common.reusableReturned"), `<bdi dir="ltr">${esc(d(pct(total.reusable, total.stock)))}%</bdi>`, I18N.supportingTextHtml("batch.reusableLength", { length: len(total.reusable) })]
    );
    document.getElementById("summary").innerHTML = cards.map(card => `
      <div class="metric"><small>${esc(card[0])}</small><b>${card[1]}</b><span class="metric-support">${card[2]}</span></div>
    `).join("");
  }

  function storageCell(group) {
    const quantity = Number(group.storageStockQuantity) || 0;
    if (quantity <= 0) return "—";
    const values = [
      I18N.quantityHtml(quantity, { maximumFractionDigits: 0 }),
      metres(group.totalStorageStockLengthConsumed)
    ];
    if (group.storageStockWeightTon != null) values.push(ton(group.storageStockWeightTon));
    return I18N.inlineValuesHtml(values, { className: "storage-summary" });
  }

  function percentLengthCell(percentValue, lengthValue) {
    return I18N.inlineValuesHtml([
      `<span class="percent-value" dir="ltr">${esc(d(percentValue))}%</span>`,
      len(lengthValue)
    ], { className: "percent-details" });
  }

  function renderTable() {
    hasCost = Boolean(data.currency) && data.groups.some(group => group.stockOrders.some(order => order.unitPrice != null));
    hasCompleteWeight = data.groups.length > 0 && data.groups.every(group => group.weightTon != null);
    const costHeader = document.getElementById("costHeader");
    costHeader.hidden = !hasCost;
    costHeader.textContent = t("common.cost");

    let output = "";
    data.groups.forEach((group, groupIndex) => {
      const groupMetrics = metrics(group);
      const span = group.stockOrders.length;
      const calculatedCost = groupCost(group);
      group.stockOrders.forEach((order, orderIndex) => {
        const quantity = Number(order.requiredQuantity) || 0;
        const ordered = Number(order.orderQuantity) || 0;
        const leftover = ordered - quantity;
        const isFirst = orderIndex === 0;
        const isLast = orderIndex === span - 1;
        const rowClass = isFirst && isLast ? "group-first group-last" : isFirst ? "group-first" : isLast ? "group-last" : "group-middle";
        output += `
          <tr class="${rowClass}" data-group-index="${groupIndex}" data-url="${esc(group.detailedPlanUrl || "#")}">
            ${isFirst ? `<td class="profile" rowspan="${span}"><button class="group-result-remove no-print" type="button" data-remove-group="${esc(group.groupId)}" title="${esc(t("action.removeResultGroup"))}" aria-label="${esc(t("action.removeResultGroupNamed", { profile: I18N.isolate(group.profileName), grade: I18N.isolate(group.steelGrade) }))}">×</button><b>${bdi(group.profileName)}</b><span>${bdi(group.steelGrade)}</span>${optimizationComparisonHtml(group)}</td>` : ""}
            <td class="num">${order.stockLength == null ? "—" : len(order.stockLength)}</td>
            ${isFirst ? `
              <td class="num percent" rowspan="${span}">${percentLengthCell(groupMetrics.utilization, groupMetrics.part)}</td>
              <td class="num percent" rowspan="${span}">${percentLengthCell(groupMetrics.wastePercent, groupMetrics.waste)}</td>
              <td class="num" rowspan="${span}">${group.weightTon == null ? "—" : ton(group.weightTon)}</td>
              ${hasCost ? `<td class="num" rowspan="${span}">${formatCost(calculatedCost)}</td>` : ""}
              <td class="num" rowspan="${span}">${storageCell(group)}</td>
            ` : ""}
            <td class="num" dir="ltr">${n(quantity)}</td>
            <td class="center"><div class="order" data-group="${groupIndex}" data-order="${orderIndex}" dir="ltr"><button type="button" data-change="-1" aria-label="${esc(t("action.decreaseOrder"))}">−</button><input type="number" min="0" step="1" value="${ordered}" aria-label="${esc(t("action.orderQuantity"))}"><button type="button" data-change="1" aria-label="${esc(t("action.increaseOrder"))}">+</button></div></td>
            <td class="center" dir="ltr"><span class="balance ${balanceClass(leftover)}">${signed(leftover)}</span></td>
            ${isFirst ? `<td class="detail" rowspan="${span}"><div class="cut-plan-actions"><a href="${esc(group.detailedPlanUrl || "#")}">${esc(t("action.viewCutPlan"))} <span aria-hidden="true">${I18N.direction() === "rtl" ? "←" : "→"}</span></a></div></td>` : ""}
          </tr>`;
      });
    });
    document.getElementById("body").innerHTML = output;
    wireTable();
    renderFooter();
  }

  function renderFooter() {
    const total = totals();
    const leftover = total.order - total.quantity;
    document.getElementById("foot").innerHTML = `
      <tr>
        <td colspan="2">${esc(t("common.batchTotalWeighted"))}</td>
        <td class="num" dir="ltr">${d(NcNestingUtilization.optimisticPercentage(total.part, total.waste))}%</td>
        <td class="num" dir="ltr">${d(NcNestingUtilization.optimisticWastePercentage(total.part, total.waste))}%</td>
        <td class="num">${hasCompleteWeight ? ton(total.weight) : "—"}</td>
        ${hasCost ? `<td class="num">${total.costKnown ? formatCost(total.cost) : "—"}</td>` : ""}
        <td class="num">${total.storageQuantity > 0 ? I18N.inlineValuesHtml([I18N.quantityHtml(total.storageQuantity, { maximumFractionDigits: 0 }), metres(total.storageLength), ...(hasCompleteWeight ? [ton(total.storageWeight)] : [])], { className: "storage-summary" }) : "—"}</td>
        <td class="num" dir="ltr">${n(total.quantity)}</td>
        <td class="center" dir="ltr">${n(total.order)}</td>
        <td class="center" dir="ltr">${leftover < 0 ? `<span class="footer-negative">${signed(leftover)}</span>` : signed(leftover)}</td>
        <td class="detail"></td>
      </tr>`;
  }

  function setGroupHover(groupIndex, enabled) {
    document.querySelectorAll(`tbody tr[data-group-index="${groupIndex}"]`).forEach(row => row.classList.toggle("group-hover", enabled));
  }

  function wireTable() {
    document.querySelectorAll(".order").forEach(editor => {
      const groupIndex = Number(editor.dataset.group);
      const orderIndex = Number(editor.dataset.order);
      const input = editor.querySelector("input");
      editor.addEventListener("click", event => event.stopPropagation());
      editor.querySelectorAll("button").forEach(button => button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const order = data.groups[groupIndex].stockOrders[orderIndex];
        order.orderQuantity = Math.max(0, order.orderQuantity + Number(button.dataset.change));
        NcNesting.saveOrderQuantities(data.batchId, data.groups);
        render();
      }));
      input.addEventListener("change", event => {
        event.stopPropagation();
        data.groups[groupIndex].stockOrders[orderIndex].orderQuantity = Math.max(0, Math.trunc(Number(input.value) || 0));
        NcNesting.saveOrderQuantities(data.batchId, data.groups);
        render();
      });
    });


    document.querySelectorAll("[data-remove-group]").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        const groupId = button.dataset.removeGroup;
        button.disabled = true;
        try {
          const removed = await NcNesting.removeSolvedGroup(data.batchId, groupId);
          if (!removed) return;
          data.groups = data.groups.filter(group => group.groupId !== groupId);
          NcNesting.saveOrderQuantities(data.batchId, data.groups);
          render();
        } catch {
          button.disabled = false;
          window.alert(t("error.removeResultGroup"));
        }
      });
    });

    document.querySelectorAll("tbody tr[data-group-index]").forEach(row => {
      const groupIndex = row.dataset.groupIndex;
      row.addEventListener("mouseenter", () => setGroupHover(groupIndex, true));
      row.addEventListener("mouseleave", () => {
        setTimeout(() => {
          const stillHovered = [...document.querySelectorAll(`tbody tr[data-group-index="${groupIndex}"]`)].some(groupRow => groupRow.matches(":hover"));
          if (!stillHovered) setGroupHover(groupIndex, false);
        }, 0);
      });
      row.addEventListener("click", event => {
        if (event.target.closest("a,button,input,.order")) return;
        const url = row.dataset.url;
        if (url && url !== "#") { if (window.NcNestingNavigation?.open) window.NcNestingNavigation.open(url); else window.location.assign(url); }
      });
    });
  }

  function updateBackArrow() {
    const arrow = document.querySelector("#backInput .back-arrow");
    if (arrow) arrow.textContent = I18N.direction() === "rtl" ? "→" : "←";
  }

  function render() {
    hasCost = Boolean(data.currency) && data.groups.some(group => group.stockOrders.some(order => order.unitPrice != null));
    hasCompleteWeight = data.groups.length > 0 && data.groups.every(group => group.weightTon != null);
    I18N.apply();
    updateBackArrow();
    renderMeta();
    renderBatchMetadata();
    renderGreedyFallbackNotice();
    renderSummary();
    renderTable();
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
    const tr = (key, params = {}) => t(key, params, language);
    const headers = [tr("csv.nestingGroup"), tr("csv.profile"), tr("csv.steelGrade"), tr("csv.length"), tr("csv.utilizationPercent"), tr("csv.wastePercent"), tr("csv.weightTon")];
    if (hasCost) headers.push(tr("csv.currency"), tr("csv.cost"));
    headers.push(tr("csv.storageQty"), tr("csv.storageLength"), tr("csv.orderQty"), tr("csv.order"), tr("csv.leftover"), tr("csv.cutPlanUrl"));
    const rows = [headers];
    data.groups.forEach(group => {
      const groupMetrics = metrics(group);
      const calculatedCost = groupCost(group);
      group.stockOrders.forEach(order => {
        const quantity = Number(order.requiredQuantity) || 0;
        const ordered = Number(order.orderQuantity) || 0;
        const row = [
          `${group.profileName} · ${group.steelGrade}`,
          group.profileName,
          group.steelGrade,
          order.stockLength ?? "",
          d(groupMetrics.utilization),
          d(groupMetrics.wastePercent),
          group.weightTon ?? ""
        ];
        if (hasCost) row.push(data.currency || "", calculatedCost == null ? "" : Math.round(Number(calculatedCost) || 0));
        row.push(group.storageStockQuantity, group.totalStorageStockLengthConsumed ?? 0, quantity, ordered, ordered - quantity, group.detailedPlanUrl || "");
        rows.push(row);
      });
    });
    const total = totals();
    const totalRow = [tr("csv.batchTotal"), "", "", "", d(NcNestingUtilization.optimisticPercentage(total.part, total.waste)), d(NcNestingUtilization.optimisticWastePercentage(total.part, total.waste)), hasCompleteWeight ? d(total.weight) : ""];
    if (hasCost) totalRow.push(data.currency || "", total.costKnown ? Math.round(total.cost) : "");
    totalRow.push(total.storageQuantity, total.storageLength, total.quantity, total.order, total.order - total.quantity, "");
    rows.push(totalRow);

    const blob = new Blob(["\uFEFF" + rows.map(row => row.map(csvEscape).join(",")).join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const fileLabel = safeFilePart(data.batchName || data.projectName);
    link.download = `NC-Nesting-Batch-Result${fileLabel ? `-${fileLabel}` : ""}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function display(source) {
    data = normalize(source);
    stateMessageKey = "batch.loadSolved";
    document.getElementById("state").hidden = true;
    document.getElementById("tableWrap").hidden = false;
    ["csv", "printPage", "printFullSet"].forEach(id => { document.getElementById(id).disabled = false; });
    render();
  }


  async function printCurrentPage() {
    try {
      await NcNestingPrint.printBatchPage(data);
    } catch {
      window.alert(t("error.printSurface"));
    }
  }

  async function printFullSet() {
    try {
      const calculation = await NcNesting.getSolvedBatch(data.batchId);
      if (!calculation) throw new Error();
      calculation.batchResult = structuredClone(data);
      if (calculation.project) calculation.project.batchName = data.batchName;
      await NcNestingPrint.printFullSet(calculation);
    } catch {
      window.alert(t("error.fullPrint"));
    }
  }

  function retranslateBatchPage() {
    I18N.apply();
    updateBackArrow();
    if (data) render();
    else document.getElementById("state").textContent = t(stateMessageKey);
  }

  I18N.apply();
  updateBackArrow();
  I18N.listen(retranslateBatchPage);
  window.addEventListener("site-navbar:ready", retranslateBatchPage, { once: true });
  document.getElementById("csv").addEventListener("click", downloadCsv);
  document.getElementById("printPage").addEventListener("click", printCurrentPage);
  document.getElementById("printFullSet").addEventListener("click", printFullSet);

  (async () => {
    try {
      await display(await load());
    } catch (error) {
      stateMessageKey = error.i18nKey || "error.batchLoad";
      document.getElementById("state").className = "error";
      document.getElementById("state").textContent = t(stateMessageKey);
    }
  })();
})();
