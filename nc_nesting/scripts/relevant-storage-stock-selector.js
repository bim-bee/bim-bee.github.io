(function () {
  "use strict";

  function requiredText(value, name) {
    const text = String(value ?? "").trim();
    if (!text) throw new Error(`${name} is required.`);
    return text;
  }

  function validatePositiveInteger(value, name) {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) throw new Error(`${name} must be a positive integer.`);
    return number;
  }

  function validateNonNegativeInteger(value, name) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0) throw new Error(`${name} must be a non-negative integer.`);
    return number;
  }

  class RelevantStorageStockSelector {
    select(profileName, steelGrade, partRequirements, cuttingSettings, storageStockRecords) {
      profileName = requiredText(profileName, "A profile name");
      steelGrade = requiredText(steelGrade, "A steel grade");
      if (!Array.isArray(partRequirements) || partRequirements.length === 0) {
        throw new Error("At least one part requirement is required.");
      }
      if (!cuttingSettings) throw new Error("Cutting settings are required.");
      if (!Array.isArray(storageStockRecords)) throw new Error("Storage records are required.");

      const trimStart = validateNonNegativeInteger(cuttingSettings.trimStart, "Start trim");
      const trimEnd = validateNonNegativeInteger(cuttingSettings.trimEnd, "End trim");
      validateNonNegativeInteger(cuttingSettings.toolWidth, "Tool width");
      validateNonNegativeInteger(cuttingSettings.reusableMinimumLength, "Reusable minimum length");

      const partIds = new Set();
      const normalizedParts = partRequirements.map((part, index) => {
        const partId = requiredText(part?.partId, `Part ${index + 1} ID`);
        if (partIds.has(partId)) throw new Error(`Part ID '${partId}' appears more than once in a nesting group.`);
        partIds.add(partId);
        return {
          partId,
          length: validatePositiveInteger(part.length, `Part '${partId}' length`),
          quantity: validatePositiveInteger(part.quantity, `Part '${partId}' quantity`)
        };
      });

      const storageIds = new Set();
      const compatibleRecords = [];
      const profileOrGradeRejected = [];
      const tooShortRejected = [];

      storageStockRecords.forEach((record, index) => {
        const storageStockId = requiredText(record?.storageStockId, `Storage record ${index + 1} ID`);
        if (storageIds.has(storageStockId)) throw new Error(`Storage ID '${storageStockId}' appears more than once.`);
        storageIds.add(storageStockId);

        const normalized = {
          ...record,
          storageStockId,
          profileName: requiredText(record.profileName, `Storage '${storageStockId}' profile`),
          steelGrade: requiredText(record.steelGrade, `Storage '${storageStockId}' steel grade`),
          length: validatePositiveInteger(record.length, `Storage '${storageStockId}' length`),
          quantity: validatePositiveInteger(record.quantity, `Storage '${storageStockId}' quantity`)
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
