(function initNcNestingI18n() {
  "use strict";

  const STORAGE_KEY = "bimbee-language";
  const SUPPORTED = new Set(["en", "he"]);
  const LOCALES = Object.freeze({ en: "en-US", he: "he-IL" });
  const CURRENCY_CODES = Object.freeze({
    "Israeli New Shekel": "ILS",
    "US Dollar": "USD",
    "Euro": "EUR",
    "Chinese Yuan (CNY)": "CNY"
  });

  const en = {
    "brand.home": "BIMbee home",
    "nav.menu.open": "Open navigation menu",
    "nav.menu.close": "Close navigation menu",
    "nav.navigation": "Website navigation",
    "nav.language": "Language",
    "nav.home": "Home",
    "nav.about": "About Us",
    "nav.services": "Services",
    "nav.contact": "Contact",
    "nav.blog": "BIMblog",

    "common.ncNesting": "NC Nesting",
    "common.nesting": "Nesting",
    "common.nestingGroup": "Nesting group",
    "common.nestingGroups": "Nesting groups",
    "common.batch": "Batch",
    "common.batchName": "Batch name",
    "common.cuttingJob": "Cutting job",
    "common.cuttingPlan": "Cutting plan",
    "common.cutPlan": "Cut plan",
    "common.cuttingPlanDiagram": "Cutting-plan diagram",
    "common.planSummary": "Plan summary",
    "common.stockOrder": "Stock order",
    "common.stockOrders": "Stock orders",
    "common.storageStock": "Storage stock",
    "common.storageStocks": "Storage stocks",
    "common.stockPiece": "Stock piece",
    "common.cuttingLayouts": "Cutting layouts",
    "common.layout": "Layout",
    "common.allSteelGrades": "All steel grades",
    "common.retrievalIds": "Retrieval IDs",
    "common.storageRetrievals": "Storage retrievals",
    "common.newStockOrder": "New stock order",
    "common.source": "Source",
    "common.storage": "Storage",
    "common.order": "Order",
    "common.parts": "Parts",
    "common.partsToCut": "Parts to cut",
    "common.nestedPart": "Nested part",
    "common.actualPart": "Actual part",
    "common.toolWidth": "Tool width",
    "common.kerf": "Kerf",
    "common.toolCut": "Tool cut",
    "common.toolCuts": "Tool cuts",
    "common.toolWidthCut": "Tool-width cut",
    "common.startTrim": "Start trim",
    "common.endTrim": "End trim",
    "common.startEndTrim": "Start/end trim",
    "common.cuttingPlanLegend": "Cutting-plan legend",
    "common.partsPerLayout": "Parts per layout",
    "common.offcut": "Offcut",
    "common.offcutLength": "Offcut length",
    "common.totalOffcut": "Total offcut",
    "common.reusableOffcut": "Reusable offcut",
    "common.reusableLeftover": "Reusable leftover",
    "common.nonReusableOffcut": "Non-reusable offcut",
    "common.nonReusableWaste": "Non-reusable waste",
    "common.reusableReturned": "Reusable returned",
    "common.reusableReturnedToStorage": "Reusable returned to storage",
    "common.wasteList": "Waste list",
    "common.expectedLeftovers": "Expected leftovers",
    "common.utilization": "Utilization",
    "common.partYield": "Part yield",
    "common.consumed": "Consumed",
    "common.consumedFromStorage": "Consumed from storage",
    "common.storageStockShare": "Storage stock share",
    "common.reusableMinimum": "Reusable minimum",
    "common.reusable": "Reusable",
    "common.nonReusable": "Non-reusable",
    "common.reusableLower": "reusable",
    "common.nonReusableLower": "non-reusable",
    "common.fromStorage": "from storage",
    "common.consumedLower": "consumed",
    "common.offcutLower": "offcut",
    "common.profile": "Profile",
    "common.steelGrade": "Steel grade",
    "common.position": "Position",
    "common.partId": "Part ID",
    "common.stockOrderId": "Stock order ID",
    "common.storageId": "Storage ID",
    "common.storageStockId": "Storage Stock ID",
    "common.stockId": "Stock ID",
    "common.storageArea": "Storage area",
    "common.cutPlanUrl": "Cut Plan URL",
    "common.project": "Project",
    "common.generated": "Generated",
    "common.groups": "Groups",
    "common.parameter": "Parameter",
    "common.value": "Value",
    "common.length": "Length",
    "common.lengthMm": "Length (mm)",
    "common.stockLength": "Stock length",
    "common.storageLength": "Storage length",
    "common.quantity": "Quantity",
    "common.stockQuantity": "Stock quantity",
    "common.percentage": "Percentage",
    "common.price": "Price",
    "common.weight": "Weight",
    "common.batchWeight": "Batch weight",
    "common.cost": "Cost",
    "common.currency": "Currency",
    "common.piece": "Piece",
    "common.area": "Area",
    "common.status": "Status",
    "common.ncFile": "NC file",
    "common.mm": "mm",
    "common.m": "m",
    "common.kg": "kg",
    "common.pcs": "pcs",
    "common.ton": "ton",
    "common.stockOrderQuantity": "Stock order quantity",
    "common.storageQty": "Storage QTY",
    "common.orderQty": "Order QTY",
    "common.orderUpper": "ORDER",
    "common.leftoverUpper": "LEFTOVER",
    "common.orderedUpper": "ORDERED",
    "common.noStockOrder": "No stock order",
    "common.batchTotalWeighted": "Batch total / weighted result",
    "common.batchTotalUpper": "BATCH TOTAL",
    "common.stockQtyShort": "Stock qty.",
    "common.waste": "Waste",
    "common.totalRemaining": "Total offcut",
    "common.loading": "Loading…",
    "common.noRows": "No rows",
    "common.unknown": "Unknown",
    "common.manual": "Manual",
    "common.demoData": "Demo data",
    "common.csv": "CSV",
    "common.optional": "optional",
    "common.on": "On",
    "common.off": "Off",
    "common.yes": "Yes",
    "common.no": "No",
    "common.unlimited": "Unlimited",
    "common.limitedTo": "Limited to {quantity}",

    "page.input.title": "NC Nesting Input Page",
    "page.batch.title": "NC Nesting Batch Result",
    "page.plan.title": "NC Nesting — Cutting Plan",
    "page.plan.main": "NC Nesting Cutting Plan",
    "page.terms.title": "NC Nesting — Terms of Use",
    "page.fullCalculation": "Full Calculation",
    "page.jobParameters": "Job parameters",
    "page.solveJob": "Solve job",
    "page.batchGroups": "Batch nesting groups",
    "page.cutPlanSummary": "Cut Plan Summary",
    "page.cuttingPlanDiagram": "Cutting Plan Diagram",

    "action.terms": "Terms of Use",
    "action.openTerms": "Open Terms of Use",
    "action.printPage": "Print Page",
    "action.printFullSet": "Print Full Set",
    "action.downloadCsv": "Download CSV",
    "action.downloadCsvTemplate": "Download CSV / template",
    "action.importCsv": "Import CSV",
    "action.addRow": "Add row",
    "action.removeRow": "Remove row",
    "action.removeNestingGroup": "Remove nesting group {profile} · {grade}",
    "action.removeResultGroup": "Remove this nesting group from the result",
    "action.removeResultGroupNamed": "Remove nesting group {profile} · {grade} from the result",
    "action.clear": "Clear",
    "action.clearAll": "Clear all input",
    "action.close": "Close",
    "action.backInput": "Back to input",
    "action.backBatch": "Back to batch result",
    "action.loadDemo": "Load dummy demo data",
    "action.autoFillOrders": "Auto-fill orders",
    "action.solve": "Solve",
    "action.viewCutPlan": "View cut plan",
    "action.decreaseOrder": "Decrease order quantity",
    "action.orderQuantity": "Order quantity",
    "action.increaseOrder": "Increase order quantity",
    "action.selectFolder": "choose a folder to pull from",

    "currency.Israeli New Shekel": "Israeli New Shekel",
    "currency.US Dollar": "US Dollar",
    "currency.Euro": "Euro",
    "currency.Chinese Yuan (CNY)": "Chinese Yuan (CNY)",

    "input.description": "Prepare the complete nesting batch before solving.",
    "input.lengthsInteger": "All physical lengths use integer millimetres.",
    "input.solveInstructions": "Enter or import the required data, review the inputs, then select Solve.",
    "input.solving": "Solving batch…",
    "input.checkingCalculationSize": "Checking calculation size…",
    "input.dropNc": "Drop NC1 files here",
    "input.selectNc": "or click to select a batch of .nc1 files or",
    "input.autoFillAttention": "Auto-fill needs attention.",
    "input.stockOrdersDescription": "New stock available for matching profile-and-grade groups.",
    "input.storageDescription": "Existing stocks and offcuts. Storage quantity is always fixed.",
    "input.partsDescription": "NC imports populate this table. Rows may also be imported, pasted from Excel, added manually, or edited.",
    "input.ready": "Input is ready to solve.",
    "input.selectSolve": "Select Solve to calculate the nesting batch.",
    "input.noGroups": "No nesting groups detected",
    "input.oneGroup": "One nesting group detected",
    "input.groupCount": "{count} nesting groups detected",
    "input.groupComplexityExceeded": "{count} nesting groups detected; combined calculation is too large",
    "input.nestingGroupsLabel": "Detected nesting groups",
    "input.groupStatus.ready": "Expected calculation difficulty: low",
    "input.groupStatus.warning": "Expected calculation difficulty: moderate",
    "input.groupStatus.orange": "Expected calculation difficulty: high",
    "input.groupStatus.invalid": "Input is incomplete or cannot be solved",
    "input.groupStatus.checking": "Checking calculation difficulty",
    "input.complexityCheckingDescription": "The Solve button will be enabled after the nesting groups are evaluated.",
    "input.zeroPartRows": "0 part rows",
    "input.partRowCount": "{count} part rows",
    "input.oneIssue": "One issue must be corrected.",
    "input.issueCount": "{count} issues must be corrected.",
    "input.preflightBlockedBatch": "This batch contains blocked nesting groups.",
    "input.preflightWarningBatch": "This batch contains potentially difficult nesting groups.",
    "input.stockExplanation": "Profile is required. Select All steel grades when the stock may be used for every grade of that profile.",
    "input.storageExplanation": "Only storage stocks that exactly match a nesting group and can fit at least one requested part are grouped for solving. Storage-area details remain in the browser project and are not sent for calculation.",
    "input.excelExplanation": "Excel paste: copy a rectangular cell range, select the first destination cell, then paste. NC lengths are rounded up to the next whole millimetre. Position is required and is never generated automatically.",

    "batch.description": "Global result across all nesting groups.",
    "batch.required": "{quantity} required",
    "batch.groupCount": "{count} nesting groups",
    "batch.consumedLength": "{length} of finished parts",
    "batch.offcutLength": "{length} offcut",
    "batch.storageLength": "{length} from storage",
    "batch.reusableLength": "{length} reusable",
    "batch.loadSolved": "Load a solved batch from the NC Nesting Input Page.",
    "batch.orderExplanation": "ORDER changes stock-order quantity only. LEFTOVER = ORDER − ORDER QTY.",
    "batch.storageExplanation": "Storage QTY shows selected storage pieces and their combined length. ORDER QTY is the stock-order quantity required for each stock length.",

    "plan.piece": "Piece {number}",
    "plan.retrieve": "Retrieve {id}",
    "plan.retrieveArea": "Retrieve from {area}",
    "plan.unspecifiedArea": "Unspecified storage area",
    "plan.nestedParts": "Nested parts",
    "plan.noStorage": "No storage stock is selected for this plan.",
    "plan.noOrders": "No stock orders are selected for this plan.",
    "plan.wasteNotSupplied": "Waste not supplied",
    "plan.wasteLength": "{length} waste",
    "plan.noPieces": "No stock pieces.",
    "plan.unavailable": "Plan data is unavailable for this nesting group.",
    "plan.pieceDescription": "Parts {partLength}; tool cuts {cutLength}; consumed {consumed}; offcut {offcut} ({status}).",
    "plan.includesParts": "{length} of finished parts",
    "plan.totalOffcutNote": "{length} total offcut",
    "plan.consumedStorageNote": "{length} consumed from storage",
    "plan.reusableNote": "{length} reusable offcut",
    "plan.cutLabel": "Cut",
    "plan.newStockOrder": "New stock order",

    "validation.required": "{field} is required.",
    "validation.positiveInteger": "{field} must be a positive integer.",
    "validation.nonNegativeInteger": "{field} must be a non-negative integer.",
    "validation.addPart": "Add at least one part.",
    "validation.addStock": "Add at least one stock order or storage stock row.",
    "validation.positionRequired": "Position is required.",
    "validation.steelGradeRequired": "Steel grade is required.",
    "validation.profileRequired": "Profile is required.",
    "validation.quantityPositive": "Quantity must be greater than zero.",
    "validation.lengthPositive": "Length must be greater than zero.",
    "validation.pricePositive": "Price must be blank or a positive whole number.",
    "validation.quantityOrUnlimited": "Enter a positive whole quantity or select Unlimited.",
    "validation.stockQuantityRange": "Enter a whole quantity from 1 to 999 or select Unlimited.",
    "validation.duplicateId": "{id} appears more than once.",
    "validation.partRequirement": "At least one part requirement is required.",
    "validation.cuttingSettings": "Cutting settings are required.",
    "validation.storageRecords": "Storage records are required.",
    "validation.noMaterial": "No matching stock order or usable storage stocks can fit the requested parts.",
    "validation.longPart": "The longest part is {length}. Provide a stock order longer than {limit}.",
    "validation.partConflict": "Part position {id} conflicts with an earlier row because its profile, grade, or length differs.",
    "validation.partRow": "Part row",
    "validation.stockOrderRow": "Stock order row",
    "validation.storageRow": "Storage row",

    "preflight.invalidValues": "This nesting group contains values that cannot be checked safely.",
    "preflight.groupCannotFit": "One or more parts cannot fit the available stock.",
    "preflight.finiteCapacityInsufficient": "The available finite stock capacity is insufficient for the required parts.",
    "preflight.groupTooLarge": "This nesting group is too large to send for exact calculation.",
    "preflight.batchTooComplex": "The combined calculation is too large. Remove one or more higher-difficulty nesting groups and solve them separately.",
    "preflight.groupMayTakeLonger": "This nesting group may take longer than usual.",

    "error.prepare": "The job could not be prepared. Please review the input.",
    "error.solve": "The job could not be solved. Please try again.",
    "error.solveGroup": "The job could not be solved. Please review this nesting group.",
    "error.removeResultGroup": "The nesting group could not be removed from the saved result.",
    "error.invalidResult": "The returned result could not be processed.",
    "error.serviceUnavailable": "The calculation service is currently unavailable.",
    "error.savedInputUnavailable": "The saved input for this solved batch is not available in this browser.",
    "error.savedInputLoad": "The saved input could not be loaded. Please enter the job data again.",
    "error.batchUnavailable": "This solved batch is not available in this browser.",
    "error.solveAgain": "Solve the job again from the input page.",
    "error.openSolvedBatch": "Open a solved batch from the NC Nesting Input Page.",
    "error.returnBatch": "Return to the Batch Result page and open a cutting plan.",
    "error.planUnavailable": "This cutting plan is not available in this browser.",
    "error.planProcess": "The cutting plan could not be processed.",
    "error.unsupportedSegment": "The cutting plan contains an unsupported segment.",
    "error.fullPrint": "The full print set could not be created.",
    "error.printSurface": "The print surface could not be created.",
    "error.printImage": "A print image could not be loaded.",
    "error.batchLoad": "The batch result could not be loaded.",
    "error.termsOpen": "The Terms of Use agreement could not be opened.",
    "error.termsUnavailable": "The Terms of Use are currently unavailable.",
    "error.termsAcceptanceUnavailable": "The Terms of Use agreement is currently unavailable.",
    "error.termsSave": "Unable to save Terms of Use acceptance in this browser.",

    "nc.stMissing": "ST header was not found.",
    "nc.invalidFields": "Required ST fields are missing or invalid.",
    "nc.unsupported": "Unsupported file type; only .nc1 files are accepted.",
    "nc.plateIgnored": "Plate files were detected in the upload and ignored.",

    "planError.sequence": "Piece {number} has an invalid segment sequence.",
    "planError.trim": "Piece {number} has invalid trim segments.",
    "planError.cut": "Piece {number} has a missing cut segment.",
    "planError.offcut": "Piece {number} has an invalid offcut segment.",
    "planError.part": "Piece {number} has an invalid part segment.",
    "planError.length": "Piece {number} has an invalid segment length.",
    "planError.unnamed": "Piece {number} has an unnamed part segment.",
    "planError.total": "Piece {number} lengths do not match the selected stock.",

    "terms.agreementTitle": "Agreement to Terms of Use",
    "terms.before": "Before using this calculator, please read the Terms of Use.",
    "terms.confirm": "By checking the box below and selecting Agree and Proceed, you confirm that you have read, understood, and agree to be bound by the Terms of Use governing your use of this calculator.",
    "terms.checkbox": "I have read and agree to the Terms of Use.",
    "terms.agree": "Agree and Proceed",
    "terms.loading": "Loading Terms of Use…",
    "terms.lastUpdated": "Last updated: {date}",
    "terms.loadFailed": "Unable to load the Terms of Use.",
    "terms.documentUnavailable": "The document is unavailable.",
    "terms.versionInvalid": "The Terms of Use version is not configured correctly.",
    "terms.bundleUnavailable": "The bundled Terms of Use document is unavailable.",
    "terms.documentEmpty": "The document is empty.",

    "print.page": "Page {number}",
    "print.inputSummary": "Input summary",
    "print.jobSettings": "Job settings",
    "print.stockOrders": "Stock orders",
    "print.storageStocks": "Storage stocks",
    "print.parts": "Parts to cut",
    "print.generatedAt": "Generated",
    "print.noRows": "No rows",

    "csv.nestingGroup": "Nesting Group",
    "csv.profile": "Profile",
    "csv.steelGrade": "Steel Grade",
    "csv.length": "Length",
    "csv.utilizationPercent": "Utilization %",
    "csv.wastePercent": "Waste %",
    "csv.weightTon": "Weight (ton)",
    "csv.currency": "Currency",
    "csv.cost": "Cost",
    "csv.storageQty": "Storage QTY",
    "csv.storageLength": "Storage Length (mm)",
    "csv.orderQty": "Order QTY",
    "csv.order": "ORDER",
    "csv.leftover": "LEFTOVER",
    "csv.cutPlanUrl": "Cut Plan URL",
    "csv.batchTotal": "BATCH TOTAL",
    "csv.position": "Position",
    "csv.quantity": "Quantity",
    "csv.source": "Source",
    "csv.stockOrderId": "Stock Order ID",
    "csv.unlimited": "Unlimited",
    "csv.price": "Price",
    "csv.storageStockId": "Storage Stock ID",
    "csv.storageArea": "Storage Area"
  };

  const he = {
    "brand.home": "דף הבית של BIMbee",
    "nav.menu.open": "פתיחת תפריט ניווט",
    "nav.menu.close": "סגירת תפריט ניווט",
    "nav.navigation": "ניווט באתר",
    "nav.language": "שפה",
    "nav.home": "דף הבית",
    "nav.about": "אודותינו",
    "nav.services": "פתרונות ל-BIM",
    "nav.contact": "צור קשר",
    "nav.blog": "בימ-בלוג",

    "common.ncNesting": "מחשבון חיתוך NC",
    "common.nesting": "תכנון חיתוך",
    "common.nestingGroup": "קבוצת חיתוך",
    "common.nestingGroups": "קבוצות חיתוך",
    "common.batch": "עבודת חיתוך",
    "common.batchName": "שם עבודת החיתוך",
    "common.cuttingJob": "עבודת חיתוך",
    "common.cuttingPlan": "תכנית חיתוך",
    "common.cutPlan": "תכנית חיתוך",
    "common.cuttingPlanDiagram": "תרשים תכנית החיתוך",
    "common.planSummary": "סיכום תכנית החיתוך",
    "common.stockOrder": "מוט להזמנה",
    "common.stockOrders": "מוטות להזמנה",
    "common.storageStock": "מוט מהמלאי",
    "common.storageStocks": "מוטות מהמלאי",
    "common.stockPiece": "מוט",
    "common.cuttingLayouts": "פריסות חיתוך",
    "common.layout": "פריסה",
    "common.allSteelGrades": "כל דרגות הפלדה",
    "common.retrievalIds": "מזהי איסוף",
    "common.storageRetrievals": "מוטות לאיסוף מהמלאי",
    "common.newStockOrder": "מוט חדש להזמנה",
    "common.source": "מקור",
    "common.storage": "מלאי",
    "common.order": "הזמנה",
    "common.parts": "חלקים",
    "common.partsToCut": "חלקים לחיתוך",
    "common.nestedPart": "חלק לחיתוך",
    "common.actualPart": "חלק נדרש",
    "common.toolWidth": "רוחב המסור",
    "common.kerf": "רוחב המסור",
    "common.toolCut": "חיתוך מסור",
    "common.toolCuts": "חיתוכי מסור",
    "common.toolWidthCut": "עובי מסור",
    "common.startTrim": "חיתוך קצה התחלה",
    "common.endTrim": "חיתוך קצה סוף",
    "common.startEndTrim": "חיתוכי קצה",
    "common.cuttingPlanLegend": "מקרא תכנית החיתוך",
    "common.partsPerLayout": "חלקים בכל פריסה",
    "common.offcut": "שארית חיתוך",
    "common.offcutLength": "אורך שארית",
    "common.totalOffcut": "סה״כ שאריות",
    "common.reusableOffcut": "חוזר למלאי",
    "common.reusableLeftover": "חוזר למלאי",
    "common.nonReusableOffcut": "פסולת",
    "common.nonReusableWaste": "פסולת",
    "common.reusableReturned": "חוזר למלאי",
    "common.reusableReturnedToStorage": "חוזר למלאי",
    "common.wasteList": "רשימת שאריות",
    "common.expectedLeftovers": "שאריות צפויות",
    "common.utilization": "ניצולת",
    "common.partYield": "ניצולת חלקים",
    "common.consumed": "אורך מנוצל",
    "common.consumedFromStorage": "נוצל מהמלאי",
    "common.storageStockShare": "נוצל מהמלאי הקיים",
    "common.reusableMinimum": "אורך שארית שמישה",
    "common.reusable": "להחזרה למלאי",
    "common.nonReusable": "פסולת",
    "common.reusableLower": "שמישה",
    "common.nonReusableLower": "לא שמישה",
    "common.fromStorage": "מהמלאי",
    "common.consumedLower": "אורך מנוצל",
    "common.offcutLower": "שארית",
    "common.profile": "פרופיל",
    "common.steelGrade": "דרגת פלדה",
    "common.position": "סימון חלק",
    "common.partId": "סימון חלק",
    "common.stockOrderId": "סימון מזהה להזמנה",
    "common.storageId": "סימון מזהה במלאי",
    "common.storageStockId": "סימון מזהה במלאי",
    "common.stockId": "סימון מזהה מוט",
    "common.storageArea": "אזור אחסון",
    "common.cutPlanUrl": "קישור לתכנית החיתוך",
    "common.project": "פרויקט",
    "common.generated": "הופק",
    "common.groups": "קבוצות",
    "common.parameter": "הגדרה",
    "common.value": "ערך",
    "common.length": "אורך",
    "common.lengthMm": "אורך (מ״מ)",
    "common.stockLength": "אורך מוט",
    "common.storageLength": "אורך מהמלאי",
    "common.quantity": "כמות",
    "common.stockQuantity": "כמות מוטות",
    "common.percentage": "אחוז",
    "common.price": "עלות",
    "common.weight": "משקל",
    "common.batchWeight": "משקל כולל",
    "common.cost": "עלות",
    "common.currency": "מטבע",
    "common.piece": "מוט",
    "common.area": "אזור",
    "common.status": "סטטוס",
    "common.ncFile": "קובץ NC",
    "common.mm": "מ״מ",
    "common.m": "מ׳",
    "common.kg": "ק״ג",
    "common.pcs": "יח׳",
    "common.ton": "טון",
    "common.stockOrderQuantity": "כמות מוטות להזמנה",
    "common.storageQty": "כמות מהמלאי",
    "common.orderQty": "כמות נדרשת להזמנה",
    "common.orderUpper": "הזמנה בנוסף",
    "common.leftoverUpper": "יתרה",
    "common.orderedUpper": "הוזמן",
    "common.noStockOrder": "ללא מוטות להזמנה",
    "common.batchTotalWeighted": "סה״כ עבודה / תוצאה משוקללת",
    "common.batchTotalUpper": "סה״כ עבודה",
    "common.stockQtyShort": "כמות מוטות",
    "common.waste": "סה״כ שאריות",
    "common.totalRemaining": "סה״כ שאריות",
    "common.loading": "טוען…",
    "common.noRows": "אין שורות",
    "common.unknown": "לא ידוע",
    "common.manual": "ידני",
    "common.demoData": "נתוני הדגמה",
    "common.csv": "CSV",
    "common.optional": "אופציונלי",
    "common.on": "פעיל",
    "common.off": "כבוי",
    "common.yes": "כן",
    "common.no": "לא",
    "common.unlimited": "כמות בלתי מוגבלת",
    "common.limitedTo": "מוגבל ל־{quantity}",

    "page.input.title": "הזנת נתונים — מחשבון חיתוך NC",
    "page.batch.title": "תוצאות עבודת החיתוך",
    "page.plan.title": "מחשבון חיתוך NC — תכנית חיתוך",
    "page.plan.main": "תכנית חיתוך",
    "page.terms.title": "מחשבון חיתוך NC — תנאי שימוש",
    "page.fullCalculation": "חישוב מלא",
    "page.jobParameters": "הגדרות עבודת החיתוך",
    "page.solveJob": "חישוב עבודת החיתוך",
    "page.batchGroups": "קבוצות החיתוך בעבודה",
    "page.cutPlanSummary": "סיכום תכנית החיתוך",
    "page.cuttingPlanDiagram": "תרשים תכנית החיתוך",

    "action.terms": "תנאי שימוש",
    "action.openTerms": "פתיחת תנאי השימוש",
    "action.printPage": "הדפסת דוח עמוד",
    "action.printFullSet": "הדפסת הדוח המלא",
    "action.downloadCsv": "הורדת CSV",
    "action.downloadCsvTemplate": "הורדת CSV",
    "action.importCsv": "העלאת CSV",
    "action.addRow": "הוספת שורה",
    "action.removeRow": "הסרת שורה",
    "action.removeNestingGroup": "הסרת קבוצת החיתוך {profile} · {grade}",
    "action.removeResultGroup": "הסרת קבוצת החיתוך מהתוצאה",
    "action.removeResultGroupNamed": "הסרת קבוצת החיתוך {profile} · {grade} מהתוצאה",
    "action.clear": "ניקוי",
    "action.clearAll": "ניקוי כל הנתונים",
    "action.close": "סגירה",
    "action.backInput": "חזרה להזנת נתונים",
    "action.backBatch": "חזרה לחישוב הכולל",
    "action.loadDemo": "טעינת נתוני הדגמה",
    "action.autoFillOrders": "מילוי אוטומטי",
    "action.solve": "חישוב",
    "action.viewCutPlan": "פתיחת תכנית חיתוך",
    "action.decreaseOrder": "הפחתת כמות להזמנה",
    "action.orderQuantity": "כמות להזמנה",
    "action.increaseOrder": "הגדלת כמות להזמנה",
    "action.selectFolder": "בחרו תיקייה לחיפוש",

    "currency.Israeli New Shekel": "שקל חדש (ILS)",
    "currency.US Dollar": "דולר אמריקאי (USD)",
    "currency.Euro": "אירו (EUR)",
    "currency.Chinese Yuan (CNY)": "יואן סיני (CNY)",

    "input.description": "הזינו את כל נתוני עבודת החיתוך לפני החישוב.",
    "input.lengthsInteger": "כל המידות מוזנות במילימטרים שלמים.",
    "input.solveInstructions": "הזינו או ייבאו את הנתונים הנדרשים, בדקו אותם ולאחר מכן לחצו על חישוב.",
    "input.solving": "מחשב את עבודת החיתוך…",
    "input.checkingCalculationSize": "בודק את גודל החישוב…",
    "input.dropNc": "גררו לכאן קובצי NC1",
    "input.selectNc": "או לחצו להעלאת מספר קובצי ‎.nc1 או",
    "input.autoFillAttention": "נדרשת בדיקה של המילוי האוטומטי.",
    "input.stockOrdersDescription": "מוטות חדשים שניתן להזמין עבור קבוצות בעלות פרופיל ודרגת פלדה מתאימים.",
    "input.storageDescription": "מוטות ושאריות חיתוך הקיימים במלאי. הכמות במלאי תמיד מוגדרת מראש.",
    "input.partsDescription": "ייבוא קובצי NC ממלא את הטבלה. ניתן גם לייבא שורות, להדביק אותן מ־Excel, להוסיף אותן ידנית או לערוך אותן.",
    "input.ready": "הנתונים מוכנים לחישוב.",
    "input.selectSolve": "לחצו על חישוב כדי לחשב את עבודת החיתוך.",
    "input.noGroups": "לא זוהו קבוצות חיתוך",
    "input.oneGroup": "זוהתה קבוצת חיתוך אחת",
    "input.groupCount": "זוהו {count} קבוצות חיתוך",
    "input.groupComplexityExceeded": "זוהו {count} קבוצות חיתוך; החישוב המשולב גדול מדי",
    "input.nestingGroupsLabel": "קבוצות חיתוך שזוהו",
    "input.groupStatus.ready": "מורכבות חישוב צפויה: נמוכה",
    "input.groupStatus.warning": "מורכבות חישוב צפויה: בינונית",
    "input.groupStatus.orange": "מורכבות חישוב צפויה: גבוהה",
    "input.groupStatus.invalid": "הנתונים חסרים או שאינם מתאימים לחישוב",
    "input.groupStatus.checking": "נבדקת מורכבות החישוב",
    "input.complexityCheckingDescription": "כפתור החישוב יופעל לאחר בדיקת קבוצות החיתוך.",
    "input.zeroPartRows": "0 שורות חלקים",
    "input.partRowCount": "{count} שורות חלקים",
    "input.oneIssue": "יש לתקן בעיה אחת.",
    "input.issueCount": "יש לתקן {count} בעיות.",
    "input.preflightBlockedBatch": "עבודת החיתוך כוללת קבוצות שלא ניתן לשלוח לחישוב.",
    "input.preflightWarningBatch": "עבודת החיתוך כוללת קבוצות שעשויות להיות מורכבות לחישוב.",
    "input.stockExplanation": "חובה להזין פרופיל. בחרו כל דרגות הפלדה כאשר ניתן להשתמש במוט עבור כל דרגה של אותו פרופיל.",
    "input.storageExplanation": "לחישוב ייכללו מהמלאי רק מוטות המתאימים בדיוק לקבוצת חיתוך כלשהי עבור אורך חלק נדרש אחד לפחות. פרטי אזור האחסון נשמרים בפרויקט בדפדפן ואינם נשלחים לחישוב.",
    "input.excelExplanation": "להדבקה מ־Excel, העתיקו טווח תאים מלבני, בחרו את תא היעד הראשון והדביקו. אורכים מקובצי NC מעוגלים כלפי מעלה למילימטר השלם הבא. חובה להזין סימון חלק והוא אינו נוצר אוטומטית.",

    "batch.description": "סיכום כולל של כל קבוצות החיתוך.",
    "batch.required": "סך מוטות לחיתוך {quantity}",
    "batch.groupCount": "{count} קבוצות חיתוך",
    "batch.consumedLength": "אורך חלקים מוגמרים {length}",
    "batch.offcutLength": "שארית {length}",
    "batch.storageLength": "מהמלאי {length}",
    "batch.reusableLength": "שמישה {length}",
    "batch.loadSolved": "יש לפתוח עבודת חיתוך דרך דף הזנת הנתונים.",
    "batch.orderExplanation": "\"הזמנה בנוסף\" מאפשרת לשנות את כמות המוטות שיוזמנו בפועל ביחס לכמות שחושבה כנדרשת לביצוע עבודת החיתוך. \"יתרה\" = \"הזמנה בנוסף\" − \"כמות נדרשת להזמנה\".",
    "batch.storageExplanation": "\"כמות מהמלאי\" מציגה את מספר המוטות שנבחרו מהמלאי ואת אורכם הכולל. \"כמות נדרשת להזמנה\" מציגה את מספר המוטות שנדרש להזמין.",

    "plan.piece": "מוט {number}",
    "plan.retrieve": "איסוף {id}",
    "plan.retrieveArea": "איסוף מאזור אחסון {area}",
    "plan.unspecifiedArea": "אזור אחסון לא הוגדר",
    "plan.nestedParts": "חלקים לחיתוך",
    "plan.noStorage": "לא נבחרו מוטות מהמלאי עבור תכנית זו.",
    "plan.noOrders": "לא נבחרו מוטות להזמנה עבור תכנית זו.",
    "plan.wasteNotSupplied": "נתוני השארית לא הוגדרו",
    "plan.wasteLength": "שארית באורך {length}",
    "plan.noPieces": "אין מוטות להצגה.",
    "plan.unavailable": "נתוני תכנית החיתוך אינם זמינים עבור קבוצת חיתוך זו.",
    "plan.pieceDescription": "חלקים {partLength}; חיתוכי מסור {cutLength}; אורך מנוצל {consumed}; שארית {offcut} ({status}).",
    "plan.includesParts": "אורך חלקים מוגמרים {length}",
    "plan.totalOffcutNote": "{length} סה״כ שאריות",
    "plan.consumedStorageNote": "{length} נוצל מהמלאי",
    "plan.reusableNote": "{length} חוזר למלאי",
    "plan.cutLabel": "חיתוך",
    "plan.newStockOrder": "מוט חדש להזמנה",

    "validation.required": "חובה להזין {field}.",
    "validation.positiveInteger": "{field} חייב להיות מספר שלם וחיובי.",
    "validation.nonNegativeInteger": "{field} חייב להיות מספר שלם שאינו שלילי.",
    "validation.addPart": "יש להוסיף לפחות חלק אחד.",
    "validation.addStock": "יש להוסיף לפחות מוט אחד להזמנה או מוט אחד מהמלאי.",
    "validation.positionRequired": "חובה להזין סימון חלק.",
    "validation.steelGradeRequired": "חובה להזין דרגת פלדה.",
    "validation.profileRequired": "חובה להזין פרופיל.",
    "validation.quantityPositive": "הכמות חייבת להיות גדולה מאפס.",
    "validation.lengthPositive": "האורך חייב להיות גדול מאפס.",
    "validation.pricePositive": "העלות חייבת להיות ריקה או מספר שלם וחיובי.",
    "validation.quantityOrUnlimited": "הזינו כמות שלמה וחיובית או בחרו כמות בלתי מוגבלת.",
    "validation.stockQuantityRange": "הזינו כמות שלמה בין 1 ל־999 או בחרו כמות בלתי מוגבלת.",
    "validation.duplicateId": "המזהה {id} מופיע יותר מפעם אחת.",
    "validation.partRequirement": "נדרשת להזין נתונים לחלק אחד לפחות.",
    "validation.cuttingSettings": "נדרשות הגדרות חיתוך.",
    "validation.storageRecords": "נדרשים נתוני מלאי.",
    "validation.noMaterial": "אין מספיק חומר כדי לחתוך את כל החלקים, יש לעדכן בהתאם מוטות להזמנה או מהמלאי.",
    "validation.longPart": "אורך החלק הארוך ביותר הוא {length}. יש להוסיף מוט להזמנה שאורכו גדול מ־{limit}.",
    "validation.partConflict": "סימון החלק {id} מתנגש עם שורה קודמת שבה הפרופיל, דרגת הפלדה או האורך שונים.",
    "validation.partRow": "שורת חלק",
    "validation.stockOrderRow": "שורת מוט להזמנה",
    "validation.storageRow": "שורת מוט מהמלאי",

    "preflight.invalidValues": "קבוצת החיתוך כוללת ערכים שלא ניתן לבדוק בבטחה.",
    "preflight.groupCannotFit": "חלק אחד או יותר אינו מתאים למוטות הזמינים.",
    "preflight.finiteCapacityInsufficient": "הקיבולת הכוללת של המוטות הזמינים בכמות מוגבלת אינה מספיקה לחלקים הנדרשים.",
    "preflight.groupTooLarge": "קבוצת החיתוך גדולה מדי לשליחה לחישוב מדויק.",
    "preflight.batchTooComplex": "החישוב המשולב גדול מדי. יש להסיר קבוצת חיתוך אחת או יותר בעלת מורכבות גבוהה ולחשב אותן בנפרד.",
    "preflight.groupMayTakeLonger": "החישוב של קבוצת החיתוך עשוי להימשך זמן רב מהרגיל.",

    "error.prepare": "לא ניתן להכין את עבודת החיתוך. יש לבדוק את הנתונים שהוזנו.",
    "error.solve": "לא ניתן לחשב את עבודת החיתוך. יש לנסות שוב.",
    "error.solveGroup": "לא ניתן לחשב את קבוצת החיתוך. יש לבדוק את הנתונים שהוזנו.",
    "error.removeResultGroup": "לא ניתן להסיר את קבוצת החיתוך מהתוצאה השמורה.",
    "error.invalidResult": "לא ניתן לעבד את תוצאת החישוב שהתקבלה.",
    "error.serviceUnavailable": "שירות החישוב אינו זמין כרגע.",
    "error.savedInputUnavailable": "נתוני הקלט של עבודת החיתוך אינם זמינים בדפדפן זה.",
    "error.savedInputLoad": "לא ניתן לטעון את הנתונים השמורים. יש להזין מחדש את נתוני העבודה.",
    "error.batchUnavailable": "עבודת החיתוך המחושבת אינה זמינה בדפדפן זה.",
    "error.solveAgain": "יש לחשב מחדש דרך דף הזנת הנתונים.",
    "error.openSolvedBatch": "יש לפתוח עבודת חיתוך שחושבה דרך דף הזנת הנתונים.",
    "error.returnBatch": "יש לחזור לדף החישוב הכולל ולפתוח תכנית חיתוך.",
    "error.planUnavailable": "תכנית החיתוך אינה זמינה בדפדפן זה.",
    "error.planProcess": "לא ניתן לעבד את תכנית החיתוך.",
    "error.unsupportedSegment": "תכנית החיתוך כוללת מקטע שאינו נתמך.",
    "error.fullPrint": "לא ניתן ליצור את הדוח המלא להדפסה.",
    "error.printSurface": "לא ניתן לטעון דוח להדפסה.",
    "error.printImage": "לא ניתן לטעון דוח להדפסה.",
    "error.batchLoad": "לא ניתן לטעון את תוצאות עבודת החיתוך.",
    "error.termsOpen": "לא ניתן לפתוח את ההסכמה לתנאי השימוש.",
    "error.termsUnavailable": "תנאי השימוש אינם זמינים כרגע.",
    "error.termsAcceptanceUnavailable": "ההסכמה לתנאי השימוש אינה זמינה כרגע.",
    "error.termsSave": "לא ניתן לשמור את ההסכמה לתנאי השימוש בדפדפן זה.",

    "nc.stMissing": "קובץ ה־NC שהועלה אינו תקין.",
    "nc.invalidFields": "קובץ ה־NC שהועלה אינו תקין.",
    "nc.unsupported": "סוג הקובץ אינו נתמך. ניתן להעלות קובצי ‎.nc1 בלבד.",
    "nc.plateIgnored": "זוהו קובצי פלטות בהעלאה והם הוחרגו מהייבוא.",

    "planError.sequence": "רצף המקטעים במוט {number} אינו תקין.",
    "planError.trim": "חיתוך הקצה במוט {number} אינו תקין.",
    "planError.cut": "חסר מקטע חיתוך במוט {number}.",
    "planError.offcut": "מקטע השארית במוט {number} אינו תקין.",
    "planError.part": "מקטע החלק במוט {number} אינו תקין.",
    "planError.length": "אורך מקטע במוט {number} אינו תקין.",
    "planError.unnamed": "קיים במוט {number} מקטע חלק ללא שם.",
    "planError.total": "סכום אורכי המקטעים במוט {number} אינו תואם לאורך המוט שנבחר.",

    "terms.agreementTitle": "הסכמה לתנאי השימוש",
    "terms.before": "לפני השימוש במחשבון, יש לקרוא את תנאי השימוש.",
    "terms.confirm": "בסימון התיבה שלהלן ובלחיצה על אישור והמשך, אתם מאשרים שקראתם והבנתם את תנאי השימוש ושאתם מסכימים להיות כפופים להם בעת השימוש במחשבון.",
    "terms.checkbox": "קראתי את תנאי השימוש ואני מסכים להם.",
    "terms.agree": "אישור והמשך",
    "terms.loading": "טוען את תנאי השימוש…",
    "terms.lastUpdated": "עודכן לאחרונה: {date}",
    "terms.loadFailed": "לא ניתן לטעון את תנאי השימוש.",
    "terms.documentUnavailable": "המסמך אינו זמין.",
    "terms.versionInvalid": "גרסת תנאי השימוש אינה מוגדרת כראוי.",
    "terms.bundleUnavailable": "קובץ תנאי השימוש המקומי אינו זמין.",
    "terms.documentEmpty": "המסמך ריק.",

    "print.page": "עמוד {number}",
    "print.inputSummary": "סיכום נתוני הקלט",
    "print.jobSettings": "הגדרות עבודת החיתוך",
    "print.stockOrders": "מוטות להזמנה",
    "print.storageStocks": "מוטות מהמלאי",
    "print.parts": "חלקים לחיתוך",
    "print.generatedAt": "הופק",
    "print.noRows": "אין שורות",

    "csv.nestingGroup": "קבוצת חיתוך",
    "csv.profile": "פרופיל",
    "csv.steelGrade": "דרגת פלדה",
    "csv.length": "אורך",
    "csv.utilizationPercent": "ניצולת %",
    "csv.wastePercent": "סה״כ שאריות %",
    "csv.weightTon": "משקל (טון)",
    "csv.currency": "מטבע",
    "csv.cost": "עלות",
    "csv.storageQty": "כמות מהמלאי",
    "csv.storageLength": "אורך מהמלאי (מ״מ)",
    "csv.orderQty": "כמות נדרשת להזמנה",
    "csv.order": "הזמנה בנוסף",
    "csv.leftover": "יתרה",
    "csv.cutPlanUrl": "קישור לתכנית החיתוך",
    "csv.batchTotal": "סה״כ עבודה",
    "csv.position": "סימון חלק",
    "csv.quantity": "כמות",
    "csv.source": "מקור",
    "csv.stockOrderId": "סימון מזהה להזמנה",
    "csv.unlimited": "כמות בלתי מוגבלת",
    "csv.price": "עלות",
    "csv.storageStockId": "סימון מזהה במלאי",
    "csv.storageArea": "אזור אחסון"
  };

  const dictionaries = Object.freeze({ en: Object.freeze(en), he: Object.freeze(he) });

  function normalizeLanguage(value) {
    const language = String(value || "").trim().toLowerCase().split("-")[0];
    return SUPPORTED.has(language) ? language : null;
  }

  function storedLanguage() {
    try {
      return normalizeLanguage(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  }

  function getLanguage() {
    const navbarLanguage = window.NCNestingLanguage?.get?.();
    return normalizeLanguage(navbarLanguage) || storedLanguage() || normalizeLanguage(document.documentElement.lang) || "en";
  }

  function direction(language = getLanguage()) {
    return normalizeLanguage(language) === "he" ? "rtl" : "ltr";
  }

  function locale(language = getLanguage()) {
    return LOCALES[normalizeLanguage(language) || "en"];
  }

  function interpolate(template, params) {
    return String(template).replace(/\{([A-Za-z0-9_]+)\}/g, (match, name) => Object.prototype.hasOwnProperty.call(params || {}, name) ? String(params[name] ?? "") : match);
  }

  function t(key, params = {}, language = getLanguage()) {
    const normalized = normalizeLanguage(language) || "en";
    const template = dictionaries[normalized][key] ?? dictionaries.en[key] ?? key;
    return interpolate(template, params);
  }

  function isolate(value) {
    return `\u2066${String(value ?? "")}\u2069`;
  }

  function formatNumber(value, options = {}, language = getLanguage()) {
    return new Intl.NumberFormat(locale(language), options).format(Number(value) || 0);
  }

  function formatDate(value, options = {}, language = getLanguage()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(locale(language), options).format(date);
  }

  function formatDateTime(value, options = {}, language = getLanguage()) {
    return formatDate(value, { dateStyle: "medium", timeStyle: "short", ...options }, language);
  }

  function currencyCode(value) {
    const text = String(value || "").trim();
    return CURRENCY_CODES[text] || (/^[A-Za-z]{3}$/.test(text) ? text.toUpperCase() : null);
  }

  function currencySymbol(currency, language = getLanguage()) {
    const code = currencyCode(currency);
    if (!code) return String(currency || "").trim();
    try {
      return new Intl.NumberFormat(locale(language), {
        style: "currency",
        currency: code,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).formatToParts(0).find(part => part.type === "currency")?.value || code;
    } catch {
      return code;
    }
  }

  function priceParts(value, currency, options = {}, language = getLanguage()) {
    const normalized = normalizeLanguage(language) || "en";
    return {
      symbol: currencySymbol(currency, normalized),
      value: formatNumber(value, options, normalized),
      language: normalized
    };
  }

  function priceText(value, currency, options = {}, language = getLanguage()) {
    const parts = priceParts(value, currency, options, language);
    return `${parts.symbol}${parts.value}`;
  }

  function priceHtml(value, currency, options = {}, language = getLanguage()) {
    const parts = priceParts(value, currency, options, language);
    return `<span class="price-value" dir="ltr"><span class="price-symbol">${escapeHtml(parts.symbol)}</span><span class="price-number">${escapeHtml(parts.value)}</span></span>`;
  }

  function formatCurrency(value, currency, options = {}, language = getLanguage()) {
    return priceText(value, currency, options, language);
  }

  function currencyLabel(value, language = getLanguage()) {
    const text = String(value || "").trim();
    return text ? t(`currency.${text}`, {}, language) : "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizedUnitKey(key) {
    return String(key || "").replace(/^common\./, "");
  }

  function measurementParts(value, unitKey, options = {}, language = getLanguage()) {
    const normalized = normalizeLanguage(language) || "en";
    const key = normalizedUnitKey(unitKey);
    return {
      value: formatNumber(value, options, normalized),
      unit: t(`common.${key}`, {}, normalized),
      language: normalized,
      direction: direction(normalized),
      unitKey: key
    };
  }

  function measurementText(value, unitKey, options = {}, language = getLanguage()) {
    const parts = measurementParts(value, unitKey, options, language);
    return parts.direction === "rtl" ? `${parts.unit} ${parts.value}` : `${parts.value} ${parts.unit}`;
  }

  function measurementHtml(value, unitKey, options = {}, language = getLanguage()) {
    const parts = measurementParts(value, unitKey, options, language);
    return `<span class="measurement" data-measurement-unit="${escapeHtml(parts.unitKey)}"><span class="measurement-value" dir="ltr">${escapeHtml(parts.value)}</span><span class="measurement-unit" lang="${escapeHtml(parts.language)}" dir="${parts.direction}">${escapeHtml(parts.unit)}</span></span>`;
  }

  function createMeasurement(value, unitKey, options = {}, language = getLanguage()) {
    const template = document.createElement("template");
    template.innerHTML = measurementHtml(value, unitKey, options, language);
    return template.content.firstElementChild;
  }

  function quantityText(value, options = {}, language = getLanguage()) {
    return measurementText(value, "pcs", options, language);
  }

  function quantityHtml(value, options = {}, language = getLanguage()) {
    return measurementHtml(value, "pcs", options, language).replace('class="measurement"', 'class="measurement quantity-value"');
  }

  function inlineNumberHtml(value, options = {}, language = getLanguage()) {
    return `<span class="inline-number" dir="ltr">${escapeHtml(formatNumber(value, options, language))}</span>`;
  }

  function inlineValuesHtml(values, options = {}) {
    const items = (Array.isArray(values) ? values : [values]).filter(value => value != null && String(value).trim() !== "");
    const separator = options.separator == null ? "·" : String(options.separator);
    const extraClass = String(options.className || "").trim().replace(/[^A-Za-z0-9_-]+/g, " ").trim();
    const classes = ["inline-value-list", extraClass].filter(Boolean).join(" ");
    const content = items.map((value, index) => `${index ? `<span class="inline-separator" aria-hidden="true">${escapeHtml(separator)}</span>` : ""}${String(value)}`).join("");
    return `<span class="${classes}">${content}</span>`;
  }

  function richText(key, params = {}, language = getLanguage()) {
    const normalized = normalizeLanguage(language) || "en";
    const template = dictionaries[normalized][key] ?? dictionaries.en[key] ?? key;
    const tokens = String(template).split(/(\{[A-Za-z0-9_]+\})/g);
    return tokens.map(token => {
      const match = /^\{([A-Za-z0-9_]+)\}$/.exec(token);
      if (!match) return escapeHtml(token);
      return Object.prototype.hasOwnProperty.call(params, match[1]) ? String(params[match[1]] ?? "") : escapeHtml(token);
    }).join("");
  }

  function supportingTextHtml(key, params = {}, language = getLanguage()) {
    return `<span class="supporting-text" dir="auto">${richText(key, params, language)}</span>`;
  }

  function unit(key, value, options = {}, language = getLanguage()) {
    return measurementText(value, key, options, language);
  }

  function setDocumentLanguage(language = getLanguage()) {
    const normalized = normalizeLanguage(language) || "en";
    document.documentElement.lang = normalized;
    document.documentElement.dir = direction(normalized);
    return normalized;
  }

  function apply(root = document, language = getLanguage()) {
    const normalized = setDocumentLanguage(language);
    root.querySelectorAll?.("[data-i18n]").forEach(element => {
      element.textContent = t(element.dataset.i18n, {}, normalized);
    });
    root.querySelectorAll?.("[data-i18n-html]").forEach(element => {
      element.innerHTML = t(element.dataset.i18nHtml, {}, normalized);
    });
    root.querySelectorAll?.("[data-i18n-title]").forEach(element => {
      element.title = t(element.dataset.i18nTitle, {}, normalized);
    });
    root.querySelectorAll?.("[data-i18n-placeholder]").forEach(element => {
      element.placeholder = t(element.dataset.i18nPlaceholder, {}, normalized);
    });
    root.querySelectorAll?.("[data-i18n-aria-label]").forEach(element => {
      element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel, {}, normalized));
    });
    root.querySelectorAll?.("[data-i18n-document-title]").forEach(element => {
      document.title = t(element.dataset.i18nDocumentTitle, {}, normalized);
    });
    document.documentElement.classList.remove("nc-i18n-pending");
    document.documentElement.classList.add("nc-i18n-ready");
    return normalized;
  }

  function listen(callback) {
    const handler = event => callback(normalizeLanguage(event.detail?.language) || getLanguage(), event);
    window.addEventListener("nc-nesting:languagechange", handler);
    return () => window.removeEventListener("nc-nesting:languagechange", handler);
  }

  document.documentElement.classList.add("nc-i18n-pending");
  const initialLanguage = setDocumentLanguage(storedLanguage() || document.documentElement.lang || "en");
  const earlyTitleKey = document.documentElement.getAttribute("data-i18n-document-title");
  if (earlyTitleKey) document.title = t(earlyTitleKey, {}, initialLanguage);

  window.NCNestingI18n = Object.freeze({
    STORAGE_KEY,
    dictionaries,
    normalizeLanguage,
    getLanguage,
    direction,
    locale,
    t,
    isolate,
    formatNumber,
    formatDate,
    formatDateTime,
    formatCurrency,
    currencyCode,
    currencySymbol,
    currencyLabel,
    priceParts,
    priceText,
    priceHtml,
    measurementParts,
    measurementText,
    measurementHtml,
    createMeasurement,
    quantityText,
    quantityHtml,
    inlineNumberHtml,
    inlineValuesHtml,
    richText,
    supportingTextHtml,
    unit,
    setDocumentLanguage,
    apply,
    listen
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => apply(), { once: true });
  else apply();
})();
