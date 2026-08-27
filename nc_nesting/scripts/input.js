(function () {
  "use strict";

  const PROJECT_SCHEMA_VERSION = "1.0";
  const I18N = window.NCNestingI18n;
  const t = (key, params = {}, language) => I18N.t(key, params, language);
  const isolate = value => I18N.isolate(value);
  const ValidationCategory = Object.freeze({
    PARTS: "parts",
    STOCK: "stock",
    STORAGE: "storage",
    CUTTING_SETTINGS: "cuttingSettings",
    GENERAL: "general"
  });
  const PANEL_VALIDATION_TARGETS = Object.freeze({
    [ValidationCategory.PARTS]: "partsValidation",
    [ValidationCategory.STOCK]: "stockValidation",
    [ValidationCategory.STORAGE]: "storageValidation",
    [ValidationCategory.CUTTING_SETTINGS]: "settingsValidation"
  });
  const errorDescriptor = (key, params = {}, context = "", htmlParams = {}) => ({ key, params, context, htmlParams });
  const categorizedError = (error, category = ValidationCategory.GENERAL) => typeof error === "string"
    ? { text: error, category }
    : { ...(error || {}), category: error?.category || category };
  const normalizedErrorParams = error => {
    const params = { ...(error?.params || {}) };
    if (params.fieldKey) { params.field = t(params.fieldKey); delete params.fieldKey; }
    if (params.id) params.id = isolate(params.id);
    return params;
  };
  const errorText = error => {
    if (typeof error === "string") return error;
    if (error?.text) return String(error.text);
    const message = t(error?.key || "error.prepare", normalizedErrorParams(error));
    return error?.context ? `${isolate(error.context)}: ${message}` : message;
  };
  const errorHtml = error => {
    if (typeof error === "string") return escapeHtml(error);
    if (error?.text) return escapeHtml(error.text);
    const params = Object.fromEntries(Object.entries(normalizedErrorParams(error)).map(([key, value]) => [key, escapeHtml(value)]));
    Object.assign(params, error?.htmlParams || {});
    const message = I18N.richText(error?.key || "error.prepare", params);
    return error?.context ? `${escapeHtml(isolate(error.context))}: ${message}` : message;
  };
  let state = createProjectState();
  let isHydrating = false;
  let isAutoFilling = false;
  let autoFillMessages = [];

  function createProjectState() {
    return {
      projectId: NcNesting.createProjectId(),
      projectName: "",
      batchName: "",
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
  let ncImportErrors = [];
  let ncImportNotices = [];
  let preflightErrors = [];
  let preflightWarnings = [];
  let groupVisualStatuses = new Map();
  let groupComplexityResults = new Map();
  let groupStatusTimer = null;
  let groupStatusRevision = 0;
  let groupAssessmentSignature = "";
  let groupAssessmentState = emptyGroupAssessmentState();
  let isSolving = false;
  let solvePhase = "idle";
  const SOLVE_PROCESSING_SECONDS = 120;
  let solveProcessingStartedAt = null;
  let solveProcessingTimer = null;


  function emptyGroupAssessmentState() {
    return {
      status: "idle",
      blockedGroups: [],
      warningGroups: [],
      batchSafety: {
        blocked: false,
        groupCount: 0,
        maxNestingGroups: Number(NcNestingConfig?.solvePreflightLimits?.maxNestingGroups) || 50,
        reasonCodes: []
      },
      batchComplexity: {
        totalCost: 0,
        budget: Number(NcNestingConfig?.solvePreflightLimits?.complexityScoring?.batchBudget) || 0,
        blocked: false,
        exceeded: false,
        scoredGroupCount: 0,
        reasonCodes: []
      }
    };
  }

  function resetGroupComplexityAssessment() {
    clearTimeout(groupStatusTimer);
    groupStatusRevision++;
    groupAssessmentSignature = "";
    groupAssessmentState = emptyGroupAssessmentState();
    groupVisualStatuses = new Map();
    groupComplexityResults = new Map();
  }

  const body = {
    parts: document.getElementById("partsBody"),
    stockOrders: document.getElementById("stockBody"),
    storage: document.getElementById("storageBody")
  };

  const visual = {
    parts: [["position", "text"], ["steelGrade", "text"], ["quantity", "number"], ["profile", "text"], ["length", "number"], ["source", "text", true]],
    stockOrders: [["profile", "text"], ["steelGrade", "steelGradeChoice"], ["length", "number"], ["availability", "availability"], ["price", "price"]],
    storage: [["profile", "text"], ["steelGrade", "text"], ["length", "number"], ["quantity", "number"], ["storageArea", "text"]]
  };

  const csv = {
    parts: [["position", "csv.position", "text"], ["steelGrade", "csv.steelGrade", "text"], ["quantity", "csv.quantity", "number"], ["profile", "csv.profile", "text"], ["length", "csv.length", "number"], ["source", "csv.source", "text"]],
    stockOrders: [["profile", "csv.profile", "text"], ["steelGrade", "csv.steelGrade", "text"], ["length", "csv.length", "number"], ["quantity", "csv.quantity", "stockQuantity"], ["unlimited", "csv.unlimited", "checkbox"], ["price", "csv.price", "price"]],
    storage: [["profile", "csv.profile", "text"], ["steelGrade", "csv.steelGrade", "text"], ["length", "csv.length", "number"], ["quantity", "csv.quantity", "number"], ["storageArea", "csv.storageArea", "text"]]
  };

  const csvImport = {
    parts: csv.parts,
    stockOrders: [["stockId", "csv.stockOrderId", "text"], ...csv.stockOrders],
    storage: [["storageId", "csv.storageStockId", "text"], ...csv.storage]
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
    if (type === "stockOrders") return { generatedId: allocateGeneratedId(type), stockId: "", profile: "", steelGrade: "", lastSteelGrade: "", allSteelGrades: true, length: "", quantity: 1, lastFiniteQuantity: 1, unlimited: false, price: "" };
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


  function sourceLabel(value) {
    const source = String(value || "").trim() || "Manual";
    if (source === "Manual") return t("common.manual");
    if (source === "Demo data") return t("common.demoData");
    if (source === "NC file") return t("common.ncFile");
    if (source === "CSV") return t("common.csv");
    return source;
  }

  function translateCurrencyOptions() {
    document.querySelectorAll("#currency option[data-currency-label]").forEach(option => {
      option.textContent = I18N.currencyLabel(option.dataset.currencyLabel);
    });
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
        if (type === "stockOrders" && field === "price") td.classList.add("price-column");
        if (inputType === "availability") {
          renderAvailability(td, row, rowIndex, columnIndex);
        } else if (inputType === "steelGradeChoice") {
          renderSteelGradeChoice(td, row, rowIndex, columnIndex);
        } else if (readOnly) {
          const value = type === "parts" && field === "source"
            ? (String(row[field] || "").trim() || "Manual")
            : String(row[field] ?? "");
          row[field] = value;
          td.className = "read-only-cell";
          const text = document.createElement("span");
          text.className = "read-only-value";
          text.dataset.sourceValue = type === "parts" && field === "source" ? value : "";
          text.textContent = type === "parts" && field === "source" ? sourceLabel(value) : value;
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
          input.oninput = event => {
            state[type][rowIndex][field] = event.target.value;
            if (type === "parts") {
              renderNestingGroupControls();
              validate();
            } else {
              afterDataChange(type, { commit: false });
            }
          };
          input.onpaste = pasteMatrix;
          input.onblur = () => {
            if (inputType === "number" && !decimal && input.value !== "") {
              input.value = Math.ceil(Number(input.value));
            } else if (inputType === "text") {
              input.value = String(input.value || "").trim();
            }
            row[field] = input.value;
            afterDataChange(type, { commit: true, renderChangedType: type === "parts" });
          };
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
      removeButton.title = t("action.removeRow");
      removeButton.setAttribute("aria-label", t("action.removeRow"));
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

  function stockQuantity(value) {
    const quantity = positiveWholeNumber(value);
    return quantity !== null && quantity <= 999 ? quantity : null;
  }

  function setAllSteelGrades(row, checked) {
    if (checked) {
      const current = String(row.steelGrade || "").trim();
      if (current) row.lastSteelGrade = current;
      row.steelGrade = "";
      row.allSteelGrades = true;
    } else {
      row.allSteelGrades = false;
      if (!String(row.steelGrade || "").trim() && String(row.lastSteelGrade || "").trim()) {
        row.steelGrade = String(row.lastSteelGrade).trim();
      }
    }
  }

  function renderSteelGradeChoice(td, row, rowIndex, columnIndex) {
    const wrapper = document.createElement("div");
    wrapper.className = "steel-grade-control";
    const input = document.createElement("input");
    input.type = "text";
    input.value = row.allSteelGrades ? "" : (row.steelGrade ?? "");
    input.disabled = Boolean(row.allSteelGrades);
    input.classList.toggle("inactive", Boolean(row.allSteelGrades));
    setMeta(input, "stockOrders", rowIndex, columnIndex, "steelGrade");
    input.oninput = event => {
      row.steelGrade = event.target.value;
      if (String(event.target.value || "").trim()) row.lastSteelGrade = event.target.value;
      row.allSteelGrades = false;
      afterDataChange("stockOrders");
    };
    input.onblur = () => {
      row.steelGrade = String(input.value || "").trim();
      if (row.steelGrade) row.lastSteelGrade = row.steelGrade;
      afterDataChange("stockOrders");
    };
    input.onpaste = pasteMatrix;

    const label = document.createElement("label");
    label.className = "all-steel-grades";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(row.allSteelGrades);
    checkbox.onchange = () => {
      setAllSteelGrades(row, checkbox.checked);
      render("stockOrders");
      afterDataChange("stockOrders");
    };
    const labelText = document.createElement("span");
    labelText.className = "all-steel-grades-label";
    labelText.textContent = t("common.allSteelGrades");
    label.append(checkbox, labelText);
    wrapper.append(input, label);
    td.appendChild(wrapper);
  }

  function restoredQuantity(row) {
    return stockQuantity(row.quantity) ?? stockQuantity(row.lastFiniteQuantity) ?? 1;
  }

  function rememberQuantity(row, value) {
    row.quantity = value;
    const quantity = stockQuantity(value);
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
      quantity.max = "999";
      quantity.step = "1";
      quantity.inputMode = "numeric";
      quantity.value = row.quantity ?? restoredQuantity(row);
      quantity.oninput = event => {
        rememberQuantity(row, event.target.value);
        validate();
      };
      quantity.onblur = () => {
        const normalized = stockQuantity(quantity.value);
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
    const labelText = document.createElement("span");
    labelText.className = "unlimited-label";
    labelText.textContent = t("common.unlimited");
    label.append(checkbox, labelText);
    wrapper.append(quantity, label);
    td.appendChild(wrapper);
  }

  function normalize(type, value) {
    const text = String(value ?? "").trim();
    if (type === "checkbox") return ["true", "yes", "y", "1", "unlimited", "∞"].includes(text.toLowerCase());
    if (type === "price") return text;
    if (type === "stockQuantity") return text.replace(",", ".");
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
    if (inputType === "steelGradeChoice") {
      const grade = String(raw ?? "").trim();
      row.steelGrade = grade;
      row.lastSteelGrade = grade || row.lastSteelGrade || "";
      row.allSteelGrades = !grade;
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
    return String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
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
        const column = csvImport[type].find(item => item[0] === field);
        const localizedHeaders = column ? [t(column[1], {}, "en"), t(column[1], {}, "he")].map(canonical) : [];
        if ([...names, ...localizedHeaders].includes(key)) map[index] = field;
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
        const valueType = csvImport[type].find(column => column[0] === field)?.[2] || "text";
        row[field] = normalize(valueType, cell);
      });
      if (type === "stockOrders") {
        row.lastFiniteQuantity = restoredQuantity(row);
        const grade = String(row.steelGrade || "").trim();
        row.steelGrade = grade;
        row.lastSteelGrade = grade;
        row.allSteelGrades = !grade;
      }
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
    if (type === "stockOrders") return state[type].filter(row => ["profile", "steelGrade", "length", "price"].some(key => String(row[key] || "").trim()) || row.unlimited);
    return state[type].filter(row => ["profile", "steelGrade", "length", "storageArea"].some(key => String(row[key] || "").trim()));
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function download(type) {
    const rows = active(type).map(row => type === "stockOrders"
      ? { ...row, steelGrade: row.allSteelGrades ? "" : row.steelGrade, unlimited: Boolean(row.unlimited) }
      : row);
    const language = I18N.getLanguage();
    const lines = [csv[type].map(column => csvEscape(t(column[1], {}, language))).join(",")];
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

  function renderNcErrors() {
    const errors = ncImportErrors.map(error => {
      const fileName = isolate(error.fileName);
      return `<div class="nc-import-error">${escapeHtml(`${fileName}: ${t(error.key, error.params || {})}`)}</div>`;
    });
    const notices = ncImportNotices.map(notice => {
      const message = t(notice.key, notice.params || {});
      const text = notice.fileName ? `${isolate(notice.fileName)}: ${message}` : message;
      return `<div class="nc-import-notice">${escapeHtml(text)}</div>`;
    });
    document.getElementById("ncErrors").innerHTML = [...errors, ...notices].join("");
  }

  function parseNc(name, text) {
    const lines = text.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n").map(line => line.trim());
    const startIndex = lines.findIndex(line => line.startsWith("ST"));
    if (startIndex < 0) throw errorDescriptor("nc.stMissing", {}, name);
    const get = offset => lines[startIndex + offset] || "";
    const position = get(3);
    const steelGrade = get(6);
    const quantityText = get(7);
    const quantity = /^\d+$/.test(quantityText) ? Number(quantityText) : NaN;
    const profile = get(8);
    const profileType = get(9).toLocaleUpperCase();
    if (profileType === "B") return { ignored: true, reason: "plate" };
    const length = Number(get(10).replace(",", "."));
    if (!position || !steelGrade || !profile || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(length) || length <= 0) {
      throw errorDescriptor("nc.invalidFields", {}, name);
    }
    return { position, steelGrade, quantity, profile, length: Math.ceil(length), source: "NC file" };
  }

  function isNc1File(file) {
    return Boolean(file && /\.nc1$/i.test(file.name));
  }

  async function filesFromHandle(handle) {
    if (!handle) return [];
    if (handle.kind === "file") return [await handle.getFile()];
    if (handle.kind !== "directory") return [];

    const files = [];
    for await (const childHandle of handle.values()) {
      files.push(...await filesFromHandle(childHandle));
    }
    return files;
  }

  function fileFromEntry(entry) {
    return new Promise((resolve, reject) => entry.file(resolve, reject));
  }

  function entriesFromReader(reader) {
    return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
  }

  async function filesFromEntry(entry) {
    if (!entry) return [];
    if (entry.isFile) return [await fileFromEntry(entry)];
    if (!entry.isDirectory) return [];

    const files = [];
    const reader = entry.createReader();
    while (true) {
      const entries = await entriesFromReader(reader);
      if (!entries.length) break;
      for (const childEntry of entries) {
        files.push(...await filesFromEntry(childEntry));
      }
    }
    return files;
  }

  async function filesFromDroppedItem(item) {
    if (typeof item.getAsFileSystemHandle === "function") {
      try {
        const handle = await item.getAsFileSystemHandle();
        if (handle) return { files: await filesFromHandle(handle), isDirectory: handle.kind === "directory" };
      } catch {}
    }

    if (typeof item.webkitGetAsEntry === "function") {
      const entry = item.webkitGetAsEntry();
      if (entry) return { files: await filesFromEntry(entry), isDirectory: entry.isDirectory };
    }

    const file = item.getAsFile();
    return { files: file ? [file] : [], isDirectory: false };
  }

  async function filesFromDrop(dataTransfer) {
    const items = [...(dataTransfer.items || [])].filter(item => item.kind === "file");
    if (!items.length) return [...(dataTransfer.files || [])];

    const files = [];
    for (const item of items) {
      const dropped = await filesFromDroppedItem(item);
      files.push(...(dropped.isDirectory ? dropped.files.filter(isNc1File) : dropped.files));
    }
    return files;
  }

  async function importNc(files) {
    ncImportErrors = [];
    ncImportNotices = [];
    let plateDetected = false;
    for (const file of files) {
      if (!isNc1File(file)) {
        ncImportErrors.push({ fileName: file.name, key: "nc.unsupported" });
        continue;
      }
      try {
        const parsed = parseNc(file.name, await file.text());
        if (parsed?.ignored && parsed.reason === "plate") {
          plateDetected = true;
          continue;
        }
        state.parts.push(parsed);
      } catch (error) {
        ncImportErrors.push({ fileName: error.context || file.name, key: error.key || "nc.invalidFields", params: error.params || {} });
      }
    }
    if (plateDetected) ncImportNotices.push({ key: "nc.plateIgnored" });
    renderNcErrors();
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

  function normalizedGroupValue(value) {
    return String(value || "").normalize("NFKC").trim().toLocaleUpperCase();
  }

  function groupKey(profileName, steelGrade) {
    return `${normalizedGroupValue(profileName)}\u0000${normalizedGroupValue(steelGrade)}`;
  }

  function compareGroupText(left, right) {
    const leftText = String(left || "").trim();
    const rightText = String(right || "").trim();
    if (!leftText && rightText) return 1;
    if (leftText && !rightText) return -1;
    return leftText.localeCompare(rightText, undefined, { sensitivity: "base", numeric: true });
  }

  function compareGroups(left, right) {
    return compareGroupText(left.profileName ?? left.profile, right.profileName ?? right.profile)
      || compareGroupText(left.steelGrade, right.steelGrade);
  }

  function detectedPartGroups(parts = active("parts"), options = {}) {
    const includeIncomplete = options.includeIncomplete === true;
    const groups = new Map();
    parts.forEach(row => {
      const profileName = String(row.profile || "").trim();
      const steelGrade = String(row.steelGrade || "").trim();
      if ((!profileName || !steelGrade) && !includeIncomplete) return;
      if (!profileName && !steelGrade) return;
      const key = groupKey(profileName, steelGrade);
      if (!groups.has(key)) groups.set(key, { key, profileName, steelGrade });
    });
    return [...groups.values()].sort(compareGroups);
  }

  function sortParts() {
    const decorated = state.parts.map((row, index) => ({ row, index }));
    decorated.sort((left, right) => {
      const groupOrder = compareGroups(left.row, right.row);
      if (groupOrder) return groupOrder;
      const leftLength = Number(left.row.length);
      const rightLength = Number(right.row.length);
      const normalizedLeftLength = Number.isFinite(leftLength) ? leftLength : Number.POSITIVE_INFINITY;
      const normalizedRightLength = Number.isFinite(rightLength) ? rightLength : Number.POSITIVE_INFINITY;
      return normalizedLeftLength - normalizedRightLength || left.index - right.index;
    });
    const sorted = decorated.map(item => item.row);
    const changed = sorted.some((row, index) => row !== state.parts[index]);
    state.parts = sorted;
    return changed;
  }

  function renderNestingGroupControls(groups = detectedPartGroups(active("parts"), { includeIncomplete: true })) {
    const container = document.getElementById("nestingGroupControls");
    if (!container) return;
    container.innerHTML = "";
    groups.forEach(group => {
      const control = document.createElement("div");
      const status = groupVisualStatuses.get(group.key) || ((!group.profileName || !group.steelGrade) ? "invalid" : "checking");
      control.className = `nesting-group-control status-${status}`;
      const statusText = t(`input.groupStatus.${status}`);
      control.title = statusText;
      const values = document.createElement("span");
      values.className = "nesting-group-control-values";
      const profile = document.createElement("bdi");
      profile.dir = "ltr";
      profile.textContent = group.profileName || t("validation.profileRequired");
      const separator = document.createElement("span");
      separator.textContent = "·";
      separator.setAttribute("aria-hidden", "true");
      const grade = document.createElement("bdi");
      grade.dir = "ltr";
      grade.textContent = group.steelGrade || t("validation.steelGradeRequired");
      const statusLabel = document.createElement("span");
      statusLabel.className = "nesting-group-status-text";
      statusLabel.textContent = statusText;
      values.append(profile, separator, grade, statusLabel);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "nesting-group-remove";
      remove.textContent = "×";
      const accessibleText = t("action.removeNestingGroup", { profile: I18N.isolate(group.profileName), grade: I18N.isolate(group.steelGrade) });
      remove.title = accessibleText;
      remove.setAttribute("aria-label", accessibleText);
      remove.onclick = () => removeNestingGroup(group.key);
      control.append(values, remove);
      container.appendChild(control);
    });
  }

  function removeNestingGroup(key) {
    state.parts = state.parts.filter(row => groupKey(row.profile, row.steelGrade) !== key);
    state.stockOrders = state.stockOrders.filter(row => !(
      row.autoFilled
      && !row.allSteelGrades
      && groupKey(row.profile, row.steelGrade) === key
    ));
    delete state.groupIds[key];
    state.projectGroups = (state.projectGroups || []).filter(group => groupKey(group.profileName, group.steelGrade) !== key);
    if (state.solveRequest?.groups) {
      state.solveRequest.groups = state.solveRequest.groups.filter(group => groupKey(group.profileName, group.steelGrade) !== key);
    }
    sortParts();
    render("parts");
    render("stockOrders");
    renderNestingGroupControls();
    validate();
  }

  function evaluateSolveConstraints({ groups = [] } = {}) {
    const maxGroups = Math.max(1, Math.trunc(Number(NcNestingConfig?.solvePreflightLimits?.maxNestingGroups) || 50));
    if ((Array.isArray(groups) ? groups.length : 0) <= maxGroups) return [];
    return [categorizedError(
      errorDescriptor("preflight.tooManyGroups", { max: I18N.formatNumber(maxGroups) }),
      ValidationCategory.GENERAL
    )];
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
        throw errorDescriptor("validation.partConflict", { id: partId });
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
      .sort(compareGroups)
      .map(group => {
        const key = groupKey(group.profileName, group.steelGrade);
        if (!state.groupIds[key]) state.groupIds[key] = `group-${state.nextIds.groups++}`;
        return { ...group, groupId: state.groupIds[key], partRequirements: [...group.parts.values()] };
      });
  }


  function sameNormalizedText(left, right) {
    return normalizedGroupValue(left) === normalizedGroupValue(right);
  }

  function stockOrderMatchesGroup(row, group) {
    if (!sameNormalizedText(row.profile, group.profile)) return false;
    return row.allSteelGrades || groupKey(row.profile, row.steelGrade) === groupKey(group.profile, group.steelGrade);
  }

  function normalizeRestoredAutoFilledOrders() {
    let changed = false;
    state.stockOrders.forEach(row => {
      if (row.autoFilled && Number(row.length) === 6000) {
        row.length = 12000;
        changed = true;
      }
    });
    return changed;
  }

  function renderAutoFillState() {
    const checkbox = document.getElementById("autoFillOrders");
    const stateLabel = document.getElementById("autoFillState");
    if (checkbox) checkbox.checked = state.autoFillOrders !== false;
    if (stateLabel) stateLabel.textContent = state.autoFillOrders === false ? t("common.off") : t("common.on");
    const notice = document.getElementById("autoFillNotice");
    if (!notice) return;
    notice.hidden = autoFillMessages.length === 0;
    notice.innerHTML = autoFillMessages.length
      ? `<strong>${escapeHtml(t("input.autoFillAttention"))}</strong><ul>${autoFillMessages.map(message => `<li>${errorHtml(message)}</li>`).join("")}</ul>`
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
      const groupKeys = new Set(groups.map(group => groupKey(group.profile, group.steelGrade)));
      const retainedOrders = state.stockOrders.filter(row => !(
        row.autoFilled
        && !row.allSteelGrades
        && !groupKeys.has(groupKey(row.profile, row.steelGrade))
      ));
      if (retainedOrders.length !== state.stockOrders.length) {
        state.stockOrders = retainedOrders;
        changed = true;
      }

      const sharedByProfile = new Map();
      active("stockOrders").forEach(row => {
        const profile = String(row.profile || "").trim();
        const steelGrade = String(row.steelGrade || "").trim();
        const length = Number(row.length);
        const quantity = stockQuantity(row.quantity);
        if (!profile || !row.allSteelGrades || steelGrade || row.unlimited || !Number.isFinite(length) || length <= 0 || quantity === null) return;
        const key = normalizedGroupValue(profile);
        if (!sharedByProfile.has(key)) sharedByProfile.set(key, []);
        sharedByProfile.get(key).push({ row, length: Math.ceil(length), remaining: quantity });
      });

      groups.forEach(group => {
        const matching = active("stockOrders").filter(row => stockOrderMatchesGroup(row, group));
        const unlimitedCover = matching.some(row => row.unlimited && Number(row.length) >= group.longestPart);
        if (unlimitedCover) return;

        const exactFinite = matching.filter(row => (
          !row.allSteelGrades
          && groupKey(row.profile, row.steelGrade) === groupKey(group.profile, group.steelGrade)
          && !row.unlimited
          && stockQuantity(row.quantity) !== null
          && Number(row.length) > 0
        ));
        const exactLength = exactFinite.reduce((total, row) => total + Math.ceil(Number(row.length)) * stockQuantity(row.quantity), 0);
        const exactFits = exactFinite.some(row => Number(row.length) >= group.longestPart);
        const sharedRows = sharedByProfile.get(normalizedGroupValue(group.profile)) || [];
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
          const hasLongEnoughOption = matching.some(row => Number(row.length) >= group.longestPart && (row.unlimited || stockQuantity(row.quantity) !== null));
          if (!hasLongEnoughOption) {
            autoFillMessages.push(errorDescriptor(
              "validation.longPart",
              {
                length: I18N.measurementText(group.longestPart, "mm", { maximumFractionDigits: 0 }),
                limit: I18N.measurementText(12000, "mm", { maximumFractionDigits: 0 })
              },
              `${group.profile} · ${group.steelGrade}`,
              {
                length: I18N.measurementHtml(group.longestPart, "mm", { maximumFractionDigits: 0 }),
                limit: I18N.measurementHtml(12000, "mm", { maximumFractionDigits: 0 })
              }
            ));
          }
          return;
        }

        const existingAutoFilled = matching.find(row => row.autoFilled && !row.allSteelGrades);
        if (existingAutoFilled) {
          if (Number(existingAutoFilled.length) !== 12000 || !existingAutoFilled.unlimited) {
            existingAutoFilled.length = 12000;
            existingAutoFilled.unlimited = true;
            changed = true;
          }
          return;
        }

        state.stockOrders.push({
          generatedId: allocateGeneratedId("stockOrders"),
          stockId: "",
          profile: group.profile,
          steelGrade: group.steelGrade,
          lastSteelGrade: group.steelGrade,
          allSteelGrades: false,
          length: 12000,
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

  function currencySelected() {
    return Boolean(String(document.getElementById("currency")?.value || "").trim());
  }

  function updatePriceVisibility() {
    document.getElementById("stockOrdersTable")?.classList.toggle("prices-hidden", !currencySelected());
  }

  function afterDataChange(type, options = {}) {
    const commit = options.commit !== false;
    if (type === "parts" && commit) {
      const sorted = sortParts();
      if (sorted || options.renderChangedType) render("parts");
    }
    renderNestingGroupControls();
    if (type === "parts" || type === "stockOrders") {
      const stockChanged = runAutoFill();
      if (stockChanged) render("stockOrders");
    }
    validate();
  }

  function renderPanelValidation(errors) {
    const grouped = new Map(Object.keys(PANEL_VALIDATION_TARGETS).map(category => [category, []]));
    (errors || []).forEach(error => {
      const category = error?.category;
      if (grouped.has(category)) grouped.get(category).push(error);
    });

    Object.entries(PANEL_VALIDATION_TARGETS).forEach(([category, elementId]) => {
      const element = document.getElementById(elementId);
      if (!element) return;
      const panelErrors = grouped.get(category) || [];
      element.hidden = panelErrors.length === 0;
      element.innerHTML = panelErrors.length
        ? `<ul>${panelErrors.map(error => `<li>${errorHtml(error)}</li>`).join("")}</ul>`
        : "";
    });
  }

  function validate(clearBackendErrors = true, options = {}) {
    if (clearBackendErrors) {
      backendErrors = [];
      preflightErrors = [];
      preflightWarnings = [];
    }
    const errors = [];
    const settings = {
      toolWidth: numberFromInput("toolWidth"),
      trimStart: numberFromInput("trimStart"),
      trimEnd: numberFromInput("trimEnd"),
      reusableMinimumLength: numberFromInput("reusableMinimum")
    };
    const settingLabels = {
      toolWidth: t("common.toolWidth"),
      trimStart: t("common.startTrim"),
      trimEnd: t("common.endTrim"),
      reusableMinimumLength: t("common.reusableMinimum")
    };
    Object.entries(settings).forEach(([key, value]) => {
      if (!Number.isFinite(value) || value < 0) {
        errors.push(categorizedError(
          errorDescriptor("validation.nonNegativeInteger", { field: settingLabels[key] }),
          ValidationCategory.CUTTING_SETTINGS
        ));
      }
    });

    const parts = active("parts");
    const stockOrders = active("stockOrders");
    const storage = active("storage");
    if (!parts.length) errors.push(categorizedError(errorDescriptor("validation.addPart"), ValidationCategory.PARTS));

    parts.forEach((row, index) => {
      row.source = String(row.source || "").trim() || "Manual";
      const prefix = `${t("validation.partRow")} ${I18N.formatNumber(index + 1)}`;
      if (!String(row.position || "").trim()) errors.push(categorizedError(`${prefix}: ${t("validation.positionRequired")}`, ValidationCategory.PARTS));
      if (!String(row.steelGrade || "").trim()) errors.push(categorizedError(`${prefix}: ${t("validation.steelGradeRequired")}`, ValidationCategory.PARTS));
      if (!String(row.profile || "").trim()) errors.push(categorizedError(`${prefix}: ${t("validation.profileRequired")}`, ValidationCategory.PARTS));
      if (!(rowNumber(row, "quantity") > 0)) errors.push(categorizedError(`${prefix}: ${t("validation.quantityPositive")}`, ValidationCategory.PARTS));
      if (!(rowNumber(row, "length") > 0)) errors.push(categorizedError(`${prefix}: ${t("validation.lengthPositive")}`, ValidationCategory.PARTS));
    });

    const displayGroups = detectedPartGroups(parts, { includeIncomplete: true });
    const detectedGroups = displayGroups.filter(group => group.profileName && group.steelGrade);
    renderNestingGroupControls(displayGroups);
    let groups = [];
    if (!errors.some(error => error.category === ValidationCategory.PARTS)) {
      try { groups = collectGroups(parts); } catch (error) { errors.push(categorizedError(error, ValidationCategory.PARTS)); }
    }
    const solveConstraintIssues = evaluateSolveConstraints({ groups: detectedGroups });
    errors.push(...solveConstraintIssues);
    if (!isSolving && !options.skipGroupAssessment && !errors.length) {
      scheduleGroupStatusAssessment(settings, displayGroups);
    }

    const groupBadge = document.getElementById("groupBadge");
    const hardGroupLimitExceeded = solveConstraintIssues.some(error => error?.key === "preflight.tooManyGroups");
    const assessmentBlocked = groupAssessmentState.blockedGroups.length > 0 || hardGroupLimitExceeded;
    const assessmentHasCaution = [...groupVisualStatuses.values()].some(status => status === "warning" || status === "orange" || status === "checking");
    if (detectedGroups.length) {
      groupBadge.className = assessmentBlocked ? "badge bad" : assessmentHasCaution ? "badge warn" : "badge ok";
      groupBadge.textContent = detectedGroups.length === 1
        ? t("input.oneGroup")
        : t("input.groupCount", { count: I18N.formatNumber(detectedGroups.length) });
    } else {
      groupBadge.className = "badge warn";
      groupBadge.textContent = t("input.noGroups");
    }

    const stockOrderIds = new Set();
    stockOrders.forEach((row, index) => {
      const id = finalId("stockOrders", row);
      const stockOrderId = id.toLowerCase();
      const prefix = `${t("validation.stockOrderRow")} ${I18N.formatNumber(index + 1)}`;
      if (stockOrderIds.has(stockOrderId)) errors.push(categorizedError(errorDescriptor("validation.duplicateId", { id }), ValidationCategory.STOCK));
      stockOrderIds.add(stockOrderId);
      if (!String(row.profile || "").trim()) errors.push(categorizedError(`${prefix}: ${t("validation.profileRequired")}`, ValidationCategory.STOCK));
      if (!row.allSteelGrades && !String(row.steelGrade || "").trim()) errors.push(categorizedError(`${prefix}: ${t("validation.steelGradeRequired")}`, ValidationCategory.STOCK));
      if (!(rowNumber(row, "length") > 0)) errors.push(categorizedError(`${prefix}: ${t("validation.lengthPositive")}`, ValidationCategory.STOCK));
      if (!row.unlimited && stockQuantity(row.quantity) === null) errors.push(categorizedError(`${prefix}: ${t("validation.stockQuantityRange")}`, ValidationCategory.STOCK));
      if (currencySelected()) {
        const parsedPrice = optionalPositiveWholeNumber(row.price);
        if (!parsedPrice.blank && parsedPrice.value === null) errors.push(categorizedError(`${prefix}: ${t("validation.pricePositive")}`, ValidationCategory.STOCK));
      }
    });

    const storageIds = new Set();
    storage.forEach((row, index) => {
      const id = finalId("storage", row);
      const storageId = id.toLowerCase();
      const prefix = `${t("validation.storageRow")} ${I18N.formatNumber(index + 1)}`;
      if (storageIds.has(storageId)) errors.push(categorizedError(errorDescriptor("validation.duplicateId", { id }), ValidationCategory.STORAGE));
      storageIds.add(storageId);
      if (!String(row.profile || "").trim()) errors.push(categorizedError(`${prefix}: ${t("validation.profileRequired")}`, ValidationCategory.STORAGE));
      if (!String(row.steelGrade || "").trim()) errors.push(categorizedError(`${prefix}: ${t("validation.steelGradeRequired")}`, ValidationCategory.STORAGE));
      if (!(rowNumber(row, "length") > 0)) errors.push(categorizedError(`${prefix}: ${t("validation.lengthPositive")}`, ValidationCategory.STORAGE));
      if (!(rowNumber(row, "quantity") > 0)) errors.push(categorizedError(`${prefix}: ${t("validation.quantityPositive")}`, ValidationCategory.STORAGE));
    });

    if (!stockOrders.length && !storage.length) errors.push(categorizedError(errorDescriptor("validation.addStock"), ValidationCategory.STOCK));

    document.getElementById("partBadge").textContent = parts.length === 0
      ? t("input.zeroPartRows")
      : t("input.partRowCount", { count: I18N.formatNumber(parts.length) });
    const liveAssessmentBlockers = !isSolving
      && groupAssessmentState.status === "complete"
      && !preflightErrors.length
      ? groupAssessmentState.blockedGroups.map(preflightBlockDescriptor)
      : [];
    const complexityChecking = !isSolving
      && groupAssessmentState.status === "checking"
      && detectedGroups.length > 0
      && !errors.length;
    const allErrors = [...errors, ...backendErrors, ...preflightErrors, ...liveAssessmentBlockers];
    renderPanelValidation(allErrors);

    const validation = document.getElementById("validation");
    const solveButtons = [document.getElementById("solve"), document.getElementById("navbarSolve")].filter(Boolean);
    const solveDisabled = isSolving || Boolean(allErrors.length);
    const solveText = isSolving
      ? t(solvePhase === "checking" ? "input.checkingCalculationSize" : "input.solving")
      : t("action.solve");
    solveButtons.forEach(button => {
      button.disabled = solveDisabled;
      button.textContent = solveText;
    });

    if (allErrors.length) {
      validation.className = "validation bad";
      const hasBlockedGroups = Boolean(preflightErrors.length || liveAssessmentBlockers.length);
      const heading = hasBlockedGroups
        ? t("input.preflightBlockedBatch")
        : allErrors.length === 1
          ? t("input.oneIssue")
          : t("input.issueCount", { count: I18N.formatNumber(allErrors.length) });
      const generalErrors = allErrors.filter(error => !error?.category || error.category === ValidationCategory.GENERAL);
      const details = generalErrors.length
        ? `<ul>${generalErrors.map(error => `<li>${errorHtml(error)}</li>`).join("")}</ul>`
        : `<span>${escapeHtml(t("input.fixHighlightedPanels"))}</span>`;
      validation.innerHTML = `<strong>${escapeHtml(heading)}</strong>${details}`;
    } else {
      validation.className = "validation good";
      validation.innerHTML = `<strong>${escapeHtml(t("input.ready"))}</strong><span>${escapeHtml(t("input.selectSolve"))}</span>`;
    }

    const groupsForPersistence = groups.length || detectedGroups.length === 0 ? groups : state.projectGroups;
    persistProject(groupsForPersistence);
    return {
      errors,
      settings,
      parts,
      stockOrders,
      storage,
      groups,
      detectedGroups,
      displayGroups,
      solveConstraintIssues,
      complexityAssessmentPending: complexityChecking,
      solveAdmissionBlocked: Boolean(liveAssessmentBlockers.length || preflightErrors.length)
    };
  }

  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  function normalizeStockOrders(rows, includePrices) {
    return rows.map(row => ({
      stockOrderId: finalId("stockOrders", row),
      profileName: String(row.profile).trim(),
      steelGrade: row.allSteelGrades ? "" : String(row.steelGrade || "").trim(),
      length: Math.ceil(Number(row.length)),
      availableQuantity: row.unlimited ? null : Math.ceil(Number(row.quantity)),
      ...(includePrices ? { price: optionalPositiveWholeNumber(row.price).value } : {})
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
    return normalizedGroupValue(left) === normalizedGroupValue(right);
  }

  function prepareProjectGroups(input) {
    const includePrices = currencySelected();
    const stockOrders = normalizeStockOrders(input.stockOrders, includePrices);
    const storageRecords = normalizeStorage(input.storage);
    const selector = new RelevantStorageStockSelector();

    return input.groups.map(group => {
      const matchingStockOrders = stockOrders
        .filter(stock => sameText(stock.profileName, group.profileName) && (!stock.steelGrade || groupKey(stock.profileName, stock.steelGrade) === groupKey(group.profileName, group.steelGrade)))
        .map(stock => ({
          stockOrderId: stock.stockOrderId,
          length: stock.length,
          availableQuantity: stock.availableQuantity,
          ...(includePrices ? { price: stock.price } : {})
        }));

      const selectorRecords = storageRecords.map(record => sameText(record.profileName, group.profileName) && sameText(record.steelGrade, group.steelGrade)
        ? { ...record, profileName: group.profileName, steelGrade: group.steelGrade }
        : record);

      const selection = selector.select(group.profileName, group.steelGrade, group.partRequirements, input.settings, selectorRecords);
      if (!matchingStockOrders.length && !selection.groupedStorageStock.length) {
        throw categorizedError(
          errorDescriptor("validation.noMaterial", {}, `${group.profileName} · ${group.steelGrade}`),
          ValidationCategory.STOCK
        );
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
        ...(currencySelected() ? { price: order.price } : {})
      })),
      storageStock: group.storageStock.map(grouped => ({
        groupedStorageStockId: grouped.groupedStorageStockId,
        length: grouped.length,
        quantity: grouped.quantity
      }))
    }));
  }

  function validVisualPartRow(row) {
    return Boolean(String(row.position || "").trim())
      && Boolean(String(row.profile || "").trim())
      && Boolean(String(row.steelGrade || "").trim())
      && rowNumber(row, "quantity") > 0
      && rowNumber(row, "length") > 0;
  }

  function validVisualStockRow(row) {
    if (!String(row.profile || "").trim()) return false;
    if (!row.allSteelGrades && !String(row.steelGrade || "").trim()) return false;
    if (!(rowNumber(row, "length") > 0)) return false;
    if (!row.unlimited && stockQuantity(row.quantity) === null) return false;
    if (currencySelected()) {
      const price = optionalPositiveWholeNumber(row.price);
      if (!price.blank && price.value === null) return false;
    }
    return true;
  }

  function validVisualStorageRow(row) {
    return Boolean(String(row.profile || "").trim())
      && Boolean(String(row.steelGrade || "").trim())
      && rowNumber(row, "length") > 0
      && rowNumber(row, "quantity") > 0;
  }

  function matchingVisualStockRows(group) {
    return active("stockOrders").filter(row => (
      sameText(row.profile, group.profileName)
      && (row.allSteelGrades || sameText(row.steelGrade, group.steelGrade))
    ));
  }

  function matchingVisualStorageRows(group) {
    return active("storage").filter(row => (
      sameText(row.profile, group.profileName)
      && sameText(row.steelGrade, group.steelGrade)
    ));
  }

  function conflictingPartGroupKeys() {
    const seen = new Map();
    const invalid = new Set();
    active("parts").forEach(row => {
      const id = String(row.position || "").trim().toLocaleLowerCase();
      if (!id) return;
      const key = groupKey(row.profile, row.steelGrade);
      const length = Math.ceil(Number(row.length));
      const previous = seen.get(id);
      if (previous && (previous.key !== key || previous.length !== length)) {
        invalid.add(previous.key);
        invalid.add(key);
      } else if (!previous) {
        seen.set(id, { key, length });
      }
    });
    return invalid;
  }

  function prepareVisualGroupCandidate(group, settings, conflictKeys) {
    if (!group.profileName || !group.steelGrade || conflictKeys.has(group.key)) return null;
    if (Object.values(settings).some(value => !Number.isFinite(value) || value < 0)) return null;

    const partRows = active("parts").filter(row => groupKey(row.profile, row.steelGrade) === group.key);
    const stockRows = matchingVisualStockRows(group);
    const storageRows = matchingVisualStorageRows(group);
    if (!partRows.length || partRows.some(row => !validVisualPartRow(row))) return null;
    if (stockRows.some(row => !validVisualStockRow(row))) return null;
    if (storageRows.some(row => !validVisualStorageRow(row))) return null;

    try {
      const collected = collectGroups(partRows);
      if (collected.length !== 1) return null;
      const projectGroups = prepareProjectGroups({
        groups: collected,
        stockOrders: stockRows,
        storage: storageRows,
        settings
      });
      return solveGroups(projectGroups)[0] || null;
    } catch {
      return null;
    }
  }

  function visualStatusForResult(result) {
    if (result?.decision === NcNestingSolvePreflight.decisions.BLOCK) return "invalid";
    const band = String(result?.complexity?.band || "").toLowerCase();
    if (band === "green") return "ready";
    if (band === "yellow") return "warning";
    if (band === "orange") return "orange";
    return result?.decision === NcNestingSolvePreflight.decisions.WARNING ? "warning" : "ready";
  }

  function scheduleGroupStatusAssessment(settings, displayGroups) {
    const conflictKeys = conflictingPartGroupKeys();
    const candidates = [];
    const localBlockedGroups = [];
    const initialStatuses = new Map();

    displayGroups.forEach(group => {
      const candidate = prepareVisualGroupCandidate(group, settings, conflictKeys);
      if (!candidate) {
        initialStatuses.set(group.key, "invalid");
        if (group.profileName && group.steelGrade) {
          localBlockedGroups.push({
            groupId: "",
            profileName: group.profileName,
            steelGrade: group.steelGrade,
            decision: NcNestingSolvePreflight.decisions.BLOCK,
            reasonCodes: ["no_usable_stock"],
            category: ValidationCategory.STOCK
          });
        }
      } else {
        initialStatuses.set(group.key, "checking");
        candidates.push({ key: group.key, candidate });
      }
    });

    const signature = JSON.stringify({
      settings,
      groups: displayGroups.map(group => ({
        key: group.key,
        candidate: candidates.find(item => item.key === group.key)?.candidate || null
      }))
    });

    if (signature === groupAssessmentSignature
      && (groupAssessmentState.status === "checking" || groupAssessmentState.status === "complete")) {
      renderNestingGroupControls(displayGroups);
      return;
    }

    const revision = ++groupStatusRevision;
    clearTimeout(groupStatusTimer);
    groupAssessmentSignature = signature;
    groupVisualStatuses = initialStatuses;
    groupComplexityResults = new Map();

    if (!candidates.length || isSolving) {
      groupAssessmentState = {
        ...emptyGroupAssessmentState(),
        status: localBlockedGroups.length ? "complete" : "idle",
        blockedGroups: localBlockedGroups
      };
      renderNestingGroupControls(displayGroups);
      return;
    }

    groupAssessmentState = {
      ...emptyGroupAssessmentState(),
      status: "checking",
      blockedGroups: localBlockedGroups
    };
    renderNestingGroupControls(displayGroups);

    groupStatusTimer = setTimeout(async () => {
      try {
        const screening = await NcNestingSolvePreflight.screenBatch(
          candidates.map(item => item.candidate),
          settings,
          { limits: NcNestingConfig.solvePreflightLimits }
        );
        if (revision !== groupStatusRevision || isSolving) return;
        const resultById = new Map(screening.results.map(result => [result.groupId, result]));
        const resultByKey = new Map();
        candidates.forEach(item => {
          const result = resultById.get(item.candidate.groupId);
          if (result) {
            initialStatuses.set(item.key, visualStatusForResult(result));
            resultByKey.set(item.key, result);
          } else {
            initialStatuses.set(item.key, "orange");
          }
        });
        groupComplexityResults = resultByKey;
        groupAssessmentState = {
          status: "complete",
          blockedGroups: [...localBlockedGroups, ...(screening.blockedGroups || [])],
          warningGroups: screening.warningGroups || [],
          batchSafety: screening.batchSafety || emptyGroupAssessmentState().batchSafety,
          batchComplexity: screening.batchComplexity || emptyGroupAssessmentState().batchComplexity
        };
      } catch {
        if (revision !== groupStatusRevision || isSolving) return;
        candidates.forEach(item => initialStatuses.set(item.key, "orange"));
        groupAssessmentState = {
          ...emptyGroupAssessmentState(),
          status: "uncertain",
          blockedGroups: localBlockedGroups
        };
      }
      if (revision !== groupStatusRevision || isSolving) return;
      groupVisualStatuses = initialStatuses;
      renderNestingGroupControls(detectedPartGroups(active("parts"), { includeIncomplete: true }));
      validate(false, { skipGroupAssessment: true });
    }, 220);
  }

  function buildSolveRequest() {
    const input = validate(true, { skipGroupAssessment: true });
    const finalConstraintIssues = evaluateSolveConstraints({ groups: input.detectedGroups || [] });
    if (input.errors.length
      || finalConstraintIssues.length
      || input.solveAdmissionBlocked) return null;

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
      backendErrors = [error?.key ? error : errorDescriptor("error.prepare")];
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
      projectName: String(document.getElementById("projectName")?.value || "").trim(),
      batchName: String(document.getElementById("batchName")?.value || "").trim(),
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
    ncImportErrors = [];
    ncImportNotices = [];
    preflightErrors = [];
    preflightWarnings = [];
    resetGroupComplexityAssessment();
    autoFillMessages = [];
    solvePhase = "idle";
    document.getElementById("ncErrors").textContent = "";
    if (resetProject) state = createProjectState();
    const settings = input.cuttingSettings || {};
    state.projectName = String(input.projectName || "").trim();
    state.batchName = String(input.batchName || "").trim();
    document.getElementById("projectName").value = state.projectName;
    document.getElementById("batchName").value = state.batchName;
    document.getElementById("toolWidth").value = settings.toolWidth ?? 3;
    document.getElementById("trimStart").value = settings.trimStart ?? 20;
    document.getElementById("trimEnd").value = settings.trimEnd ?? 20;
    document.getElementById("reusableMinimum").value = settings.reusableMinimumLength ?? 1250;
    const currency = ["", "Israeli New Shekel", "US Dollar", "Euro", "Chinese Yuan (CNY)"].includes(input.currency)
      ? input.currency
      : "";
    document.getElementById("currency").value = currency;
    updatePriceVisibility();
    state.autoFillOrders = input.autoFillOrders !== false;
    state.parts = (input.parts || []).map(row => ({ position: row.positionId || row.position || "", profile: row.profileName || row.profile || "", steelGrade: row.steelGrade || "", quantity: row.quantity ?? 1, length: row.length ?? "", source: String(row.source || "").trim() || "Manual" }));
    state.stockOrders = (input.stockOrders || []).map(row => {
      const grade = String(row.steelGrade || "").trim();
      const allSteelGrades = typeof row.allSteelGrades === "boolean" ? row.allSteelGrades : !grade;
      return { generatedId: migrateGeneratedOrderId(row.generatedId) || allocateGeneratedId("stockOrders"), stockId: row.stockOrderId || row.stockId || "", profile: row.profileName || row.profile || "", steelGrade: allSteelGrades ? "" : grade, lastSteelGrade: String(row.lastSteelGrade || grade).trim(), allSteelGrades, length: row.length ?? "", quantity: row.availableQuantity ?? row.quantity ?? 1, lastFiniteQuantity: stockQuantity(row.availableQuantity ?? row.quantity) ?? 1, unlimited: typeof row.unlimited === "boolean" ? row.unlimited : row.availableQuantity == null, price: row.price ?? "", autoFilled: Boolean(row.autoFilled) };
    });
    state.storage = (input.storageStock || input.storage || []).map(row => ({ generatedId: row.generatedId || allocateGeneratedId("storage"), storageId: row.storageStockId || row.storageId || "", profile: row.profileName || row.profile || "", steelGrade: row.steelGrade || "", length: row.length ?? "", quantity: row.quantity ?? 1, storageArea: row.storageArea || "" }));
    sortParts();
    normalizeRestoredAutoFilledOrders();
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
      projectName: project.projectName || "",
      batchName: project.batchName || "",
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
    ncImportErrors = [];
    ncImportNotices = [];
    preflightErrors = [];
    preflightWarnings = [];
    resetGroupComplexityAssessment();
    autoFillMessages = [];
    isSolving = false;
    solvePhase = "idle";

    document.getElementById("projectName").value = "";
    document.getElementById("batchName").value = "";
    document.getElementById("toolWidth").value = 3;
    document.getElementById("trimStart").value = 20;
    document.getElementById("trimEnd").value = 20;
    document.getElementById("reusableMinimum").value = 1250;
    document.getElementById("currency").value = "";
    updatePriceVisibility();
    document.getElementById("ncErrors").textContent = "";
    ["partsCsv", "stockCsv", "storageCsv", "ncFiles", "ncFolder"].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = "";
    });

    ["parts", "stockOrders", "storage"].forEach(render);
    renderNestingGroupControls();
    renderAutoFillState();
    NcNesting.clearActiveProject();
    history.replaceState({}, "", `${location.pathname}${location.hash}`);
    isHydrating = false;
    validate();
  }

  function releaseSolveLock() {
    isSolving = false;
    solvePhase = "idle";
    validate(false);
  }

  function setSolvePhase(phase) {
    solvePhase = phase;
    validate(false);
  }

  function yieldToPage() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  function currentComplexityResultsForRequest(request) {
    const byGroupId = new Map();
    groupComplexityResults.forEach(result => {
      const groupId = String(result?.groupId || "");
      if (groupId) byGroupId.set(groupId, result);
    });
    return (request?.groups || []).map(group => byGroupId.get(group.groupId)).filter(Boolean);
  }

  function greedyBaselinesForGroups(groups, cuttingSettings, cachedEntries = null) {
    const baselines = {};
    const requestGroups = (groups || []).map(group => {
      const cachedBaseline = cachedEntries?.get?.(group.groupId)?.greedyBaseline || null;
      if (cachedBaseline) {
        baselines[group.groupId] = clone(cachedBaseline);
        return { ...clone(group), greedyBaseline: clone(cachedBaseline) };
      }

      let baseline = null;
      try {
        baseline = globalThis.NcNestingGreedy?.solve?.(group, cuttingSettings) || null;
      } catch {
        baseline = null;
      }
      if (!baseline) return clone(group);
      baselines[group.groupId] = clone(baseline);
      return { ...clone(group), greedyBaseline: clone(baseline) };
    });
    return { requestGroups, baselines };
  }

  function visitorGroupError(error) {
    const profile = String(error?.profileName || "").trim();
    const grade = String(error?.steelGrade || "").trim();
    const context = [profile, grade].filter(Boolean).join(" · ") || t("common.batch");
    const category = Object.values(ValidationCategory).includes(String(error?.category || ""))
      ? String(error.category)
      : ValidationCategory.GENERAL;
    const message = String(error?.message || "").trim();
    if (message) return categorizedError(`${isolate(context)}: ${message}`, category);
    return categorizedError(errorDescriptor("error.solveGroup", {}, context), category);
  }

  function solveFailureMessages(error) {
    if (error?.code === "INVALID_RESULT") return [errorDescriptor("error.invalidResult")];
    if (error?.code === "SERVICE_UNAVAILABLE") return [errorDescriptor("error.serviceUnavailable")];
    if (error?.code === "SAFETY_TIMEOUT") return [errorDescriptor("error.serviceStoppedResponding")];
    if (error?.code === "BACKEND_HTTP_ERROR") {
      const returned = Array.isArray(error.backendErrors) ? error.backendErrors : [];
      if (returned.length) return returned.map(visitorGroupError);
      const message = String(error?.message || "").trim();
      return message ? [message] : [errorDescriptor("error.solve")];
    }
    return [errorDescriptor("error.solve")];
  }

  function isGreedyFallbackFailure(error) {
    return error?.code === "SERVICE_UNAVAILABLE" || error?.code === "SAFETY_TIMEOUT";
  }

  function promptGreedyFallback(error) {
    const dialog = document.getElementById("greedyFallbackDialog");
    const title = document.getElementById("greedyFallbackTitle");
    const continueButton = document.getElementById("greedyFallbackContinue");
    const cancelButton = document.getElementById("greedyFallbackCancel");
    if (!dialog || !title || !continueButton || !cancelButton || typeof dialog.showModal !== "function") {
      return Promise.resolve(false);
    }

    title.dataset.i18n = error?.code === "SAFETY_TIMEOUT"
      ? "error.serviceStoppedResponding"
      : "error.serviceUnavailable";
    I18N.apply(dialog);

    return new Promise(resolve => {
      let settled = false;
      const finish = accepted => {
        if (settled) return;
        settled = true;
        continueButton.removeEventListener("click", accept);
        cancelButton.removeEventListener("click", cancel);
        dialog.removeEventListener("cancel", cancelEvent);
        dialog.removeEventListener("close", closeEvent);
        if (dialog.open) dialog.close();
        resolve(accepted);
      };
      const accept = () => finish(true);
      const cancel = () => finish(false);
      const cancelEvent = event => {
        event.preventDefault();
        finish(false);
      };
      const closeEvent = () => finish(false);
      continueButton.addEventListener("click", accept);
      cancelButton.addEventListener("click", cancel);
      dialog.addEventListener("cancel", cancelEvent);
      dialog.addEventListener("close", closeEvent);
      dialog.showModal();
      continueButton.focus();
    });
  }

  function solveProcessingClock(seconds) {
    const safe = Math.max(0, Math.trunc(Number(seconds) || 0));
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
  }

  function updateSolveProcessingPopup() {
    const dialog = document.getElementById("solveProcessingDialog");
    const status = document.getElementById("solveProcessingStatus");
    const timePrefix = document.getElementById("solveProcessingTimePrefix");
    const timeValue = document.getElementById("solveProcessingTime");
    const timeSuffix = document.getElementById("solveProcessingTimeSuffix");
    if (!dialog || !status || !timePrefix || !timeValue || !timeSuffix) return;

    I18N.apply(dialog);
    const language = I18N.getLanguage();
    const methodologyLink = document.getElementById("solveMethodologyLink");
    const termsLink = document.getElementById("solveTermsLink");
    const contactLink = document.getElementById("solveContactLink");
    if (methodologyLink) {
      methodologyLink.href = String(NcNestingConfig?.methodologyUrlForLanguage?.(language) || NcNestingConfig?.methodologyUrl || "#");
      methodologyLink.dataset.methodologyLanguage = language;
    }
    if (termsLink) termsLink.href = NcNestingTerms?.termsUrl?.() || "terms.html";
    if (contactLink) contactLink.href = String(NcNestingConfig?.contactUrl || "#");

    const elapsedSeconds = solveProcessingStartedAt == null
      ? 0
      : Math.floor(Math.max(0, Date.now() - solveProcessingStartedAt) / 1000);
    const remainingSeconds = Math.max(0, SOLVE_PROCESSING_SECONDS - elapsedSeconds);

    if (remainingSeconds > 0) {
      timePrefix.textContent = t("processing.timePrefix");
      timeValue.textContent = solveProcessingClock(remainingSeconds);
      timeSuffix.textContent = t("processing.timeSuffix");
      timePrefix.hidden = false;
      timeValue.hidden = false;
      timeSuffix.hidden = false;
    } else {
      timePrefix.textContent = t("processing.finishing");
      timeValue.textContent = "";
      timeSuffix.textContent = "";
      timePrefix.hidden = false;
      timeValue.hidden = true;
      timeSuffix.hidden = true;
    }

    if (remainingSeconds === 0 && solveProcessingTimer != null) {
      clearInterval(solveProcessingTimer);
      solveProcessingTimer = null;
    }
  }

  function openSolveProcessingPopup() {
    const dialog = document.getElementById("solveProcessingDialog");
    if (!dialog || typeof dialog.showModal !== "function") return;
    if (!dialog.dataset.cancelLocked) {
      dialog.dataset.cancelLocked = "true";
      dialog.addEventListener("cancel", event => event.preventDefault());
    }
    solveProcessingStartedAt = Date.now();
    updateSolveProcessingPopup();
    if (!dialog.open) dialog.showModal();
    clearInterval(solveProcessingTimer);
    solveProcessingTimer = setInterval(updateSolveProcessingPopup, 250);
  }

  function closeSolveProcessingPopup() {
    clearInterval(solveProcessingTimer);
    solveProcessingTimer = null;
    solveProcessingStartedAt = null;
    const dialog = document.getElementById("solveProcessingDialog");
    if (dialog?.open) dialog.close();
  }

  async function postSolveWithProcessing(payload) {
    openSolveProcessingPopup();
    try {
      return await NcNesting.postSolve(payload);
    } finally {
      closeSolveProcessingPopup();
    }
  }

  function preflightGroupContext(result) {
    const profile = String(result?.profileName || "").trim();
    const grade = String(result?.steelGrade || "").trim();
    return [profile, grade].filter(Boolean).join(" · ") || t("common.batch");
  }

  function preflightCategory(result) {
    const direct = String(result?.category || "");
    if (Object.values(ValidationCategory).includes(direct)) return direct;
    const reasons = new Set(result?.reasonCodes || []);
    if (reasons.has("part_does_not_fit") || reasons.has("no_usable_stock") || reasons.has("finite_capacity_insufficient")) {
      return ValidationCategory.STOCK;
    }
    return ValidationCategory.GENERAL;
  }

  function preflightBlockDescriptor(result) {
    const reasons = new Set(result?.reasonCodes || []);
    const context = preflightGroupContext(result);
    const category = preflightCategory(result);
    if (reasons.has("invalid_integer")) return categorizedError(errorDescriptor("preflight.invalidValues", {}, context), category);
    if (reasons.has("finite_capacity_insufficient")) return categorizedError(errorDescriptor("preflight.finiteCapacityInsufficient", {}, context), category);
    return categorizedError(errorDescriptor("preflight.groupCannotFit", {}, context), category);
  }

  function preflightWarningDescriptor(result) {
    return categorizedError(errorDescriptor("preflight.groupMayTakeLonger", {}, preflightGroupContext(result)), ValidationCategory.GENERAL);
  }

  function applyPreflightFindings(screening) {
    preflightErrors = (screening?.blockedGroups || []).map(preflightBlockDescriptor);
    if (screening?.batchSafety?.blocked) {
      preflightErrors.push(categorizedError(
        errorDescriptor("preflight.tooManyGroups", { max: I18N.formatNumber(screening.batchSafety.maxNestingGroups) }),
        ValidationCategory.GENERAL
      ));
    }
    preflightWarnings = [];
    const nextStatuses = new Map(groupVisualStatuses);
    const nextComplexityResults = new Map(groupComplexityResults);
    (screening?.results || []).forEach(result => {
      const key = groupKey(result.profileName, result.steelGrade);
      nextStatuses.set(key, visualStatusForResult(result));
      nextComplexityResults.set(key, result);
    });
    groupVisualStatuses = nextStatuses;
    groupComplexityResults = nextComplexityResults;
    groupAssessmentState = {
      status: "complete",
      blockedGroups: screening?.blockedGroups || [],
      warningGroups: screening?.warningGroups || [],
      batchSafety: screening?.batchSafety || emptyGroupAssessmentState().batchSafety,
      batchComplexity: screening?.batchComplexity || emptyGroupAssessmentState().batchComplexity
    };
    renderNestingGroupControls();
  }

  async function executePreparedSolve(request, isDemoRequest) {
    state.solveRequest = clone(request);
    state.solveResponse = null;
    const projectBeforeSolve = persistProject(state.projectGroups) || projectSnapshot();

    try {
      let result;
      if (isDemoRequest) {
        result = NcNestingDemo.createSolveResult(request.requestId);
      } else {
        const currentComplexityResults = currentComplexityResultsForRequest(request);
        const incremental = await NcNesting.prepareIncrementalSolve(request, state.projectId, {
          complexityResults: currentComplexityResults
        });
        const groupsToSolve = incremental.groupsToSolve || incremental.changedGroups || [];
        let backendResult = null;
        let solvedGreedyBaselines = {};
        let backendSolveContext = incremental.solveContext || null;

        if (groupsToSolve.length) {
          setSolvePhase("checking");
          await yieldToPage();
          try {
            const screening = await NcNestingSolvePreflight.screenBatch(
              groupsToSolve,
              request.cuttingSettings,
              { limits: NcNestingConfig.solvePreflightLimits }
            );
            applyPreflightFindings(screening);
            backendSolveContext = NcNestingSolvePreflight.createSolveContext?.(
              groupsToSolve,
              screening.results,
              { limits: NcNestingConfig.solvePreflightLimits }
            ) || backendSolveContext;
          } catch {
            preflightErrors = [];
            preflightWarnings = groupsToSolve.map(group => preflightWarningDescriptor(group));
          }
          validate(false);
          if (preflightErrors.length) return;

          setSolvePhase("solving");
          const greedy = greedyBaselinesForGroups(groupsToSolve, request.cuttingSettings, incremental.cachedEntries);
          solvedGreedyBaselines = greedy.baselines;
          const backendRequest = {
            ...clone(request),
            requestId: NcNesting.createRequestId(),
            groups: greedy.requestGroups
          };
          try {
            backendResult = await postSolveWithProcessing({
              batch: backendRequest,
              telemetry: NcNestingTelemetry.createSolveTelemetry({
                request: backendRequest,
                projectId: state.projectId
              })
            });
          } catch (error) {
            if (!isGreedyFallbackFailure(error)) throw error;
            const greedyFallbackResult = globalThis.NcNestingGreedyPlanBuilder?.buildSolveResult?.(
              backendRequest,
              groupsToSolve,
              solvedGreedyBaselines,
              state.projectGroups
            ) || null;
            if (!greedyFallbackResult) throw error;
            const accepted = await promptGreedyFallback(error);
            if (!accepted) return;
            backendResult = greedyFallbackResult;
          }
          if (!backendResult.succeeded) {
            const resultErrors = Array.isArray(backendResult.errors) ? backendResult.errors : [];
            backendErrors = resultErrors.length
              ? resultErrors.map(visitorGroupError)
              : [errorDescriptor("error.solve")];
            return;
          }
        }

        result = NcNesting.mergeIncrementalSolveResult(
          request,
          incremental,
          backendResult,
          solvedGreedyBaselines,
          backendSolveContext
        );
        if (backendResult && groupsToSolve.length) {
          try {
            await NcNesting.writeGroupSolveCache(
              state.projectId,
              groupsToSolve.map(group => group.groupId),
              incremental.fingerprints,
              backendResult,
              solvedGreedyBaselines,
              backendSolveContext
            );
          } catch {
            // Cache writes must not block a successful solve.
          }
        }
      }

      if (!result.succeeded) {
        const resultErrors = Array.isArray(result.errors) ? result.errors : [];
        backendErrors = resultErrors.length
          ? resultErrors.map(visitorGroupError)
          : [errorDescriptor("error.solve")];
        return;
      }
      state.solveResponse = {
        batchId: result.batchId,
        batchResult: clone(result.batchResult),
        plans: clone(result.plans || {}),
        greedyBaselines: clone(result.greedyBaselines || {}),
        groupSolveContexts: clone(result.groupSolveContexts || {})
      };
      const solvedProject = persistProject(state.projectGroups) || projectSnapshot();
      await NcNesting.saveSolveResponse(result, solvedProject || projectBeforeSolve);
      location.href = `batch-result.html?batchId=${encodeURIComponent(result.batchId)}`;
    } catch (error) {
      backendErrors = solveFailureMessages(error);
    } finally {
      releaseSolveLock();
    }
  }

  function solveBatch() {
    if (isSolving) return;
    const request = buildSolveRequest();
    if (!request) return;

    const isDemoRequest = NcNestingDemo.matchesRequest(request);
    isSolving = true;
    solvePhase = "solving";
    validate(false);

    if (isDemoRequest || NcNestingTerms.isAccepted()) {
      executePreparedSolve(request, isDemoRequest);
      return;
    }

    try {
      NcNestingTerms.requestAcceptance(
        () => executePreparedSolve(request, false),
        releaseSolveLock
      );
    } catch (error) {
      backendErrors = [errorDescriptor("error.termsOpen")];
      releaseSolveLock();
    }
  }

  function retranslateInputPage() {
    I18N.apply();
    if (document.getElementById("solveProcessingDialog")?.open) updateSolveProcessingPopup();
    translateCurrencyOptions();
    document.querySelectorAll(".read-only-value[data-source-value]").forEach(element => {
      if (element.dataset.sourceValue) element.textContent = sourceLabel(element.dataset.sourceValue);
    });
    document.querySelectorAll(".unlimited-label").forEach(element => { element.textContent = t("common.unlimited"); });
    document.querySelectorAll(".all-steel-grades-label").forEach(element => { element.textContent = t("common.allSteelGrades"); });
    document.querySelectorAll("button.remove").forEach(button => {
      button.title = t("action.removeRow");
      button.setAttribute("aria-label", t("action.removeRow"));
    });
    renderNestingGroupControls();
    renderAutoFillState();
    renderNcErrors();
    validate(false);
  }

  I18N.listen(retranslateInputPage);
  window.addEventListener("site-navbar:ready", retranslateInputPage, { once: true });

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
  document.getElementById("currency").onchange = () => {
    updatePriceVisibility();
    validate();
  };
  ["projectName", "batchName"].forEach(id => {
    document.getElementById(id).oninput = event => {
      state[id] = event.target.value;
      persistProject();
    };
    document.getElementById(id).onblur = event => {
      const value = String(event.target.value || "").trim();
      event.target.value = value;
      state[id] = value;
      persistProject();
    };
  });
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
  const ncFolder = document.getElementById("ncFolder");
  const selectNcFolder = document.getElementById("selectNcFolder");
  drop.onclick = () => ncFiles.click();
  selectNcFolder.onclick = event => {
    event.stopPropagation();
    ncFolder.click();
  };
  ncFiles.onchange = () => {
    importNc([...ncFiles.files]);
    ncFiles.value = "";
  };
  ncFolder.onchange = () => {
    importNc([...ncFolder.files].filter(isNc1File));
    ncFolder.value = "";
  };
  ["dragenter", "dragover"].forEach(name => drop.addEventListener(name, event => {
    event.preventDefault();
    drop.classList.add("drag");
  }));
  ["dragleave", "drop"].forEach(name => drop.addEventListener(name, event => {
    event.preventDefault();
    drop.classList.remove("drag");
  }));
  drop.addEventListener("drop", async event => importNc(await filesFromDrop(event.dataTransfer)));

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
  document.getElementById("solve").onclick = solveBatch;
  document.getElementById("navbarSolve").onclick = solveBatch;
  document.getElementById("printPage").onclick = async () => {
    try {
      await NcNestingPrint.printInput(projectSnapshot());
    } catch {
      window.alert(t("error.printSurface"));
    }
  };

  window.NcNestingInput = Object.freeze({ buildPayload: buildSolveRequest, buildSolveRequest, applyInput, projectSnapshot, clearAllInput });

  async function initialize() {
    I18N.apply();
    translateCurrencyOptions();
    ["parts", "stockOrders", "storage"].forEach(render);
    renderNestingGroupControls();
    renderAutoFillState();

    const params = new URLSearchParams(location.search);
    const batchId = params.get("batchId");
    if (batchId) {
      const solvedProject = await NcNesting.getProject(batchId);
      if (!solvedProject) {
        backendErrors = [errorDescriptor("error.savedInputUnavailable")];
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
    backendErrors = [errorDescriptor("error.savedInputLoad")];
    validate(false);
  });
})();
