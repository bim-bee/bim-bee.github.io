(function initNcNestingTerms() {
  "use strict";

  const ACCEPTED_VERSION_KEY = "nc-nesting:terms:accepted-version";
  const ACCEPTED_AT_KEY = "nc-nesting:terms:accepted-at";
  const ACCEPTANCE_VALID_MS = 7 * 24 * 60 * 60 * 1000;
  const TERMS_PAGE = "terms.html";
  let pendingAcceptance = null;
  let modalInitialized = false;

  function currentVersion() {
    return String(window.NcNestingConfig?.termsVersion || "").trim();
  }

  function acceptedVersion() {
    try {
      return String(localStorage.getItem(ACCEPTED_VERSION_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  function acceptedAt() {
    try {
      const value = Number(localStorage.getItem(ACCEPTED_AT_KEY));
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  function isAccepted() {
    const version = currentVersion();
    const timestamp = acceptedAt();
    const now = Date.now();
    return Boolean(version)
      && acceptedVersion() === version
      && timestamp != null
      && timestamp <= now
      && now - timestamp < ACCEPTANCE_VALID_MS;
  }

  function termsUrl() {
    return new URL(TERMS_PAGE, window.location.href).href;
  }

  function openTerms() {
    window.open(termsUrl(), "_blank", "noopener,noreferrer");
  }

  function updateButtons() {
    document.querySelectorAll("[data-terms-button]").forEach(button => {
      button.textContent = "Terms of Use";
      button.setAttribute("aria-label", "Open Terms of Use");
    });
  }

  function saveAcceptance() {
    const version = currentVersion();
    if (!version) throw new Error("The Terms of Use are currently unavailable.");
    const timestamp = Date.now();
    localStorage.setItem(ACCEPTED_VERSION_KEY, version);
    localStorage.setItem(ACCEPTED_AT_KEY, String(timestamp));
    updateButtons();
    window.dispatchEvent(new CustomEvent("nc-nesting:terms-acceptance-changed", { detail: { version, timestamp } }));
  }

  function resetModal(dialog) {
    const checkbox = dialog.querySelector("#termsAgreementCheckbox");
    const agreeButton = dialog.querySelector("#termsAgreeButton");
    if (checkbox) checkbox.checked = false;
    if (agreeButton) agreeButton.disabled = true;
  }

  function cancelPendingAcceptance() {
    const pending = pendingAcceptance;
    pendingAcceptance = null;
    pending?.onCancel?.();
  }

  function initializeModal() {
    if (modalInitialized) return;
    const dialog = document.getElementById("termsDialog");
    if (!dialog) return;
    modalInitialized = true;

    const checkbox = dialog.querySelector("#termsAgreementCheckbox");
    const agreeButton = dialog.querySelector("#termsAgreeButton");
    const closeButton = dialog.querySelector("#termsCloseButton");
    const termsLinks = dialog.querySelectorAll("[data-open-terms]");

    checkbox?.addEventListener("change", () => {
      if (agreeButton) agreeButton.disabled = !checkbox.checked;
    });

    termsLinks.forEach(link => link.addEventListener("click", event => {
      event.preventDefault();
      openTerms();
    }));

    closeButton?.addEventListener("click", () => {
      if (dialog.open) dialog.close("cancelled");
    });

    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      dialog.close("cancelled");
    });

    dialog.addEventListener("close", () => {
      if (dialog.returnValue !== "accepted") cancelPendingAcceptance();
      resetModal(dialog);
    });

    agreeButton?.addEventListener("click", () => {
      if (!checkbox?.checked || agreeButton.disabled || !pendingAcceptance) return;
      const pending = pendingAcceptance;
      pendingAcceptance = null;
      try {
        saveAcceptance();
        dialog.close("accepted");
        pending.onAccept();
      } catch (error) {
        pendingAcceptance = pending;
        window.alert(error.message || "Unable to save Terms of Use acceptance in this browser.");
      }
    });
  }

  function requestAcceptance(onAccept, onCancel) {
    if (isAccepted()) {
      onAccept();
      return true;
    }

    initializeModal();
    const dialog = document.getElementById("termsDialog");
    if (!dialog) throw new Error("The Terms of Use agreement is currently unavailable.");
    if (pendingAcceptance || dialog.open) return false;

    pendingAcceptance = { onAccept, onCancel };
    resetModal(dialog);
    dialog.returnValue = "";
    dialog.showModal();
    dialog.querySelector("#termsAgreementCheckbox")?.focus();
    return false;
  }

  function initializePage() {
    document.querySelectorAll("[data-terms-button]").forEach(button => {
      button.addEventListener("click", openTerms);
    });
    initializeModal();
    updateButtons();
  }

  window.addEventListener("storage", event => {
    if (event.key === ACCEPTED_VERSION_KEY || event.key === ACCEPTED_AT_KEY) updateButtons();
  });
  window.addEventListener("nc-nesting:terms-acceptance-changed", updateButtons);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializePage, { once: true });
  else initializePage();

  window.NcNestingTerms = Object.freeze({
    acceptedVersion,
    acceptedAt,
    currentVersion,
    isAccepted,
    openTerms,
    requestAcceptance,
    updateButtons
  });
})();
