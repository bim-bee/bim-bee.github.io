(function initNcNestingTelemetry() {
  "use strict";

  const ANONYMOUS_USER_KEY = "ncNesting.telemetry.anonymousUserId";
  const SESSION_KEY = "ncNesting.telemetry.sessionId";
  let fallbackAnonymousUserId = null;
  let fallbackSessionId = null;

  function createId(prefix) {
    const value = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${value}`;
  }

  function storedId(storage, key, prefix, fallbackName) {
    try {
      const existing = String(storage?.getItem(key) || "").trim();
      if (existing) return existing;
      const created = createId(prefix);
      storage?.setItem(key, created);
      return created;
    } catch {
      if (fallbackName === "anonymous") {
        fallbackAnonymousUserId ||= createId(prefix);
        return fallbackAnonymousUserId;
      }
      fallbackSessionId ||= createId(prefix);
      return fallbackSessionId;
    }
  }

  function safePageLocation(value) {
    try {
      const url = new URL(value, window.location.origin);
      return `${url.origin}${url.pathname}`;
    } catch {
      return "";
    }
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function summarizeRequest(request) {
    const groups = Array.isArray(request?.groups) ? request.groups : [];
    let partTypeCount = 0;
    let requestedPartQuantity = 0;
    let stockOrderTypeCount = 0;
    let finiteStockOrderQuantity = 0;
    let unlimitedStockOrderCount = 0;
    let storageStockTypeCount = 0;
    let storageStockQuantity = 0;

    groups.forEach(group => {
      const parts = Array.isArray(group?.partRequirements) ? group.partRequirements : [];
      const stockOrders = Array.isArray(group?.stockOrders) ? group.stockOrders : [];
      const storageStock = Array.isArray(group?.storageStock) ? group.storageStock : [];

      partTypeCount += parts.length;
      requestedPartQuantity += parts.reduce((total, part) => total + finiteNumber(part?.quantity), 0);
      stockOrderTypeCount += stockOrders.length;

      stockOrders.forEach(order => {
        if (order?.availableQuantity == null) {
          unlimitedStockOrderCount++;
        } else {
          finiteStockOrderQuantity += finiteNumber(order.availableQuantity);
        }
      });

      storageStockTypeCount += storageStock.length;
      storageStockQuantity += storageStock.reduce((total, stock) => total + finiteNumber(stock?.quantity), 0);
    });

    return {
      nestingGroupCount: groups.length,
      partTypeCount,
      requestedPartQuantity,
      stockOrderTypeCount,
      finiteStockOrderQuantity,
      unlimitedStockOrderCount,
      storageStockTypeCount,
      storageStockQuantity
    };
  }

  function createSolveTelemetry({ request, projectId } = {}) {
    const summary = summarizeRequest(request);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const hostname = String(window.location.hostname || "").toLowerCase();
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

    return {
      eventName: "csp1d_solve_requested",
      eventTimestampUtc: new Date().toISOString(),
      anonymousUserId: storedId(window.localStorage, ANONYMOUS_USER_KEY, "anon", "anonymous"),
      sessionId: storedId(window.sessionStorage, SESSION_KEY, "session", "session"),
      requestId: String(request?.requestId || ""),
      projectId: String(projectId || ""),
      application: "nc-nesting",
      pageUrl: safePageLocation(window.location.href),
      referrer: safePageLocation(document.referrer),
      language: String(navigator.language || ""),
      timezone,
      userAgent: String(navigator.userAgent || ""),
      screenWidth: finiteNumber(window.screen?.width),
      screenHeight: finiteNumber(window.screen?.height),
      viewportWidth: finiteNumber(window.innerWidth),
      viewportHeight: finiteNumber(window.innerHeight),
      devicePixelRatio: finiteNumber(window.devicePixelRatio),
      online: navigator.onLine !== false,
      environment: isLocalhost ? "local" : "production",
      termsVersion: String(window.NcNestingConfig?.termsVersion || ""),
      schemaVersion: String(request?.schemaVersion || ""),
      currencySelected: Boolean(String(request?.currency || "").trim()),
      ...summary
    };
  }

  window.NcNestingTelemetry = Object.freeze({ createSolveTelemetry });
})();
