(function () {
  "use strict";

  const PROJECT_SCHEMA_VERSION = "1.0";
  let state = createProjectState();
  let isHydrating = false;
  let isAutoFilling = false;
  let autoFillMessages = [];

  function createProjectState() {
    return {
      projectId: NcNesting.createProjectId(),
      createdAtUtc: new Date().toISOString(),
      parts: [],
      stockOrders: [],
      storage: [],
      autoFillOrders: true,
      groupIds: {},
      nextIds: { stockOrders: 1, storage: 1, groups: 1 },
      projectGroups: [],
      solveRequest: null,
      solveResponse: null
    };
  }

  function clone(value) {
    return globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }
  let backendErrors = [];
  let isSolving = false;

  const body = {
    parts: document.getElementById("partsBody"),
    stockOrders: document.getElementById("stockBody"),
    storage: document.getElementById("storageBody")
  };

  const visual = {
    parts: [["position", "text"], ["steelGrade", "text"], ["quantity", "number"], ["profile", "text"], ["length", "number"], ["source", "text", true]],
    stockOrders: [["stockId", "text"], ["profile", "text"], ["steelGrade", "text"], ["length", "number"], ["availability", "availability"], ["price", "price"]],
    storage: [["storageId", "text"], ["profile", "text"], ["steelGrade", "text"], ["length", "number"], ["quantity", "number"], ["storageArea", "text"]]
  };

  const csv = {
    parts: [["position", "Position", "text"], ["steelGrade", "Steel Grade", "text"], ["quantity", "Quantity", "number"], ["profile", "Profile", "text"], ["length", "Length", "number"], ["source", "Source", "text"]],
    stockOrders: [["stockId", "Stock Order ID", "text"], ["profile", "Profile", "text"], ["steelGrade", "Steel Grade", "text"], ["length", "Length", "number"], ["quantity", "Quantity", "number"], ["unlimited", "Unlimited", "checkbox"], ["price", "Price", "price"]],
    storage: [["storageId", "Storage Stock ID", "text"], ["profile", "Profile", "text"], ["steelGrade", "Steel Grade", "text"], ["length", "Length", "number"], ["quantity", "Quantity", "number"], ["storageArea", "Storage Area", "text"]]
  };

  const aliases = {
    parts: {
      position: ["position", "partposition", "partid", "id"], steelGrade: ["steelgrade", "grade", "material"], quantity: ["quantity", "qty"], profile: ["profile", "profilename", "section"], length: ["length", "partlength"], source: ["source", "filename", "ncfile"]
    },
    stockOrders: {
      stockId: ["stockorderid", "stockid", "id", "stocktypeid"], profile: ["profile", "profilename", "section"], steelGrade: ["steelgrade", "grade"], length: ["length", "stocklength"], quantity: ["quantity", "qty", "availablequantity"], unlimited: ["unlimited", "isunlimited"], price: ["price", "optionalprice", "cost"]
    },
    storage: {
      storageId: ["storagestockid", "storageid", "id"], profile: ["profile", "profilename"], steelGrade: ["steelgrade", "grade"], length: ["length", "stocklength"], quantity: ["quantity", "qty"], storageArea: ["storagearea", "area", "bay"]
    }
  };

  const fileNames = {
    parts: "NcNesting-parts.csv",
    stockOrders: "NcNesting-stock-orders.csv",
    storage: "NcNesting-storage-stock.csv"
  };

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

  function migrateGeneratedOrderId(value) {
    const text = String(value || "").trim();
    const match = /^Stock-([A-Z]+)$/i.exec(text);
    return match ? `Order-${match[1].toUpperCase()}` : text;
  }

  function allocateGeneratedId(type) {
    const prefix = type === "stockOrders" ? "Order" : "Storage";
    const key = type === "stockOrders" ? "stockId" : "storageId";
    const used = new Set((state[type] || []).flatMap(row => [row.generatedId, row[key]])
      .map(value => String(value || "").trim().toLowerCase())
      .filter(Boolean));
    let sequence = Math.max(1, Math.trunc(Number(state.nextIds[type]) || 1));
    let candidate;
    do {
      candidate = `${prefix}-${letterSuffix(sequence)}`;
      sequence++;
    } while (used.has(candidate.toLowerCase()));
    state.nextIds[type] = sequence;
    return candidate;
  }

  function blank(type) {
    if (type === "parts") return { position: "", steelGrade: "", quantity: 1, profile: "", length: "", source: "Manual" };
    if (type === "stockOrders") return { generatedId: allocateGeneratedId(type), stockId: "", profile: "", steelGrade: "", length: "", quantity: 1, lastFiniteQuantity: 1, unlimited: false, price: "" };
    return { generatedId: allocateGeneratedId(type), storageId: "", profile: "", steelGrade: "", length: "", quantity: 1, storageArea: "" };
  }

  function ensureGeneratedId(type, row) {
    if (type === "stockOrders" && row.generatedId) row.generatedId = migrateGeneratedOrderId(row.generatedId);
    if (!row.generatedId) row.generatedId = allocateGeneratedId(type);
    return row.generatedId;
  }

  function defaultId(type, row) {
    return ensureGeneratedId(type, row);
  }

  function finalId(type, row) {
    const key = type === "stockOrders" ? "stockId" : "storageId";
    return String(row[key] || "").trim() || defaultId(type, row);
  }

  function setMeta(element, table, row, column, field) {
    Object.assign(element.dataset, { table, row, column, field });
  }

  function render(type) {
    body[type].innerHTML = "";
    state[type].forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      visual[type].forEach(([field, inputType, readOnly, decimal], columnIndex) => {
        const td = document.createElement("td");
        if (inputType === "availability") {
          renderAvailability(td, row, rowIndex, columnIndex);
        } else if (readOnly) {
          const value = type === "parts" && field === "source"
            ? (String(row[field] || "").trim() || "Manual")
            : String(row[field] ?? "");
          row[field] = value;
          td.className = "read-only-cell";
          const text = document.createElement("span");
          text.className = "read-only-value";
          text.textContent = value;
          td.appendChild(text);
        } else {
          const input = document.createElement("input");
          input.type = inputType === "number" || inputType === "price" ? "number" : "text";
          if (inputType === "number" || inputType === "price") {
            input.min = inputType === "price" ? "1" : "0";
            input.step = "1";
          }
          input.value = row[field] ?? "";
          setMeta(input, type, rowIndex, columnIndex, field);
          if ((type === "stockOrders" && field === "stockId") || (type === "storage" && field === "storageId")) {
            input.placeholder = defaultId(type, row);
          }
          input.oninput = event => {
            state[type][rowIndex][field] = event.target.value;
            afterDataChange(type);
          };
          input.onpaste = pasteMatrix;
          if (inputType === "number" && !decimal) {
            input.onblur = () => {
              if (input.value !== "") {
                input.value = Math.ceil(Number(input.value));
                row[field] = input.value;
                afterDataChange(type);
              }
            };
          }
          td.appendChild(input);
        }
        tr.appendChild(td);
      });

      const actionCell = document.createElement("td");
      actionCell.className = "action-cell";
      const removeButton = document.createElement("button");
      removeButton.className = "remove";
      removeButton.type = "button";
      removeButton.textContent = "×";
      removeButton.title = "Remove row";
      removeButton.onclick = () => {
        state[type].splice(rowIndex, 1);
        render(type);
        afterDataChange(type);
      };
      actionCell.appendChild(removeButton);
      tr.appendChild(actionCell);
      body[type].appendChild(tr);
    });
  }

  function positiveWholeNumber(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
  }

  function optionalPositiveWholeNumber(value) {
    const text = String(value ?? "").trim();
    if (!text) return { blank: true, value: null };
    if (!/^[1-9]\d*$/.test(text)) return { blank: false, value: null };
    const number = Number(text);
    return Number.isSafeInteger(number) ? { blank: false, value: number } : { blank: false, value: null };
  }

  function restoredQuantity(row) {
    return positiveWholeNumber(row.quantity) ?? positiveWholeNumber(row.lastFiniteQuantity) ?? 1;
  }

  function rememberQuantity(row, value) {
    row.quantity = value;
    const quantity = positiveWholeNumber(value);
    if (quantity !== null) row.lastFiniteQuantity = quantity;
  }

  function setUnlimited(row, unlimited) {
    const quantity = restoredQuantity(row);
    row.quantity = quantity;
    row.lastFiniteQuantity = quantity;
    row.unlimited = unlimited;
  }

  function renderAvailability(td, row, rowIndex, columnIndex) {
    td.className = "qty-cell";
    const wrapper = document.createElement("div");
    wrapper.className = "qty-control";
    const quantity = document.createElement("input");
    quantity.className = "qty";
    setMeta(quantity, "stockOrders", rowIndex, columnIndex, "availability");

    if (row.unlimited) {
      setUnlimited(row, true);
      quantity.type = "text";
      quantity.value = "∞";
      quantity.readOnly = true;
      quantity.classList.add("infinity");
    } else {
      quantity.type = "number";
      quantity.min = "1";
      quantity.step = "1";
      quantity.value = row.quantity ?? restoredQuantity(row);
      quantity.oninput = event => {
        rememberQuantity(row, event.target.value);
        validate();
      };
      quantity.onblur = () => {
        const normalized = positiveWholeNumber(quantity.value);
        if (normalized !== null) {
          quantity.value = normalized;
          rememberQuantity(row, normalized);
        }
        validate();
      };
    }
    quantity.onpaste = pasteMatrix;

    const label = document.createElement("label");
    label.className = "unlimited";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(row.unlimited);
    checkbox.onchange = () => {
      setUnlimited(row, checkbox.checked);
      render("stockOrders");
      validate();
    };
    label.append(checkbox, document.createTextNode("Unlimited"));
    wrapper.append(quantity, label);
    td.appendChild(wrapper);
  }

  function normalize(type, value) {
    const text = String(value ?? "").trim();
    if (type === "checkbox") return ["true", "yes", "y", "1", "unlimited", "∞"].includes(text.toLowerCase());
    if (type === "price") return text;
    if (type === "number" || type === "decimal") {
      if (text === "") return "";
      const number = Number(text.replace(",", "."));
      return Number.isFinite(number) ? (type === "number" ? Math.ceil(number) : number) : "";
    }
    return text;
  }

  function applyVisual(type, row, column, raw) {
    const [field, inputType, readOnly] = column;
    if (readOnly) return;
    if (inputType === "availability") {
      const text = String(raw ?? "").trim();
      const unlimited = ["true", "yes", "y", "unlimited", "∞"].includes(text.toLowerCase());
      if (unlimited) {
        setUnlimited(row, true);
        return;
      }
      row.unlimited = false;
      rememberQuantity(row, text.replace(",", "."));
      return;
    }
    row[field] = normalize(inputType, raw);
  }

  function pasteMatrix(event) {
    const text = event.clipboardData.getData("text");
    if (!/[\t\r\n]/.test(text) && !["availability", "price"].includes(event.target.dataset.field)) return;
    event.preventDefault();
    const type = event.target.dataset.table;
    const startRow = Number(event.target.dataset.row);
    const startColumn = Number(event.target.dataset.column);
    const rows = text.replace(/\r/g, "").split("\n").filter((line, index, all) => !(index === all.length - 1 && line === "")).map(line => line.split("\t"));
    rows.forEach((values, rowOffset) => {
      while (state[type].length <= startRow + rowOffset) state[type].push(blank(type));
      values.forEach((value, columnOffset) => {
        if (startColumn + columnOffset < visual[type].length) {
          applyVisual(type, state[type][startRow + rowOffset], visual[type][startColumn + columnOffset], value);
        }
      });
    });
    render(type);
    afterDataChange(type);
  }

  function add(type) {
    state[type].push(blank(type));
    render(type);
    afterDataChange(type);
  }

  function canonical(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function detectDelimiter(text) {
    const firstLine = text.replace(/\r/g, "").split("\n")[0] || "";
    return [["\t", (firstLine.match(/\t/g) || []).length], [",", (firstLine.match(/,/g) || []).length], [";", (firstLine.match(/;/g) || []).length]].sort((a, b) => b[1] - a[1])[0][0];
  }

  function parseLine(line, delimiter) {
    const output = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          current += '"';
          index++;
        } else {
          quoted = !quoted;
        }
      } else if (character === delimiter && !quoted) {
        output.push(current);
        current = "";
      } else {
        current += character;
      }
    }
    output.push(current);
    return output;
  }

  function importCsv(type, text) {
    const delimiter = detectDelimiter(text);
    const lines = text.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n").filter(line => line.trim());
    if (!lines.length) return;
    const first = parseLine(lines[0], delimiter);
    const map = {};
    first.forEach((cell, index) => {
      const key = canonical(cell);
      Object.entries(aliases[type]).forEach(([field, names]) => {
        if (names.includes(key)) map[index] = field;
      });
    });
    const hasHeader = Object.keys(map).length >= 2;
    const rows = hasHeader ? lines.slice(1) : lines;
    rows.forEach(line => {
      const cells = parseLine(line, delimiter);
      const row = blank(type);
      cells.forEach((cell, index) => {
        const field = hasHeader ? map[index] : csv[type][index]?.[0];
        if (!field) return;
        const valueType = csv[type].find(column => column[0] === field)?.[2] || "text";
        row[field] = normalize(valueType, cell);
      });
      if (type === "stockOrders") row.lastFiniteQuantity = restoredQuantity(row);
      if (type === "parts") row.source = "CSV";
      state[type].push(row);
    });
    render(type);
    afterDataChange(type);
  }

  async function fileImport(type, input) {
    const file = input.files?.[0];
    if (!file) return;
    importCsv(type, await file.text());
    input.value = "";
  }

  function active(type) {
    if (type === "parts") return state[type].filter(row => ["position", "steelGrade", "profile", "length"].some(key => String(row[key] || "").trim()));
    if (type === "stockOrders") return state[type].filter(row => ["stockId", "profile", "steelGrade", "length", "price"].some(key => String(row[key] || "").trim()) || row.unlimited);
    return state[type].filter(row => ["storageId", "profile", "steelGrade", "length", "storageArea"].some(key => String(row[key] || "").trim()));
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function download(type) {
    const rows = active(type).map((row, index) => type === "stockOrders"
      ? { ...row, stockId: finalId(type, row), unlimited: Boolean(row.unlimited) }
      : type === "storage" ? { ...row, storageId: finalId(type, row) } : row);
    const lines = [csv[type].map(column => csvEscape(column[1])).join(",")];
    rows.forEach(row => lines.push(csv[type].map(([field, , valueType]) => csvEscape(valueType === "checkbox" ? (row[field] ? "true" : "false") : row[field])).join(",")));
    const blob = new Blob(["\uFEFF" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileNames[type];
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function parseNc(name, text) {
    const lines = text.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n").map(line => line.trim());
    const startIndex = lines.findIndex(line => line.startsWith("ST"));
    if (startIndex < 0) throw new Error(`${name}: ST header was not found.`);
    const get = offset => lines[startIndex + offset] || "";
    const position = get(3);
    const steelGrade = get(6);
    const quantityText = get(7);
    const quantity = /^\d+$/.test(quantityText) ? Number(quantityText) : NaN;
    const profile = get(8);
    const length = Number(get(10).replace(",", "."));
    if (!position || !steelGrade || !profile || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(length) || length <= 0) {
      throw new Error(`${name}: required ST fields are missing or invalid.`);
    }
    return { position, steelGrade, quantity, profile, length: Math.ceil(length), source: "NC file" };
  }

  async function importNc(files) {
    const errors = [];
    for (const file of files) {
      if (!/\.nc1$/i.test(file.name)) {
        errors.push(`${file.name}: unsupported file type; only .nc1 files are accepted.`);
        continue;
      }
      try {
        state.parts.push(parseNc(file.name, await file.text()));
      } catch (error) {
        errors.push(error.message);
      }
    }
    document.getElementById("ncErrors").textContent = errors.join("\n");
    render("parts");
    afterDataChange("parts");
  }

  function numberFromInput(id) {
    const number = Number(document.getElementById(id).value);
    return Number.isFinite(number) ? Math.ceil(number) : NaN;
  }

  function rowNumber(row, key) {
    const number = Number(row[key]);
    return Number.isFinite(number) ? number : NaN;
  }

  function groupKey(profileName, steelGrade) {
    return `${profileName.trim().toUpperCase()}\u0000${steelGrade.trim().toUpperCase()}`;
  }

  function collectGroups(parts) {
    const groups = new Map();
    const partsById = new Map();

    parts.forEach((row, index) => {
      const partId = String(row.position).trim();
      const profileName = String(row.profile).trim();
      const steelGrade = String(row.steelGrade).trim();
      const length = Math.ceil(Number(row.length));
      const quantity = Math.ceil(Number(row.quantity));
      const key = groupKey(profileName, steelGrade);
      const existing = partsById.get(partId.toLowerCase());

      if (existing && (existing.key !== key || existing.length !== length)) {
        throw new Error(`Part position '${partId}' conflicts with an earlier row because its profile, grade, or length differs.`);
      }

      if (!groups.has(key)) {
        groups.set(key, { profileName, steelGrade, parts: new Map() });
      }

      const canonicalPartId = existing?.partId || partId;
      const group = groups.get(key);
      if (!group.parts.has(canonicalPartId)) {
        group.parts.set(canonicalPartId, { partId: canonicalPartId, length, quantity: 0, sources: [] });
      }
      const part = group.parts.get(canonicalPartId);
      part.quantity += quantity;
      const source = String(row.source || "Manual").trim();
      if (source && !part.sources.includes(source)) part.sources.push(source);
      partsById.set(partId.toLowerCase(), { key, length, partId: canonicalPartId });
    });

    return [...groups.values()]
      .sort((left, right) => left.profileName.localeCompare(right.profileName, undefined, { sensitivity: "base" }) || left.steelGrade.localeCompare(right.steelGrade, undefined, { sensitivity: "base" }))
      .map(group => {
        const key = groupKey(group.profileName, group.steelGrade);
        if (!state.groupIds[key]) state.groupIds[key] = `group-${state.nextIds.groups++}`;
        return { ...group, groupId: state.groupIds[key], partRequirements: [...group.parts.values()] };
      });
  }


  function sameNormalizedText(left, right) {
    return String(left || "").trim().localeCompare(String(right || "").trim(), undefined, { sensitivity: "base" }) === 0;
  }

  function renderAutoFillState() {
    const checkbox = document.getElementById("autoFillOrders");
    const stateLabel = document.getElementById("autoFillState");
    if (checkbox) checkbox.checked = state.autoFillOrders !== false;
    if (stateLabel) stateLabel.textContent = state.autoFillOrders === false ? "Off" : "On";
    const notice = document.getElementById("autoFillNotice");
    if (!notice) return;
    notice.hidden = autoFillMessages.length === 0;
    notice.innerHTML = autoFillMessages.length
      ? `<strong>Auto-fill needs attention.</strong><ul>${autoFillMessages.map(message => `<li>${escapeHtml(message)}</li>`).join("")}</ul>`
      : "";
  }

  function autoFillPartGroups() {
    const groups = new Map();
    state.parts.forEach(row => {
      const profile = String(row.profile || "").trim();
      const steelGrade = String(row.steelGrade || "").trim();
      const quantity = positiveWholeNumber(row.quantity);
      const rawLength = Number(row.length);
      const length = Number.isFinite(rawLength) && rawLength > 0 ? Math.ceil(rawLength) : null;
      if (!profile || !steelGrade || quantity === null || length === null) return;
      const key = groupKey(profile, steelGrade);
      if (!groups.has(key)) groups.set(key, { profile, steelGrade, requiredLength: 0, longestPart: 0 });
      const group = groups.get(key);
      group.requiredLength += length * quantity;
      group.longestPart = Math.max(group.longestPart, length);
    });
    return [...groups.values()];
  }

  function consumeSharedCapacity(sharedRows, requiredLength, needsLongPiece, longestPart) {
    const planned = new Map();
    let supplied = 0;

    function take(record, quantity) {
      const amount = Math.min(record.remaining, Math.max(0, Math.trunc(quantity)));
      if (!amount) return;
      planned.set(record, (planned.get(record) || 0) + amount);
      supplied += record.length * amount;
    }

    if (needsLongPiece) {
      const fitting = sharedRows
        .filter(record => record.remaining > 0 && record.length >= longestPart)
        .sort((left, right) => left.length - right.length)[0];
      if (!fitting) return false;
      take(fitting, 1);
    }

    const ordered = [...sharedRows].sort((left, right) => left.length - right.length);
    for (const record of ordered) {
      const alreadyPlanned = planned.get(record) || 0;
      const available = record.remaining - alreadyPlanned;
      if (available <= 0 || supplied >= requiredLength) continue;
      const quantity = Math.min(available, Math.ceil((requiredLength - supplied) / record.length));
      take(record, quantity);
    }

    if (supplied < requiredLength) return false;
    planned.forEach((quantity, record) => { record.remaining -= quantity; });
    return true;
  }

  function runAutoFill() {
    if (isHydrating || isAutoFilling) return false;
    autoFillMessages = [];
    renderAutoFillState();
    if (state.autoFillOrders === false) return false;

    isAutoFilling = true;
    let changed = false;
    try {
      const groups = autoFillPartGroups();
      const sharedByProfile = new Map();

      active("stockOrders").forEach(row => {
        const profile = String(row.profile || "").trim();
        const steelGrade = String(row.steelGrade || "").trim();
        const length = Number(row.length);
        const quantity = positiveWholeNumber(row.quantity);
        if (!profile || steelGrade || row.unlimited || !Number.isFinite(length) || length <= 0 || quantity === null) return;
        const key = profile.toLowerCase();
        if (!sharedByProfile.has(key)) sharedByProfile.set(key, []);
        sharedByProfile.get(key).push({ row, length: Math.ceil(length), remaining: quantity });
      });

      groups.forEach(group => {
        const matching = active("stockOrders").filter(row => {
          const rowProfile = String(row.profile || "").trim();
          const rowGrade = String(row.steelGrade || "").trim();
          return sameNormalizedText(rowProfile, group.profile)
            && (!rowGrade || sameNormalizedText(rowGrade, group.steelGrade));
        });

        const unlimitedCover = matching.some(row => row.unlimited && Number(row.length) >= group.longestPart);
        if (unlimitedCover) return;

        const exactFinite = matching.filter(row => {
          const rowGrade = String(row.steelGrade || "").trim();
          return rowGrade && sameNormalizedText(rowGrade, group.steelGrade) && !row.unlimited && positiveWholeNumber(row.quantity) !== null && Number(row.length) > 0;
        });
        const exactLength = exactFinite.reduce((total, row) => total + Math.ceil(Number(row.length)) * positiveWholeNumber(row.quantity), 0);
        const exactFits = exactFinite.some(row => Number(row.length) >= group.longestPart);
        const sharedRows = sharedByProfile.get(group.profile.toLowerCase()) || [];
        const sharedLength = sharedRows.reduce((total, row) => total + row.length * row.remaining, 0);
        const sharedFits = sharedRows.some(row => row.remaining > 0 && row.length >= group.longestPart);
        const enoughLength = exactLength + sharedLength >= group.requiredLength;
        const hasFit = exactFits || sharedFits;

        if (enoughLength && hasFit) {
          const requiredShared = Math.max(0, group.requiredLength - exactLength);
          const needsSharedFit = !exactFits;
          if (consumeSharedCapacity(sharedRows, requiredShared, needsSharedFit, group.longestPart)) return;
        }

        if (group.longestPart > 12000) {
          autoFillMessages.push(`${group.profile} · ${group.steelGrade}: the longest part is ${group.longestPart} mm. Provide a stock order longer than 12000 mm.`);
          return;
        }

        state.stockOrders.push({
          generatedId: allocateGeneratedId("stockOrders"),
          stockId: "",
          profile: group.profile,
          steelGrade: group.steelGrade,
          length: group.longestPart <= 6000 ? 6000 : 12000,
          quantity: 1,
          lastFiniteQuantity: 1,
          unlimited: true,
          price: "",
          autoFilled: true
        });
        changed = true;
      });
    } finally {
      isAutoFilling = false;
      renderAutoFillState();
    }
    return changed;
  }

  function afterDataChange(type) {
    if (type === "parts") {
      const stockChanged = runAutoFill();
      if (stockChanged) render("stockOrders");
    }
    validate();
  }

  function validate(clearBackendErrors = true) {
    if (clearBackendErrors) backendErrors = [];
    const errors = [];
    const settings = {
      toolWidth: numberFromInput("toolWidth"),
      trimStart: numberFromInput("trimStart"),
      trimEnd: numberFromInput("trimEnd"),
      reusableMinimumLength: numberFromInput("reusableMinimum")
    };
    Object.entries(settings).forEach(([key, value]) => {
      if (!Number.isFinite(value) || value < 0) errors.push(`${key} must be a non-negative integer.`);
    });

    const parts = active("parts");
    const stockOrders = active("stockOrders");
    const storage = active("storage");
    if (!parts.length) errors.push("Add at least one part.");

    parts.forEach((row, index) => {
      row.source = String(row.source || "").trim() || "Manual";
      if (!String(row.position || "").trim()) errors.push(`Part row ${index + 1}: position is required.`);
      if (!String(row.steelGrade || "").trim()) errors.push(`Part row ${index + 1}: steel grade is required.`);
      if (!String(row.profile || "").trim()) errors.push(`Part row ${index + 1}: profile is required.`);
      if (!(rowNumber(row, "quantity") > 0)) errors.push(`Part row ${index + 1}: quantity must be greater than zero.`);
      if (!(rowNumber(row, "length") > 0)) errors.push(`Part row ${index + 1}: length must be greater than zero.`);
    });

    let groups = [];
    if (!errors.length) {
      try { groups = collectGroups(parts); } catch (error) { errors.push(error.message); }
    }
    const groupBadge = document.getElementById("groupBadge");
    if (groups.length) {
      groupBadge.className = "badge ok";
      groupBadge.textContent = `${groups.length} nesting group${groups.length === 1 ? "" : "s"} detected`;
    } else {
      groupBadge.className = "badge warn";
      groupBadge.textContent = "No nesting groups detected";
    }

    const stockOrderIds = new Set();
    stockOrders.forEach((row, index) => {
      const stockOrderId = finalId("stockOrders", row).toLowerCase();
      if (stockOrderIds.has(stockOrderId)) errors.push(`Stock order ID '${finalId("stockOrders", row)}' appears more than once.`);
      stockOrderIds.add(stockOrderId);
      if (!String(row.profile || "").trim()) errors.push(`Stock order row ${index + 1}: profile is required.`);
      if (!(rowNumber(row, "length") > 0)) errors.push(`Stock order row ${index + 1}: length must be greater than zero.`);
      if (!row.unlimited && positiveWholeNumber(row.quantity) === null) errors.push(`Stock order row ${index + 1}: enter a positive whole quantity or select Unlimited.`);
      const parsedPrice = optionalPositiveWholeNumber(row.price);
      if (!parsedPrice.blank && parsedPrice.value === null) errors.push(`Stock order row ${index + 1}: price must be blank or a positive whole number.`);
    });

    const storageIds = new Set();
    storage.forEach((row, index) => {
      const storageId = finalId("storage", row).toLowerCase();
      if (storageIds.has(storageId)) errors.push(`Storage ID '${finalId("storage", row)}' appears more than once.`);
      storageIds.add(storageId);
      if (!String(row.profile || "").trim()) errors.push(`Storage row ${index + 1}: profile is required.`);
      if (!String(row.steelGrade || "").trim()) errors.push(`Storage row ${index + 1}: steel grade is required.`);
      if (!(rowNumber(row, "length") > 0)) errors.push(`Storage row ${index + 1}: length must be greater than zero.`);
      if (!(rowNumber(row, "quantity") > 0)) errors.push(`Storage row ${index + 1}: quantity must be greater than zero.`);
    });

    if (!stockOrders.length && !storage.length) errors.push("Add at least one stock order or storage stock row.");

    document.getElementById("partBadge").textContent = `${parts.length} part row${parts.length === 1 ? "" : "s"}`;
    const allErrors = [...errors, ...backendErrors];
    const validation = document.getElementById("validation");
    const solve = document.getElementById("solve");
    solve.disabled = isSolving || Boolean(errors.length);
    solve.textContent = isSolving ? "Solving batch…" : "Solve";

    if (allErrors.length) {
      validation.className = "validation bad";
      validation.innerHTML = `<strong>${allErrors.length} issue${allErrors.length === 1 ? "" : "s"} must be corrected.</strong><ul>${allErrors.map(error => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;
    } else {
      validation.className = "validation good";
      validation.innerHTML = "<strong>Input is ready to solve.</strong><span>The browser will send one pre-grouped batch request.</span>";
    }

    persistProject(groups.length ? groups : state.projectGroups);
    return { errors, settings, parts, stockOrders, storage, groups };
  }

  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  function normalizeStockOrders(rows) {
    return rows.map((row, index) => ({
      stockOrderId: finalId("stockOrders", row),
      profileName: String(row.profile).trim(),
      steelGrade: String(row.steelGrade || "").trim(),
      length: Math.ceil(Number(row.length)),
      availableQuantity: row.unlimited ? null : Math.ceil(Number(row.quantity)),
      price: optionalPositiveWholeNumber(row.price).value
    }));
  }

  function normalizeStorage(rows) {
    return rows.map((row, index) => ({
      storageStockId: finalId("storage", row),
      profileName: String(row.profile).trim(),
      steelGrade: String(row.steelGrade).trim(),
      length: Math.ceil(Number(row.length)),
      quantity: Math.ceil(Number(row.quantity)),
      storageArea: String(row.storageArea || "").trim() || null
    }));
  }

  function sameText(left, right) {
    return String(left).localeCompare(String(right), undefined, { sensitivity: "base" }) === 0;
  }

  function prepareProjectGroups(input) {
    const stockOrders = normalizeStockOrders(input.stockOrders);
    const storageRecords = normalizeStorage(input.storage);
    const selector = new RelevantStorageStockSelector();

    return input.groups.map(group => {
      const matchingStockOrders = stockOrders
        .filter(stock => sameText(stock.profileName, group.profileName) && (!stock.steelGrade || sameText(stock.steelGrade, group.steelGrade)))
        .map(stock => ({
          stockOrderId: stock.stockOrderId,
          length: stock.length,
          availableQuantity: stock.availableQuantity,
          price: stock.price
        }));

      const selectorRecords = storageRecords.map(record => sameText(record.profileName, group.profileName) && sameText(record.steelGrade, group.steelGrade)
        ? { ...record, profileName: group.profileName, steelGrade: group.steelGrade }
        : record);

      const selection = selector.select(group.profileName, group.steelGrade, group.partRequirements, input.settings, selectorRecords);
      if (!matchingStockOrders.length && !selection.groupedStorageStock.length) {
        throw new Error(`${group.profileName} · ${group.steelGrade}: no matching stock order or usable storage stocks can fit the requested parts.`);
      }

      return {
        groupId: group.groupId,
        profileName: group.profileName,
        steelGrade: group.steelGrade,
        partRequirements: clone(group.partRequirements),
        stockOrders: matchingStockOrders,
        storageStock: selection.groupedStorageStock,
        storageSelectionAudit: {
          profileOrGradeRejectedIds: selection.profileOrGradeRejected.map(record => record.storageStockId),
          tooShortRejectedIds: selection.tooShortRejected.map(record => record.storageStockId)
        }
      };
    });
  }

  function solveGroups(projectGroups) {
    return projectGroups.map(group => ({
      groupId: group.groupId,
      profileName: group.profileName,
      steelGrade: group.steelGrade,
      partRequirements: group.partRequirements.map(part => ({
        partId: part.partId,
        length: part.length,
        quantity: part.quantity
      })),
      stockOrders: group.stockOrders.map(order => ({
        stockOrderId: order.stockOrderId,
        length: order.length,
        availableQuantity: order.availableQuantity,
        price: order.price
      })),
      storageStock: group.storageStock.map(grouped => ({
        groupedStorageStockId: grouped.groupedStorageStockId,
        length: grouped.length,
        quantity: grouped.quantity
      }))
    }));
  }

  function buildSolveRequest() {
    const input = validate();
    if (input.errors.length) return null;

    try {
      state.projectGroups = prepareProjectGroups(input);
      persistProject(state.projectGroups);
      return {
        schemaVersion: PROJECT_SCHEMA_VERSION,
        requestId: NcNesting.createRequestId(),
        currency: String(document.getElementById("currency").value || "").trim() || null,
        cuttingSettings: input.settings,
        groups: solveGroups(state.projectGroups)
      };
    } catch (error) {
      backendErrors = [error.message || "Unable to prepare the solve request."];
      validate(false);
      return null;
    }
  }

  function inputSettingsSnapshot() {
    return {
      toolWidth: document.getElementById("toolWidth").value,
      trimStart: document.getElementById("trimStart").value,
      trimEnd: document.getElementById("trimEnd").value,
      reusableMinimumLength: document.getElementById("reusableMinimum").value
    };
  }

  function projectSnapshot(groups = state.projectGroups) {
    return {
      projectId: state.projectId,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      createdAtUtc: state.createdAtUtc,
      currency: document.getElementById("currency").value,
      cuttingSettings: inputSettingsSnapshot(),
      inputs: {
        parts: clone(state.parts.map(row => ({ ...row, source: String(row.source || "").trim() || "Manual" }))),
        stockOrders: clone(state.stockOrders),
        storageStock: clone(state.storage)
      },
      autoFillOrders: state.autoFillOrders !== false,
      groupIds: clone(state.groupIds),
      nextIds: clone(state.nextIds),
      groups: clone(groups || []),
      solveRequest: clone(state.solveRequest),
      solveResponse: clone(state.solveResponse)
    };
  }

  function persistProject(groups = state.projectGroups) {
    if (isHydrating) return null;
    return NcNesting.saveActiveProject(projectSnapshot(groups));
  }

  function applyInput(input, resetProject = true) {
    isHydrating = true;
    backendErrors = [];
    autoFillMessages = [];
    document.getElementById("ncErrors").textContent = "";
    if (resetProject) state = createProjectState();
    const settings = input.cuttingSettings || {};
    document.getElementById("toolWidth").value = settings.toolWidth ?? 3;
    document.getElementById("trimStart").value = settings.trimStart ?? 20;
    document.getElementById("trimEnd").value = settings.trimEnd ?? 20;
    document.getElementById("reusableMinimum").value = settings.reusableMinimumLength ?? 1250;
    const currency = ["Israeli New Shekel", "US Dollar", "Euro"].includes(input.currency)
      ? input.currency
      : "Israeli New Shekel";
    document.getElementById("currency").value = currency;
    state.autoFillOrders = input.autoFillOrders !== false;
    state.parts = (input.parts || []).map(row => ({ position: row.positionId || row.position || "", profile: row.profileName || row.profile || "", steelGrade: row.steelGrade || "", quantity: row.quantity ?? 1, length: row.length ?? "", source: String(row.source || "").trim() || "Manual" }));
    state.stockOrders = (input.stockOrders || []).map(row => ({ generatedId: migrateGeneratedOrderId(row.generatedId) || allocateGeneratedId("stockOrders"), stockId: row.stockOrderId || row.stockId || "", profile: row.profileName || row.profile || "", steelGrade: row.steelGrade || "", length: row.length ?? "", quantity: row.availableQuantity ?? row.quantity ?? 1, lastFiniteQuantity: positiveWholeNumber(row.availableQuantity ?? row.quantity) ?? 1, unlimited: typeof row.unlimited === "boolean" ? row.unlimited : row.availableQuantity == null, price: row.price ?? "", autoFilled: Boolean(row.autoFilled) }));
    state.storage = (input.storageStock || input.storage || []).map(row => ({ generatedId: row.generatedId || allocateGeneratedId("storage"), storageId: row.storageStockId || row.storageId || "", profile: row.profileName || row.profile || "", steelGrade: row.steelGrade || "", length: row.length ?? "", quantity: row.quantity ?? 1, storageArea: row.storageArea || "" }));
    state.groupIds = clone(input.groupIds || state.groupIds || {});
    state.nextIds = { ...state.nextIds, ...(input.nextIds || {}) };
    state.projectGroups = clone(input.groups || []);
    state.solveRequest = clone(input.solveRequest || null);
    state.solveResponse = clone(input.solveResponse || null);
    ["parts", "stockOrders", "storage"].forEach(render);
    isHydrating = false;
    renderAutoFillState();
    const stockChanged = runAutoFill();
    if (stockChanged) render("stockOrders");
    validate();
  }

  function restoreProject(project) {
    state = createProjectState();
    state.projectId = project.projectId || state.projectId;
    state.createdAtUtc = project.createdAtUtc || state.createdAtUtc;
    applyInput({
      cuttingSettings: project.cuttingSettings || {},
      currency: project.currency,
      autoFillOrders: project.autoFillOrders !== false,
      parts: project.inputs?.parts || project.parts || [],
      stockOrders: project.inputs?.stockOrders || project.stockOrders || [],
      storageStock: project.inputs?.storageStock || project.storageStock || [],
      groupIds: project.groupIds || {},
      nextIds: project.nextIds || {},
      groups: project.groups || [],
      solveRequest: project.solveRequest || null,
      solveResponse: project.solveResponse || null
    }, false);
  }

  function clearAllInput() {
    isHydrating = true;
    state = createProjectState();
    backendErrors = [];
    autoFillMessages = [];
    isSolving = false;

    document.getElementById("toolWidth").value = 3;
    document.getElementById("trimStart").value = 20;
    document.getElementById("trimEnd").value = 20;
    document.getElementById("reusableMinimum").value = 1250;
    document.getElementById("currency").value = "Israeli New Shekel";
    document.getElementById("ncErrors").textContent = "";
    document.getElementById("previewJson").textContent = "";
    const dialog = document.getElementById("previewDialog");
    if (dialog.open) dialog.close();
    ["partsCsv", "stockCsv", "storageCsv", "ncFiles"].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = "";
    });

    ["parts", "stockOrders", "storage"].forEach(render);
    renderAutoFillState();
    NcNesting.clearActiveProject();
    history.replaceState({}, "", `${location.pathname}${location.hash}`);
    isHydrating = false;
    validate();
  }

  function showPreview() {
    const request = buildSolveRequest();
    if (!request) return;
    document.getElementById("previewJson").textContent = JSON.stringify(request, null, 2);
    document.getElementById("previewDialog").showModal();
  }

  async function solveBatch() {
    const request = buildSolveRequest();
    if (!request || isSolving) return;
    state.solveRequest = clone(request);
    state.solveResponse = null;
    const projectBeforeSolve = persistProject(state.projectGroups) || projectSnapshot();
    isSolving = true;
    validate(false);
    try {
      const result = NcNestingDemo.matchesRequest(request)
        ? NcNestingDemo.createSolveResult(request.requestId)
        : await NcNesting.postSolve(request);
      if (!result.succeeded) {
        backendErrors = (result.errors || []).map(error => `${error.profileName || "Batch"}${error.steelGrade ? ` · ${error.steelGrade}` : ""}${error.category ? ` — ${error.category}` : ""}: ${error.message || "Unknown error"}`);
        return;
      }
      state.solveResponse = {
        batchId: result.batchId,
        batchResult: clone(result.batchResult),
        plans: clone(result.plans || {})
      };
      const solvedProject = persistProject(state.projectGroups) || projectSnapshot();
      await NcNesting.saveSolveResponse(result, solvedProject || projectBeforeSolve);
      location.href = `batch-result.html?batchId=${encodeURIComponent(result.batchId)}`;
    } catch (error) {
      const responseErrors = error.responseBody?.errors;
      backendErrors = Array.isArray(responseErrors) && responseErrors.length
        ? responseErrors.map(item => `${item.profileName || "Batch"}${item.steelGrade ? ` · ${item.steelGrade}` : ""}${item.category ? ` — ${item.category}` : ""}: ${item.message || "Unknown error"}`)
        : [error.message || "Unable to submit the batch solve request."];
    } finally {
      isSolving = false;
      validate(false);
    }
  }

  document.querySelectorAll("[data-add]").forEach(button => button.onclick = () => add(button.dataset.add));
  document.querySelectorAll("[data-clear]").forEach(button => button.onclick = () => {
    const type = button.dataset.clear;
    state[type] = [];
    render(type);
    afterDataChange(type);
  });
  document.querySelectorAll("[data-download]").forEach(button => button.onclick = () => download(button.dataset.download));
  document.getElementById("partsCsv").onchange = event => fileImport("parts", event.target);
  document.getElementById("stockCsv").onchange = event => fileImport("stockOrders", event.target);
  document.getElementById("storageCsv").onchange = event => fileImport("storage", event.target);
  document.getElementById("currency").onchange = validate;
  ["toolWidth", "trimStart", "trimEnd", "reusableMinimum"].forEach(id => {
    const element = document.getElementById(id);
    element.oninput = validate;
    element.onblur = () => {
      if (element.value !== "") {
        element.value = Math.ceil(Number(element.value));
        validate();
      }
    };
  });

  const drop = document.getElementById("drop");
  const ncFiles = document.getElementById("ncFiles");
  drop.onclick = () => ncFiles.click();
  ncFiles.onchange = () => {
    importNc([...ncFiles.files]);
    ncFiles.value = "";
  };
  ["dragenter", "dragover"].forEach(name => drop.addEventListener(name, event => {
    event.preventDefault();
    drop.classList.add("drag");
  }));
  ["dragleave", "drop"].forEach(name => drop.addEventListener(name, event => {
    event.preventDefault();
    drop.classList.remove("drag");
  }));
  drop.addEventListener("drop", event => importNc([...event.dataTransfer.files]));

  document.getElementById("autoFillOrders").onchange = event => {
    state.autoFillOrders = event.target.checked;
    autoFillMessages = [];
    renderAutoFillState();
    if (state.autoFillOrders) {
      const stockChanged = runAutoFill();
      if (stockChanged) render("stockOrders");
    }
    validate();
  };

  document.getElementById("clearAll").onclick = clearAllInput;
  document.getElementById("demo").onclick = () => applyInput(NcNestingDemo.input);
  document.getElementById("preview").onclick = showPreview;
  document.getElementById("closePreview").onclick = () => document.getElementById("previewDialog").close();
  document.getElementById("copyPreview").onclick = async () => navigator.clipboard.writeText(document.getElementById("previewJson").textContent);
  document.getElementById("solve").onclick = solveBatch;
  document.getElementById("printPage").onclick = () => NcNestingPrint.printInput(projectSnapshot());

  window.NcNestingInput = Object.freeze({ buildPayload: buildSolveRequest, buildSolveRequest, applyInput, projectSnapshot, clearAllInput });

  async function initialize() {
    ["parts", "stockOrders", "storage"].forEach(render);
    renderAutoFillState();

    const params = new URLSearchParams(location.search);
    const batchId = params.get("batchId");
    if (batchId) {
      const solvedProject = await NcNesting.getProject(batchId);
      if (!solvedProject) {
        backendErrors = [`Unable to restore input for batch '${batchId}'. Its project snapshot is not available in this browser.`];
        validate(false);
        return;
      }
      restoreProject(solvedProject);
      history.replaceState({}, "", `${location.pathname}${location.hash}`);
      persistProject(state.projectGroups);
      return;
    }

    const storedProject = NcNesting.getActiveProject();
    if (storedProject) restoreProject(storedProject);
    else validate();
  }

  initialize().catch(error => {
    backendErrors = [error.message || "Unable to load the active input project."];
    validate(false);
  });
})();
