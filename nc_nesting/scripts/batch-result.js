(function () {
  "use strict";

        let data;
        let hasCost = false;
        let hasCompleteWeight = false;

        const nf = new Intl.NumberFormat();
        const df = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const n = value => nf.format(value);
        const d = value => df.format(value);
        const pct = (a, b) => b > 0 ? a / b * 100 : 0;
        const metres = mm => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format((Number(mm) || 0) / 1000)} m`;
        const len = mm => mm == null ? "—" : Number(mm) >= 1000 ? metres(mm) : `${n(mm)} mm`;
        const esc = value => String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
        const balanceClass = value => value > 0 ? "positive" : value < 0 ? "negative" : "zero";
        const signed = value => value > 0 ? `+${n(value)}` : n(value);
        const currencyAliases = {
            "us dollar": "USD",
            "united states dollar": "USD",
            "euro": "EUR",
            "british pound": "GBP",
            "pound sterling": "GBP",
            "israeli new shekel": "ILS",
            "new israeli shekel": "ILS",
            "swiss franc": "CHF",
            "canadian dollar": "CAD",
            "australian dollar": "AUD",
            "japanese yen": "JPY",
            "chinese yuan": "CNY",
            "renminbi": "CNY",
            "indian rupee": "INR",
            "norwegian krone": "NOK",
            "swedish krona": "SEK",
            "danish krone": "DKK",
            "polish zloty": "PLN",
            "turkish lira": "TRY"
        };

        function normalizeCurrencyName(value) {
            return String(value || "")
                .trim()
                .toLowerCase()
                .replace(/\s+/g, " ");
        }

        function resolveCurrencyCode(currencyName) {
            const normalized = normalizeCurrencyName(currencyName);

            if (!normalized) return null;
            if (/^[a-z]{3}$/.test(normalized)) return normalized.toUpperCase();
            if (currencyAliases[normalized]) return currencyAliases[normalized];

            try {
                if (Intl.supportedValuesOf && Intl.DisplayNames) {
                    const names = new Intl.DisplayNames(["en"], { type: "currency" });

                    for (const code of Intl.supportedValuesOf("currency")) {
                        if (normalizeCurrencyName(names.of(code)) === normalized) {
                            return code;
                        }
                    }
                }
            } catch {
                // Static aliases remain available for older browsers.
            }

            return null;
        }

        function currencySymbol(currencyName) {
            const code = resolveCurrencyCode(currencyName);
            if (!code) return "";

            try {
                const part = new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: code,
                    currencyDisplay: "narrowSymbol",
                    maximumFractionDigits: 0
                }).formatToParts(0).find(item => item.type === "currency");

                return part?.value || code;
            } catch {
                return code;
            }
        }

        function formatCost(value) {
            if (value == null) return "—";

            const amount = Math.round(Number(value) || 0);
            const code = resolveCurrencyCode(data?.currency);

            if (code) {
                try {
                    return new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: code,
                        currencyDisplay: "narrowSymbol",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                    }).format(amount);
                } catch {
                    // Fall through to symbol/name formatting.
                }
            }

            const symbol = currencySymbol(data?.currency);
            return symbol
                ? `${symbol}${n(amount)}`
                : `${n(amount)}${data?.currency ? ` ${data.currency}` : ""}`;
        }

        function metrics(group) {
            const stock = Number(group.totalStockLengthConsumed) || 0;
            const used = Number(group.totalConsumedLength) || 0;
            const storage = Number(group.totalStorageStockLengthConsumed) || 0;
            const reusable = Number(group.totalReusableOffcutLength) || 0;
            const waste = group.totalOffcutLength == null
                ? Math.max(stock - used, 0)
                : Math.max(Number(group.totalOffcutLength) || 0, 0);

            return {
                stock, used, storage, reusable, waste,
                utilization: pct(used, stock),
                wastePercent: pct(waste, stock),
                storageShare: pct(storage, stock),
                reusableShare: pct(reusable, stock)
            };
        }

        function normalize(source) {
            const normalized = structuredClone(source);

            normalized.groups = (normalized.groups || []).map(group => {
                group.storageStockQuantity = Math.max(0, Math.trunc(Number(group.storageStockQuantity) || 0));
                group.profileKeilogramPerMeter = group.profileKeilogramPerMeter != null
                    && Number.isFinite(Number(group.profileKeilogramPerMeter))
                    && Number(group.profileKeilogramPerMeter) >= 0
                    ? Number(group.profileKeilogramPerMeter)
                    : null;
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
                    orderQuantity: Math.max(
                        0,
                        Math.trunc(
                            order.orderQuantity == null
                                ? Number(order.requiredQuantity) || 0
                                : Number(order.orderQuantity) || 0
                        )
                    )
                }));

                return group;
            });

            return normalized;
        }

        async function load() {
            const params = new URLSearchParams(location.search);
            const batchId = params.get("batchId");
            if (!batchId) throw new Error("A batch ID is required. Return to Batch input and solve a batch.");
            document.getElementById("backInput").href = `index.html?batchId=${encodeURIComponent(batchId)}`;
            const stored = await NcNesting.getBatchResult(batchId);
            if (!stored) throw new Error("This solved batch is not available in this browser. Solve it again from Batch input.");
            const normalized = normalize(stored);
            normalized.groups.forEach(group => {
                group.detailedPlanUrl = `cutting-plan.html?batchId=${encodeURIComponent(batchId)}&groupId=${encodeURIComponent(group.groupId)}`;
            });
            return normalized;
        }

        function groupCost(group) {
            let cost = 0;
            for (const order of group.stockOrders) {
                const quantity = Number(order.orderQuantity) || 0;
                if (quantity > 0 && order.unitPrice == null) return null;
                cost += quantity * (Number(order.unitPrice) || 0);
            }
            return cost;
        }

        function totals() {
            return data.groups.reduce((total, group) => {
                const groupMetrics = metrics(group);

                total.stock += groupMetrics.stock;
                total.used += groupMetrics.used;
                total.storageLength += groupMetrics.storage;
                total.reusable += groupMetrics.reusable;
                total.waste += groupMetrics.waste;
                if (group.weightTon != null) total.weight += Number(group.weightTon) || 0;
                total.storageQuantity += Number(group.storageStockQuantity) || 0;
                if (group.storageStockWeightTon != null) total.storageWeight += Number(group.storageStockWeightTon) || 0;
                const calculatedCost = groupCost(group);
                if (calculatedCost == null) total.costKnown = false;
                else total.cost += calculatedCost;

                group.stockOrders.forEach(order => {
                    total.quantity += Number(order.requiredQuantity) || 0;
                    total.order += Number(order.orderQuantity) || 0;
                });

                return total;
            }, {
                stock: 0, used: 0, storageLength: 0, reusable: 0, waste: 0, weight: 0,
                storageQuantity: 0, storageWeight: 0, cost: 0, costKnown: true, quantity: 0, order: 0
            });
        }

        function renderMeta() {
            document.getElementById("meta").innerHTML = `
        <span><strong>Batch:</strong> ${esc(data.batchId || "—")}</span>
        <span><strong>Generated:</strong> ${esc(data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—")}</span>
        <span><strong>Groups:</strong> ${n(data.groups.length)}</span>
        ${data.currency ? `<span><strong>Currency:</strong> ${esc(data.currency)}</span>` : ""}
      `;

        }

        function renderSummary() {
            const total = totals();

            const cards = [
                ["Stock order quantity", n(total.order), `${n(total.quantity)} required`],
                ["Utilization", `${d(pct(total.used, total.stock))}%`, `${len(total.used)} consumed`],
                ["Waste", `${d(pct(total.waste, total.stock))}%`, `${len(total.waste)} offcut`]
            ];

            if (hasCompleteWeight) {
                cards.push(["Batch weight", `${d(total.weight)} t`, `${n(data.groups.length)} nesting groups`]);
            }

            cards.push(
                ["Storage stock share", `${d(pct(total.storageLength, total.stock))}%`, `${len(total.storageLength)} from storage`],
                ["Reusable returned", `${d(pct(total.reusable, total.stock))}%`, `${len(total.reusable)} reusable`]
            );

            document.getElementById("summary").innerHTML = cards.map(card => `
        <div class="metric">
          <small>${esc(card[0])}</small>
          <b>${esc(card[1])}</b>
          <span>${esc(card[2])}</span>
        </div>
      `).join("");
        }

        function storageCell(group) {
            const weight = group.storageStockWeightTon == null ? "" : ` · ${d(group.storageStockWeightTon)} t`;
            return `
        <div class="storage-summary">
          <span class="storage-main">${n(group.storageStockQuantity)} pcs</span>
          <span class="storage-secondary">· ${metres(group.totalStorageStockLengthConsumed)}${weight}</span>
        </div>
      `;
        }

        function renderTable() {
                        hasCost = data.groups.some(group => group.stockOrders.some(order => order.unitPrice != null));
                        hasCompleteWeight = data.groups.length > 0 && data.groups.every(group => group.weightTon != null);

            const costHeader = document.getElementById("costHeader");
                        const weightHeader = document.getElementById("weightHeader");
            const symbol = currencySymbol(data.currency);

            costHeader.hidden = !hasCost;
            costHeader.textContent = symbol ? `Cost (${symbol})` : "Cost";
            weightHeader.hidden = false;

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
                    const rowClass = isFirst && isLast
                        ? "group-first group-last"
                        : isFirst
                            ? "group-first"
                            : isLast
                                ? "group-last"
                                : "group-middle";

                    output += `
            <tr
              class="${rowClass}"
              data-group-index="${groupIndex}"
              data-url="${esc(group.detailedPlanUrl || "#")}"
            >
              ${orderIndex === 0 ? `
                <td class="profile" rowspan="${span}">
                  <b>${esc(group.profileName)}</b>
                  <span>${esc(group.steelGrade)}</span>
                </td>
              `: ""}

              <td class="num">${order.stockLength == null ? "—" : len(order.stockLength)}</td>

              ${orderIndex === 0 ? `
                <td class="num percent" rowspan="${span}">
                  <b>${d(groupMetrics.utilization)}%</b>
                  <span>${len(groupMetrics.used)}</span>
                </td>

                <td class="num percent" rowspan="${span}">
                  <b>${d(groupMetrics.wastePercent)}%</b>
                  <span>${len(groupMetrics.waste)}</span>
                </td>

                <td class="num" rowspan="${span}">
                  ${group.weightTon == null ? "—" : `${d(Number(group.weightTon))} t`}
                </td>

                ${hasCost ? `
                  <td class="num" rowspan="${span}">
                                        ${formatCost(calculatedCost)}
                  </td>
                `: ""}

                <td class="num" rowspan="${span}">
                  ${storageCell(group)}
                </td>
              `: ""}

              <td class="num">${n(quantity)}</td>

              <td class="center">
                <div class="order" data-group="${groupIndex}" data-order="${orderIndex}">
                  <button type="button" data-change="-1" aria-label="Decrease order quantity">−</button>
                  <input type="number" min="0" step="1" value="${ordered}" aria-label="Order quantity">
                  <button type="button" data-change="1" aria-label="Increase order quantity">+</button>
                </div>
              </td>

              <td class="center">
                <span class="balance ${balanceClass(leftover)}">${signed(leftover)}</span>
              </td>

              ${orderIndex === 0 ? `
                <td class="detail" rowspan="${span}">
                  <a href="${esc(group.detailedPlanUrl || "#")}">View cut plan →</a>
                </td>
              `: ""}
            </tr>
          `;
                });
            });

            document.getElementById("body").innerHTML = output;
            wireTable();
            renderFooter();
        }

        function footerLeftover(value) {
            if (value < 0) {
                return `<span class="footer-negative">${signed(value)}</span>`;
            }

            return signed(value);
        }

        function renderFooter() {
            const total = totals();
            const leftover = total.order - total.quantity;

            document.getElementById("foot").innerHTML = `
        <tr>
          <td colspan="2">Batch total / weighted result</td>
          <td class="num">${d(pct(total.used, total.stock))}%</td>
          <td class="num">${d(pct(total.waste, total.stock))}%</td>
                                        <td class="num">${hasCompleteWeight ? `${d(total.weight)} t` : "—"}</td>
                    ${hasCost ? `<td class="num">${total.costKnown ? formatCost(total.cost) : "—"}</td>` : ""}
          <td class="num">
            <div class="storage-summary">
              <span class="storage-main">${n(total.storageQuantity)} pcs</span>
                            <span class="storage-secondary">· ${metres(total.storageLength)}${hasCompleteWeight ? ` · ${d(total.storageWeight)} t` : ""}</span>
            </div>
          </td>
          <td class="num">${n(total.quantity)}</td>
          <td class="center">${n(total.order)}</td>
          <td class="center">${footerLeftover(leftover)}</td>
          <td class="detail"></td>
        </tr>
      `;
        }

        function setGroupHover(groupIndex, enabled) {
            document.querySelectorAll(`tbody tr[data-group-index="${groupIndex}"]`).forEach(row => {
                row.classList.toggle("group-hover", enabled);
            });
        }

        function wireTable() {
            document.querySelectorAll(".order").forEach(editor => {
                const groupIndex = Number(editor.dataset.group);
                const orderIndex = Number(editor.dataset.order);
                const input = editor.querySelector("input");

                editor.addEventListener("click", event => event.stopPropagation());

                editor.querySelectorAll("button").forEach(button => {
                    button.addEventListener("click", event => {
                        event.preventDefault();
                        event.stopPropagation();

                        const order = data.groups[groupIndex].stockOrders[orderIndex];
                        order.orderQuantity = Math.max(
                            0,
                            order.orderQuantity + Number(button.dataset.change)
                        );

                        NcNesting.saveOrderQuantities(data.batchId, data.groups);
                        render();
                    });
                });

                input.addEventListener("change", event => {
                    event.stopPropagation();

                    data.groups[groupIndex].stockOrders[orderIndex].orderQuantity = Math.max(
                        0,
                        Math.trunc(Number(input.value) || 0)
                    );

                    NcNesting.saveOrderQuantities(data.batchId, data.groups);
                    render();
                });
            });

            document.querySelectorAll("tbody tr[data-group-index]").forEach(row => {
                const groupIndex = row.dataset.groupIndex;

                row.addEventListener("mouseenter", () => setGroupHover(groupIndex, true));

                row.addEventListener("mouseleave", () => {
                    setTimeout(() => {
                        const stillHovered = [...document.querySelectorAll(`tbody tr[data-group-index="${groupIndex}"]`)]
                            .some(groupRow => groupRow.matches(":hover"));

                        if (!stillHovered) {
                            setGroupHover(groupIndex, false);
                        }
                    }, 0);
                });

                row.addEventListener("click", event => {
                    if (event.target.closest("a,button,input,.order")) return;

                    const url = row.dataset.url;
                    if (url && url !== "#") {
                        location.href = url;
                    }
                });
            });
        }

        function render() {
            hasCost = data.groups.some(group => group.stockOrders.some(order => order.unitPrice != null));
            hasCompleteWeight = data.groups.length > 0 && data.groups.every(group => group.weightTon != null);
            renderMeta();
            renderSummary();
            renderTable();
        }

        function csvEscape(value) {
            const text = String(value ?? "");
            return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
        }

        function downloadCsv() {
            const headers = [
                "Nesting Group", "Profile", "Steel Grade", "Length",
                "Utilization %", "Waste %", "Weight (ton)"
            ];

            if (hasCost) {
                headers.push("Cost", "Currency");
            }

            headers.push(
                "Storage QTY", "Storage Length (mm)",
                "Order QTY", "ORDER", "LEFTOVER", "Cut Plan URL"
            );

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

                    if (hasCost) {
                        row.push(
                            calculatedCost == null ? "" : Math.round(Number(calculatedCost) || 0),
                            data.currency || ""
                        );
                    }

                    row.push(
                        group.storageStockQuantity,
                        group.totalStorageStockLengthConsumed ?? 0,
                        quantity,
                        ordered,
                        ordered - quantity,
                        group.detailedPlanUrl || ""
                    );

                    rows.push(row);
                });
            });

            const total = totals();
            const totalRow = [
                "BATCH TOTAL", "", "", "",
                d(pct(total.used, total.stock)),
                d(pct(total.waste, total.stock)),
                hasCompleteWeight ? d(total.weight) : ""
            ];

            if (hasCost) {
                totalRow.push(total.costKnown ? Math.round(total.cost) : "", data.currency || "");
            }

            totalRow.push(
                total.storageQuantity,
                total.storageLength,
                total.quantity,
                total.order,
                total.order - total.quantity,
                ""
            );

            rows.push(totalRow);

            const blob = new Blob(
                ["\uFEFF" + rows.map(row => row.map(csvEscape).join(",")).join("\r\n") + "\r\n"],
                { type: "text/csv;charset=utf-8" }
            );

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = `NcNesting-batch-result${data.batchId ? `-${data.batchId}` : ""}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(url), 0);
        }

        async function display(source) {
            data = normalize(source);
            document.getElementById("state").hidden = true;
            document.getElementById("tableWrap").hidden = false;
            render();
        }

        async function printFullSet() {
            try {
                const calculation = await NcNesting.getSolvedBatch(data.batchId);
                if (!calculation) throw new Error("The complete solved batch is not available in this browser.");
                calculation.batchResult = structuredClone(data);
                await NcNestingPrint.printFullSet(calculation);
            } catch (error) {
                window.alert(error.message || "Unable to create the full print set.");
            }
        }

        document.getElementById("csv").addEventListener("click", downloadCsv);
        document.getElementById("printPage").addEventListener("click", () => NcNestingPrint.printBatchPage(data));
        document.getElementById("printFullSet").addEventListener("click", printFullSet);

        (async () => {
            try {
                await display(await load());
            } catch (error) {
                document.getElementById("state").className = "error";
                document.getElementById("state").textContent = error.message || "Unable to load batch result";
            }
        })();
    
})();
