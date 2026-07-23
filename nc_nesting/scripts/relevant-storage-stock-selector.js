(function () {
  "use strict";

  function localizedError(key, params = {}) {
    const error = new Error(key);
    error.key = key;
    error.params = params;
    return error;
  }

  function requiredText(value, key, params = {}) {
    const text = String(value ?? "").trim();
    if (!text) throw localizedError(key, params);
    return text;
  }

  function validatePositiveInteger(value, key) {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) throw localizedError(key);
    return number;
  }

  function validateNonNegativeInteger(value, fieldKey) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0) throw localizedError("validation.nonNegativeInteger", { fieldKey });
    return number;
  }

  class RelevantStorageStockSelector {
    select(profileName, steelGrade, partRequirements, cuttingSettings, storageStockRecords) {
      profileName = requiredText(profileName, "validation.profileRequired");
      steelGrade = requiredText(steelGrade, "validation.steelGradeRequired");
      if (!Array.isArray(partRequirements) || partRequirements.length === 0) {
        throw localizedError("validation.partRequirement");
      }
      if (!cuttingSettings) throw localizedError("validation.cuttingSettings");
      if (!Array.isArray(storageStockRecords)) throw localizedError("validation.storageRecords");

      const trimStart = validateNonNegativeInteger(cuttingSettings.trimStart, "common.startTrim");
      const trimEnd = validateNonNegativeInteger(cuttingSettings.trimEnd, "common.endTrim");
      validateNonNegativeInteger(cuttingSettings.toolWidth, "common.toolWidth");
      validateNonNegativeInteger(cuttingSettings.reusableMinimumLength, "common.reusableMinimum");

      const partIds = new Set();
      const normalizedParts = partRequirements.map(part => {
        const partId = requiredText(part?.partId, "validation.positionRequired");
        if (partIds.has(partId)) throw localizedError("validation.duplicateId", { id: partId });
        partIds.add(partId);
        return {
          partId,
          length: validatePositiveInteger(part.length, "validation.lengthPositive"),
          quantity: validatePositiveInteger(part.quantity, "validation.quantityPositive")
        };
      });

      const storageIds = new Set();
      const compatibleRecords = [];
      const profileOrGradeRejected = [];
      const tooShortRejected = [];

      storageStockRecords.forEach(record => {
        const storageStockId = requiredText(record?.storageStockId, "validation.required", { fieldKey: "common.storageStockId" });
        if (storageIds.has(storageStockId)) throw localizedError("validation.duplicateId", { id: storageStockId });
        storageIds.add(storageStockId);

        const normalized = {
          ...record,
          storageStockId,
          profileName: requiredText(record.profileName, "validation.profileRequired"),
          steelGrade: requiredText(record.steelGrade, "validation.steelGradeRequired"),
          length: validatePositiveInteger(record.length, "validation.lengthPositive"),
          quantity: validatePositiveInteger(record.quantity, "validation.quantityPositive")
        };

        if (normalized.profileName !== profileName || normalized.steelGrade !== steelGrade) {
          profileOrGradeRejected.push(normalized);
          return;
        }

        const fitsAnyPart = normalizedParts.some(part => trimStart + part.length + trimEnd <= normalized.length);
        if (!fitsAnyPart) {
          tooShortRejected.push(normalized);
          return;
        }

        compatibleRecords.push(normalized);
      });

      const recordsByLength = new Map();
      compatibleRecords.forEach(record => {
        if (!recordsByLength.has(record.length)) recordsByLength.set(record.length, []);
        recordsByLength.get(record.length).push(record);
      });

      const groupedStorageStock = [...recordsByLength.entries()].map(([length, records]) => ({
        groupedStorageStockId: `StorageStock:${length}`,
        length,
        quantity: records.reduce((total, record) => total + record.quantity, 0),
        sourceRecords: records.map(record => ({
          storageStockId: record.storageStockId,
          quantity: record.quantity,
          storageArea: record.storageArea
        }))
      }));

      return { groupedStorageStock, profileOrGradeRejected, tooShortRejected };
    }
  }

  window.RelevantStorageStockSelector = RelevantStorageStockSelector;
})();
