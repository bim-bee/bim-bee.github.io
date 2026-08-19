(function () {
  "use strict";

  const input = {
  "cuttingSettings": {
    "toolWidth": 3,
    "trimStart": 20,
    "trimEnd": 20,
    "reusableMinimumLength": 1250
  },
  "currency": "Israeli New Shekel",
  "autoFillOrders": true,
  "parts": [
    {
      "positionId": "HEA-S235-COLUMN#1",
      "profileName": "HEA140",
      "steelGrade": "S235",
      "quantity": 8,
      "length": 7300,
      "source": "Demo data"
    },
    {
      "positionId": "HEA-S235-BRACE",
      "profileName": "HEA140",
      "steelGrade": "S235",
      "quantity": 12,
      "length": 2800,
      "source": "Demo data"
    },
    {
      "positionId": "HEA-S235-BEAM#1",
      "profileName": "HEA140",
      "steelGrade": "S235",
      "quantity": 10,
      "length": 1450,
      "source": "Demo data"
    },
    {
      "positionId": "HEA-S235-COLUMN#2",
      "profileName": "HEA140",
      "steelGrade": "S235",
      "quantity": 5,
      "length": 3650,
      "source": "Demo data"
    },
    {
      "positionId": "HEA-S235-KNEE",
      "profileName": "HEA140",
      "steelGrade": "S235",
      "quantity": 22,
      "length": 1800,
      "source": "Demo data"
    },
    {
      "positionId": "HEA-S235-BEAM#2",
      "profileName": "HEA140",
      "steelGrade": "S235",
      "quantity": 8,
      "length": 4450,
      "source": "Demo data"
    },
    {
      "positionId": "HEB-S355-MAIN",
      "profileName": "HEB240",
      "steelGrade": "S355",
      "quantity": 2,
      "length": 3600,
      "source": "Demo data"
    },
    {
      "positionId": "HEB-S355-BRACE",
      "profileName": "HEB240",
      "steelGrade": "S355",
      "quantity": 4,
      "length": 1850,
      "source": "Demo data"
    },
    {
      "positionId": "HEB-S355-CLEAT",
      "profileName": "HEB240",
      "steelGrade": "S355",
      "quantity": 3,
      "length": 2400,
      "source": "Demo data"
    },
    {
      "positionId": "RHS-S235-POST",
      "profileName": "RHS 100x50x5",
      "steelGrade": "S235",
      "quantity": 2,
      "length": 2900,
      "source": "Demo data"
    },
    {
      "positionId": "RHS-S235-RAIL",
      "profileName": "RHS 100x50x5",
      "steelGrade": "S235",
      "quantity": 3,
      "length": 1950,
      "source": "Demo data"
    },
    {
      "positionId": "RHS-S235-GUSSET",
      "profileName": "RHS 100x50x5",
      "steelGrade": "S235",
      "quantity": 4,
      "length": 1450,
      "source": "Demo data"
    }
  ],
  "stockOrders": [
    {
      "generatedId": "Order-A",
      "stockOrderId": "Order-A",
      "profileName": "HEA140",
      "steelGrade": "S235",
      "length": 6000,
      "availableQuantity": null,
      "price": 1350
    },
    {
      "generatedId": "Order-B",
      "stockOrderId": "Order-B",
      "profileName": "HEA140",
      "steelGrade": "S235",
      "length": 7500,
      "availableQuantity": 2,
      "price": 1420
    },
    {
      "generatedId": "Order-C",
      "stockOrderId": "Order-C",
      "profileName": "HEA140",
      "steelGrade": "S235",
      "length": 12000,
      "availableQuantity": null,
      "price": 2740
    },
    {
      "generatedId": "Order-D",
      "stockOrderId": "Order-D",
      "profileName": "HEB240",
      "steelGrade": "S355",
      "length": 7500,
      "availableQuantity": 3,
      "price": 3650
    },
    {
      "generatedId": "Order-E",
      "stockOrderId": "Order-E",
      "profileName": "RHS 100x50x5",
      "steelGrade": "S235",
      "length": 12000,
      "availableQuantity": null,
      "price": 1120
    },
    {
      "generatedId": "Order-F",
      "stockOrderId": "Order-F",
      "profileName": "RHS 100x50x5",
      "steelGrade": "S235",
      "length": 6000,
      "availableQuantity": null,
      "price": 930
    }
  ],
  "storageStock": [
    {
      "generatedId": "Storage-A",
      "storageStockId": "Storage-A",
      "profileName": "HEA140",
      "steelGrade": "S235",
      "length": 3700,
      "quantity": 1,
      "storageArea": ""
    },
    {
      "generatedId": "Storage-B",
      "storageStockId": "Storage-B",
      "profileName": "HEA140",
      "steelGrade": "S235",
      "length": 2000,
      "quantity": 2,
      "storageArea": ""
    },
    {
      "generatedId": "Storage-C",
      "storageStockId": "Storage-C",
      "profileName": "HEB240",
      "steelGrade": "S355",
      "length": 2450,
      "quantity": 1,
      "storageArea": ""
    },
    {
      "generatedId": "Storage-D",
      "storageStockId": "Storage-D",
      "profileName": "HEB240",
      "steelGrade": "S355",
      "length": 1900,
      "quantity": 1,
      "storageArea": ""
    },
    {
      "generatedId": "Storage-E",
      "storageStockId": "Storage-E",
      "profileName": "RHS 100x50x5",
      "steelGrade": "S235",
      "length": 3000,
      "quantity": 2,
      "storageArea": ""
    },
    {
      "generatedId": "Storage-F",
      "storageStockId": "Storage-F",
      "profileName": "RHS 100x50x5",
      "steelGrade": "S235",
      "length": 2050,
      "quantity": 1,
      "storageArea": ""
    }
  ],
  "groupIds": {
    "HEA140\u0000S235": "group-1",
    "HEB240\u0000S355": "group-2",
    "RHS 100X50X5\u0000S235": "group-3"
  },
  "nextIds": {
    "stockOrders": 7,
    "storage": 7,
    "groups": 4
  }
};
  const request = {
  "schemaVersion": "1.0",
  "requestId": "6b964f13-1862-49ee-865f-21b378fcf637",
  "currency": "Israeli New Shekel",
  "cuttingSettings": {
    "toolWidth": 3,
    "trimStart": 20,
    "trimEnd": 20,
    "reusableMinimumLength": 1250
  },
  "groups": [
    {
      "groupId": "group-1",
      "profileName": "HEA140",
      "steelGrade": "S235",
      "partRequirements": [
        {
          "partId": "HEA-S235-COLUMN#1",
          "length": 7300,
          "quantity": 8
        },
        {
          "partId": "HEA-S235-BRACE",
          "length": 2800,
          "quantity": 12
        },
        {
          "partId": "HEA-S235-BEAM#1",
          "length": 1450,
          "quantity": 10
        },
        {
          "partId": "HEA-S235-COLUMN#2",
          "length": 3650,
          "quantity": 5
        },
        {
          "partId": "HEA-S235-KNEE",
          "length": 1800,
          "quantity": 22
        },
        {
          "partId": "HEA-S235-BEAM#2",
          "length": 4450,
          "quantity": 8
        }
      ],
      "stockOrders": [
        {
          "stockOrderId": "Order-A",
          "length": 6000,
          "availableQuantity": null,
          "price": 1350
        },
        {
          "stockOrderId": "Order-B",
          "length": 7500,
          "availableQuantity": 2,
          "price": 1420
        },
        {
          "stockOrderId": "Order-C",
          "length": 12000,
          "availableQuantity": null,
          "price": 2740
        }
      ],
      "storageStock": [
        {
          "groupedStorageStockId": "StorageStock:3700",
          "length": 3700,
          "quantity": 1
        },
        {
          "groupedStorageStockId": "StorageStock:2000",
          "length": 2000,
          "quantity": 2
        }
      ]
    },
    {
      "groupId": "group-2",
      "profileName": "HEB240",
      "steelGrade": "S355",
      "partRequirements": [
        {
          "partId": "HEB-S355-MAIN",
          "length": 3600,
          "quantity": 2
        },
        {
          "partId": "HEB-S355-BRACE",
          "length": 1850,
          "quantity": 4
        },
        {
          "partId": "HEB-S355-CLEAT",
          "length": 2400,
          "quantity": 3
        }
      ],
      "stockOrders": [
        {
          "stockOrderId": "Order-D",
          "length": 7500,
          "availableQuantity": 3,
          "price": 3650
        }
      ],
      "storageStock": [
        {
          "groupedStorageStockId": "StorageStock:2450",
          "length": 2450,
          "quantity": 1
        },
        {
          "groupedStorageStockId": "StorageStock:1900",
          "length": 1900,
          "quantity": 1
        }
      ]
    },
    {
      "groupId": "group-3",
      "profileName": "RHS 100x50x5",
      "steelGrade": "S235",
      "partRequirements": [
        {
          "partId": "RHS-S235-POST",
          "length": 2900,
          "quantity": 2
        },
        {
          "partId": "RHS-S235-RAIL",
          "length": 1950,
          "quantity": 3
        },
        {
          "partId": "RHS-S235-GUSSET",
          "length": 1450,
          "quantity": 4
        }
      ],
      "stockOrders": [
        {
          "stockOrderId": "Order-E",
          "length": 12000,
          "availableQuantity": null,
          "price": 1120
        },
        {
          "stockOrderId": "Order-F",
          "length": 6000,
          "availableQuantity": null,
          "price": 930
        }
      ],
      "storageStock": [
        {
          "groupedStorageStockId": "StorageStock:3000",
          "length": 3000,
          "quantity": 2
        },
        {
          "groupedStorageStockId": "StorageStock:2050",
          "length": 2050,
          "quantity": 1
        }
      ]
    }
  ]
};
  const response = {
  "succeeded": true,
  "schemaVersion": "1.0",
  "requestId": "4e51b362-4780-436d-9707-23953318c9d6",
  "batchId": "4e51b362-4780-436d-9707-23953318c9d6",
  "currency": "Israeli New Shekel",
  "batchResult": [
    {
      "groupId": "group-1",
      "profileName": "HEA140",
      "profileKeilogramPerMeter": 24.6,
      "steelGrade": "S235",
      "status": "Succeeded",
      "totalStockLength": 202700,
      "actualConsumedLength": 201203,
      "totalOffcutLength": 1497,
      "storageStockLengthConsumed": 7700,
      "reusableOffcutLength": 0,
      "storageStockQuantityUsed": 3,
      "stockOrderQuantity": 20,
      "stockOrderCost": 43820,
      "lengthSubgroups": [
        {
          "stockLength": 2000,
          "status": "Succeeded",
          "totalStockLength": 4000,
          "actualConsumedLength": 3698,
          "totalOffcutLength": 302,
          "storageStockLengthConsumed": 4000,
          "reusableOffcutLength": 0,
          "storageStockQuantityUsed": 2,
          "stockOrderQuantityRequired": 0,
          "stockOrderCost": 0
        },
        {
          "stockLength": 3700,
          "status": "Succeeded",
          "totalStockLength": 3700,
          "actualConsumedLength": 3699,
          "totalOffcutLength": 1,
          "storageStockLengthConsumed": 3700,
          "reusableOffcutLength": 0,
          "storageStockQuantityUsed": 1,
          "stockOrderQuantityRequired": 0,
          "stockOrderCost": 0
        },
        {
          "stockLength": 6000,
          "status": "Succeeded",
          "totalStockLength": 36000,
          "actualConsumedLength": 35712,
          "totalOffcutLength": 288,
          "storageStockLengthConsumed": 0,
          "reusableOffcutLength": 0,
          "storageStockQuantityUsed": 0,
          "stockOrderQuantityRequired": 6,
          "stockOrderCost": 8100,
          "stockOrderId": "Order-A",
          "unitPrice": 1350
        },
        {
          "stockLength": 7500,
          "status": "Succeeded",
          "totalStockLength": 15000,
          "actualConsumedLength": 14604,
          "totalOffcutLength": 396,
          "storageStockLengthConsumed": 0,
          "reusableOffcutLength": 0,
          "storageStockQuantityUsed": 0,
          "stockOrderQuantityRequired": 2,
          "stockOrderCost": 2840,
          "stockOrderId": "Order-B",
          "unitPrice": 1420,
          "availableQuantity": 2
        },
        {
          "stockLength": 12000,
          "status": "Succeeded",
          "totalStockLength": 144000,
          "actualConsumedLength": 143490,
          "totalOffcutLength": 510,
          "storageStockLengthConsumed": 0,
          "reusableOffcutLength": 0,
          "storageStockQuantityUsed": 0,
          "stockOrderQuantityRequired": 12,
          "stockOrderCost": 32880,
          "stockOrderId": "Order-C",
          "unitPrice": 2740
        }
      ]
    },
    {
      "groupId": "group-2",
      "profileName": "HEB240",
      "profileKeilogramPerMeter": 83.2,
      "steelGrade": "S355",
      "status": "Succeeded",
      "totalStockLength": 22500,
      "actualConsumedLength": 21965,
      "totalOffcutLength": 535,
      "storageStockLengthConsumed": 0,
      "reusableOffcutLength": 0,
      "storageStockQuantityUsed": 0,
      "stockOrderQuantity": 3,
      "stockOrderCost": 10950,
      "lengthSubgroups": [
        {
          "stockLength": 7500,
          "status": "Succeeded",
          "totalStockLength": 22500,
          "actualConsumedLength": 21965,
          "totalOffcutLength": 535,
          "storageStockLengthConsumed": 0,
          "reusableOffcutLength": 0,
          "storageStockQuantityUsed": 0,
          "stockOrderQuantityRequired": 3,
          "stockOrderCost": 10950,
          "stockOrderId": "Order-D",
          "unitPrice": 3650,
          "availableQuantity": 3
        }
      ]
    },
    {
      "groupId": "group-3",
      "profileName": "RHS 100x50x5",
      "profileKeilogramPerMeter": null,
      "steelGrade": "S235",
      "status": "Succeeded",
      "totalStockLength": 18000,
      "actualConsumedLength": 17615,
      "totalOffcutLength": 385,
      "storageStockLengthConsumed": 6000,
      "reusableOffcutLength": 0,
      "storageStockQuantityUsed": 2,
      "stockOrderQuantity": 1,
      "stockOrderCost": 1120,
      "lengthSubgroups": [
        {
          "stockLength": 3000,
          "status": "Succeeded",
          "totalStockLength": 6000,
          "actualConsumedLength": 5904,
          "totalOffcutLength": 96,
          "storageStockLengthConsumed": 6000,
          "reusableOffcutLength": 0,
          "storageStockQuantityUsed": 2,
          "stockOrderQuantityRequired": 0,
          "stockOrderCost": 0
        },
        {
          "stockLength": 12000,
          "status": "Succeeded",
          "totalStockLength": 12000,
          "actualConsumedLength": 11711,
          "totalOffcutLength": 289,
          "storageStockLengthConsumed": 0,
          "reusableOffcutLength": 0,
          "storageStockQuantityUsed": 0,
          "stockOrderQuantityRequired": 1,
          "stockOrderCost": 1120,
          "stockOrderId": "Order-E",
          "unitPrice": 1120
        }
      ]
    }
  ],
  "plans": [
    {
      "groupId": "group-1",
      "profileName": "HEA140",
      "profileKeilogramPerMeter": 24.6,
      "steelGrade": "S235",
      "status": "Optimal",
      "cuttingSettings": {
        "toolWidth": 3,
        "trimStart": 20,
        "trimEnd": 20,
        "reusableMinimumLength": 1250
      },
      "requestedParts": [
        {
          "partId": "HEA-S235-COLUMN#1",
          "length": 7300,
          "quantity": 8
        },
        {
          "partId": "HEA-S235-BRACE",
          "length": 2800,
          "quantity": 12
        },
        {
          "partId": "HEA-S235-BEAM#1",
          "length": 1450,
          "quantity": 10
        },
        {
          "partId": "HEA-S235-COLUMN#2",
          "length": 3650,
          "quantity": 5
        },
        {
          "partId": "HEA-S235-KNEE",
          "length": 1800,
          "quantity": 22
        },
        {
          "partId": "HEA-S235-BEAM#2",
          "length": 4450,
          "quantity": 8
        }
      ],
      "selectedStockOrders": [
        {
          "stockOrderId": "Order-A",
          "length": 6000,
          "availableQuantity": null,
          "selectedQuantity": 6,
          "selectedTotalLength": 36000,
          "unitPrice": 1350,
          "totalCost": 8100,
          "finishedPartLength": 35400,
          "offcutLength": 288
        },
        {
          "stockOrderId": "Order-B",
          "length": 7500,
          "availableQuantity": 2,
          "selectedQuantity": 2,
          "selectedTotalLength": 15000,
          "unitPrice": 1420,
          "totalCost": 2840,
          "finishedPartLength": 14500,
          "offcutLength": 396
        },
        {
          "stockOrderId": "Order-C",
          "length": 12000,
          "availableQuantity": null,
          "selectedQuantity": 12,
          "selectedTotalLength": 144000,
          "unitPrice": 2740,
          "totalCost": 32880,
          "finishedPartLength": 142800,
          "offcutLength": 510
        }
      ],
      "selectedGroupedStorageStock": [
        {
          "groupedStorageStockId": "StorageStock:2000",
          "length": 2000,
          "selectedQuantity": 2,
          "selectedTotalLength": 4000,
          "finishedPartLength": 3600,
          "offcutLength": 302
        },
        {
          "groupedStorageStockId": "StorageStock:3700",
          "length": 3700,
          "selectedQuantity": 1,
          "selectedTotalLength": 3700,
          "finishedPartLength": 3650,
          "offcutLength": 1
        }
      ],
      "stockPieces": [
        {
          "pieceNumber": 1,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-A",
          "groupedStorageStockId": null,
          "stockLength": 6000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1450,
              "partId": "HEA-S235-BEAM#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 4450,
              "partId": "HEA-S235-BEAM#2"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 48
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 6000,
            "finishedPartLength": 5900,
            "toolCutLength": 12,
            "trimLength": 40,
            "actualConsumedLength": 5952,
            "offcutLength": 48
          }
        },
        {
          "pieceNumber": 2,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-A",
          "groupedStorageStockId": null,
          "stockLength": 6000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1450,
              "partId": "HEA-S235-BEAM#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 4450,
              "partId": "HEA-S235-BEAM#2"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 48
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 6000,
            "finishedPartLength": 5900,
            "toolCutLength": 12,
            "trimLength": 40,
            "actualConsumedLength": 5952,
            "offcutLength": 48
          }
        },
        {
          "pieceNumber": 3,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-A",
          "groupedStorageStockId": null,
          "stockLength": 6000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1450,
              "partId": "HEA-S235-BEAM#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 4450,
              "partId": "HEA-S235-BEAM#2"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 48
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 6000,
            "finishedPartLength": 5900,
            "toolCutLength": 12,
            "trimLength": 40,
            "actualConsumedLength": 5952,
            "offcutLength": 48
          }
        },
        {
          "pieceNumber": 4,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-A",
          "groupedStorageStockId": null,
          "stockLength": 6000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1450,
              "partId": "HEA-S235-BEAM#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 4450,
              "partId": "HEA-S235-BEAM#2"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 48
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 6000,
            "finishedPartLength": 5900,
            "toolCutLength": 12,
            "trimLength": 40,
            "actualConsumedLength": 5952,
            "offcutLength": 48
          }
        },
        {
          "pieceNumber": 5,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-A",
          "groupedStorageStockId": null,
          "stockLength": 6000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1450,
              "partId": "HEA-S235-BEAM#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 4450,
              "partId": "HEA-S235-BEAM#2"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 48
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 6000,
            "finishedPartLength": 5900,
            "toolCutLength": 12,
            "trimLength": 40,
            "actualConsumedLength": 5952,
            "offcutLength": 48
          }
        },
        {
          "pieceNumber": 6,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-A",
          "groupedStorageStockId": null,
          "stockLength": 6000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1450,
              "partId": "HEA-S235-BEAM#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 4450,
              "partId": "HEA-S235-BEAM#2"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 48
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 6000,
            "finishedPartLength": 5900,
            "toolCutLength": 12,
            "trimLength": 40,
            "actualConsumedLength": 5952,
            "offcutLength": 48
          }
        },
        {
          "pieceNumber": 7,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-B",
          "groupedStorageStockId": null,
          "stockLength": 7500,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2800,
              "partId": "HEA-S235-BRACE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 4450,
              "partId": "HEA-S235-BEAM#2"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 198
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 7500,
            "finishedPartLength": 7250,
            "toolCutLength": 12,
            "trimLength": 40,
            "actualConsumedLength": 7302,
            "offcutLength": 198
          }
        },
        {
          "pieceNumber": 8,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-B",
          "groupedStorageStockId": null,
          "stockLength": 7500,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2800,
              "partId": "HEA-S235-BRACE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 4450,
              "partId": "HEA-S235-BEAM#2"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 198
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 7500,
            "finishedPartLength": 7250,
            "toolCutLength": 12,
            "trimLength": 40,
            "actualConsumedLength": 7302,
            "offcutLength": 198
          }
        },
        {
          "pieceNumber": 9,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-C",
          "groupedStorageStockId": null,
          "stockLength": 12000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 7300,
              "partId": "HEA-S235-COLUMN#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2800,
              "partId": "HEA-S235-BRACE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 45
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 12000,
            "finishedPartLength": 11900,
            "toolCutLength": 15,
            "trimLength": 40,
            "actualConsumedLength": 11955,
            "offcutLength": 45
          }
        },
        {
          "pieceNumber": 10,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-C",
          "groupedStorageStockId": null,
          "stockLength": 12000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 7300,
              "partId": "HEA-S235-COLUMN#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2800,
              "partId": "HEA-S235-BRACE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 45
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 12000,
            "finishedPartLength": 11900,
            "toolCutLength": 15,
            "trimLength": 40,
            "actualConsumedLength": 11955,
            "offcutLength": 45
          }
        },
        {
          "pieceNumber": 11,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-C",
          "groupedStorageStockId": null,
          "stockLength": 12000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 7300,
              "partId": "HEA-S235-COLUMN#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2800,
              "partId": "HEA-S235-BRACE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 45
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 12000,
            "finishedPartLength": 11900,
            "toolCutLength": 15,
            "trimLength": 40,
            "actualConsumedLength": 11955,
            "offcutLength": 45
          }
        },
        {
          "pieceNumber": 12,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-C",
          "groupedStorageStockId": null,
          "stockLength": 12000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 7300,
              "partId": "HEA-S235-COLUMN#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2800,
              "partId": "HEA-S235-BRACE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 45
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 12000,
            "finishedPartLength": 11900,
            "toolCutLength": 15,
            "trimLength": 40,
            "actualConsumedLength": 11955,
            "offcutLength": 45
          }
        },
        {
          "pieceNumber": 13,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-C",
          "groupedStorageStockId": null,
          "stockLength": 12000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 7300,
              "partId": "HEA-S235-COLUMN#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2800,
              "partId": "HEA-S235-BRACE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 45
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 12000,
            "finishedPartLength": 11900,
            "toolCutLength": 15,
            "trimLength": 40,
            "actualConsumedLength": 11955,
            "offcutLength": 45
          }
        },
        {
          "pieceNumber": 14,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-C",
          "groupedStorageStockId": null,
          "stockLength": 12000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 7300,
              "partId": "HEA-S235-COLUMN#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2800,
              "partId": "HEA-S235-BRACE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 45
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 12000,
            "finishedPartLength": 11900,
            "toolCutLength": 15,
            "trimLength": 40,
            "actualConsumedLength": 11955,
            "offcutLength": 45
          }
        },
        {
          "pieceNumber": 15,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-C",
          "groupedStorageStockId": null,
          "stockLength": 12000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 7300,
              "partId": "HEA-S235-COLUMN#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2800,
              "partId": "HEA-S235-BRACE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 45
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 12000,
            "finishedPartLength": 11900,
            "toolCutLength": 15,
            "trimLength": 40,
            "actualConsumedLength": 11955,
            "offcutLength": 45
          }
        },
        {
          "pieceNumber": 16,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-C",
          "groupedStorageStockId": null,
          "stockLength": 12000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 7300,
              "partId": "HEA-S235-COLUMN#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2800,
              "partId": "HEA-S235-BRACE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 45
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 12000,
            "finishedPartLength": 11900,
            "toolCutLength": 15,
            "trimLength": 40,
            "actualConsumedLength": 11955,
            "offcutLength": 45
          }
        },
        {
          "pieceNumber": 17,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-C",
          "groupedStorageStockId": null,
          "stockLength": 12000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2800,
              "partId": "HEA-S235-BRACE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 3650,
              "partId": "HEA-S235-COLUMN#2"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 3650,
              "partId": "HEA-S235-COLUMN#2"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 42
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 12000,
            "finishedPartLength": 11900,
            "toolCutLength": 18,
            "trimLength": 40,
            "actualConsumedLength": 11958,
            "offcutLength": 42
          }
        },
        {
          "pieceNumber": 18,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-C",
          "groupedStorageStockId": null,
          "stockLength": 12000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2800,
              "partId": "HEA-S235-BRACE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 3650,
              "partId": "HEA-S235-COLUMN#2"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 3650,
              "partId": "HEA-S235-COLUMN#2"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 42
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 12000,
            "finishedPartLength": 11900,
            "toolCutLength": 18,
            "trimLength": 40,
            "actualConsumedLength": 11958,
            "offcutLength": 42
          }
        },
        {
          "pieceNumber": 19,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-C",
          "groupedStorageStockId": null,
          "stockLength": 12000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1450,
              "partId": "HEA-S235-BEAM#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1450,
              "partId": "HEA-S235-BEAM#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 33
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 12000,
            "finishedPartLength": 11900,
            "toolCutLength": 27,
            "trimLength": 40,
            "actualConsumedLength": 11967,
            "offcutLength": 33
          }
        },
        {
          "pieceNumber": 20,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-C",
          "groupedStorageStockId": null,
          "stockLength": 12000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1450,
              "partId": "HEA-S235-BEAM#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1450,
              "partId": "HEA-S235-BEAM#1"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 33
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 12000,
            "finishedPartLength": 11900,
            "toolCutLength": 27,
            "trimLength": 40,
            "actualConsumedLength": 11967,
            "offcutLength": 33
          }
        },
        {
          "pieceNumber": 21,
          "stockSource": "StorageStock",
          "stockOrderId": null,
          "groupedStorageStockId": "StorageStock:3700",
          "stockLength": 3700,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 3650,
              "partId": "HEA-S235-COLUMN#2"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 1
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 3700,
            "finishedPartLength": 3650,
            "toolCutLength": 9,
            "trimLength": 40,
            "actualConsumedLength": 3699,
            "offcutLength": 1
          }
        },
        {
          "pieceNumber": 22,
          "stockSource": "StorageStock",
          "stockOrderId": null,
          "groupedStorageStockId": "StorageStock:2000",
          "stockLength": 2000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 151
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 2000,
            "finishedPartLength": 1800,
            "toolCutLength": 9,
            "trimLength": 40,
            "actualConsumedLength": 1849,
            "offcutLength": 151
          }
        },
        {
          "pieceNumber": 23,
          "stockSource": "StorageStock",
          "stockOrderId": null,
          "groupedStorageStockId": "StorageStock:2000",
          "stockLength": 2000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1800,
              "partId": "HEA-S235-KNEE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 151
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 2000,
            "finishedPartLength": 1800,
            "toolCutLength": 9,
            "trimLength": 40,
            "actualConsumedLength": 1849,
            "offcutLength": 151
          }
        }
      ],
      "totals": {
        "totalStockLength": 202700,
        "actualConsumedLength": 201203,
        "totalOffcutLength": 1497,
        "reusableOffcutLength": 0,
        "nonReusableOffcutLength": 1497,
        "storageStockLengthConsumed": 7700,
        "storageStockQuantityUsed": 3,
        "stockOrderLength": 195000,
        "stockOrderQuantity": 20,
        "stockOrderCost": 43820
      }
    },
    {
      "groupId": "group-2",
      "profileName": "HEB240",
      "profileKeilogramPerMeter": 83.2,
      "steelGrade": "S355",
      "status": "Optimal",
      "cuttingSettings": {
        "toolWidth": 3,
        "trimStart": 20,
        "trimEnd": 20,
        "reusableMinimumLength": 1250
      },
      "requestedParts": [
        {
          "partId": "HEB-S355-MAIN",
          "length": 3600,
          "quantity": 2
        },
        {
          "partId": "HEB-S355-BRACE",
          "length": 1850,
          "quantity": 4
        },
        {
          "partId": "HEB-S355-CLEAT",
          "length": 2400,
          "quantity": 3
        }
      ],
      "selectedStockOrders": [
        {
          "stockOrderId": "Order-D",
          "length": 7500,
          "availableQuantity": 3,
          "selectedQuantity": 3,
          "selectedTotalLength": 22500,
          "unitPrice": 3650,
          "totalCost": 10950,
          "finishedPartLength": 21800,
          "offcutLength": 535
        }
      ],
      "selectedGroupedStorageStock": [],
      "stockPieces": [
        {
          "pieceNumber": 1,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-D",
          "groupedStorageStockId": null,
          "stockLength": 7500,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 3600,
              "partId": "HEB-S355-MAIN"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 3600,
              "partId": "HEB-S355-MAIN"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 248
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 7500,
            "finishedPartLength": 7200,
            "toolCutLength": 12,
            "trimLength": 40,
            "actualConsumedLength": 7252,
            "offcutLength": 248
          }
        },
        {
          "pieceNumber": 2,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-D",
          "groupedStorageStockId": null,
          "stockLength": 7500,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1850,
              "partId": "HEB-S355-BRACE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1850,
              "partId": "HEB-S355-BRACE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1850,
              "partId": "HEB-S355-BRACE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1850,
              "partId": "HEB-S355-BRACE"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 42
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 7500,
            "finishedPartLength": 7400,
            "toolCutLength": 18,
            "trimLength": 40,
            "actualConsumedLength": 7458,
            "offcutLength": 42
          }
        },
        {
          "pieceNumber": 3,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-D",
          "groupedStorageStockId": null,
          "stockLength": 7500,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2400,
              "partId": "HEB-S355-CLEAT"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2400,
              "partId": "HEB-S355-CLEAT"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2400,
              "partId": "HEB-S355-CLEAT"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 245
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 7500,
            "finishedPartLength": 7200,
            "toolCutLength": 15,
            "trimLength": 40,
            "actualConsumedLength": 7255,
            "offcutLength": 245
          }
        }
      ],
      "totals": {
        "totalStockLength": 22500,
        "actualConsumedLength": 21965,
        "totalOffcutLength": 535,
        "reusableOffcutLength": 0,
        "nonReusableOffcutLength": 535,
        "storageStockLengthConsumed": 0,
        "storageStockQuantityUsed": 0,
        "stockOrderLength": 22500,
        "stockOrderQuantity": 3,
        "stockOrderCost": 10950
      }
    },
    {
      "groupId": "group-3",
      "profileName": "RHS 100x50x5",
      "profileKeilogramPerMeter": null,
      "steelGrade": "S235",
      "status": "Optimal",
      "cuttingSettings": {
        "toolWidth": 3,
        "trimStart": 20,
        "trimEnd": 20,
        "reusableMinimumLength": 1250
      },
      "requestedParts": [
        {
          "partId": "RHS-S235-POST",
          "length": 2900,
          "quantity": 2
        },
        {
          "partId": "RHS-S235-RAIL",
          "length": 1950,
          "quantity": 3
        },
        {
          "partId": "RHS-S235-GUSSET",
          "length": 1450,
          "quantity": 4
        }
      ],
      "selectedStockOrders": [
        {
          "stockOrderId": "Order-E",
          "length": 12000,
          "availableQuantity": null,
          "selectedQuantity": 1,
          "selectedTotalLength": 12000,
          "unitPrice": 1120,
          "totalCost": 1120,
          "finishedPartLength": 11650,
          "offcutLength": 289
        }
      ],
      "selectedGroupedStorageStock": [
        {
          "groupedStorageStockId": "StorageStock:3000",
          "length": 3000,
          "selectedQuantity": 2,
          "selectedTotalLength": 6000,
          "finishedPartLength": 5800,
          "offcutLength": 96
        }
      ],
      "stockPieces": [
        {
          "pieceNumber": 1,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-E",
          "groupedStorageStockId": null,
          "stockLength": 12000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2900,
              "partId": "RHS-S235-POST"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 2900,
              "partId": "RHS-S235-POST"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1950,
              "partId": "RHS-S235-RAIL"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1950,
              "partId": "RHS-S235-RAIL"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1950,
              "partId": "RHS-S235-RAIL"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 289
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 12000,
            "finishedPartLength": 11650,
            "toolCutLength": 21,
            "trimLength": 40,
            "actualConsumedLength": 11711,
            "offcutLength": 289
          }
        },
        {
          "pieceNumber": 2,
          "stockSource": "StorageStock",
          "stockOrderId": null,
          "groupedStorageStockId": "StorageStock:3000",
          "stockLength": 3000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1450,
              "partId": "RHS-S235-GUSSET"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1450,
              "partId": "RHS-S235-GUSSET"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 48
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 3000,
            "finishedPartLength": 2900,
            "toolCutLength": 12,
            "trimLength": 40,
            "actualConsumedLength": 2952,
            "offcutLength": 48
          }
        },
        {
          "pieceNumber": 3,
          "stockSource": "StorageStock",
          "stockOrderId": null,
          "groupedStorageStockId": "StorageStock:3000",
          "stockLength": 3000,
          "segments": [
            {
              "type": "StartTrim",
              "length": 20
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1450,
              "partId": "RHS-S235-GUSSET"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "Part",
              "length": 1450,
              "partId": "RHS-S235-GUSSET"
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "NonReusableOffcut",
              "length": 48
            },
            {
              "type": "ToolCut",
              "length": 3
            },
            {
              "type": "EndTrim",
              "length": 20
            }
          ],
          "totals": {
            "stockLength": 3000,
            "finishedPartLength": 2900,
            "toolCutLength": 12,
            "trimLength": 40,
            "actualConsumedLength": 2952,
            "offcutLength": 48
          }
        }
      ],
      "totals": {
        "totalStockLength": 18000,
        "actualConsumedLength": 17615,
        "totalOffcutLength": 385,
        "reusableOffcutLength": 0,
        "nonReusableOffcutLength": 385,
        "storageStockLengthConsumed": 6000,
        "storageStockQuantityUsed": 2,
        "stockOrderLength": 12000,
        "stockOrderQuantity": 1,
        "stockOrderCost": 1120
      }
    }
  ]
};

  function clone(value) {
    return globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }

  function comparableRequest(value) {
    const copy = clone(value || {});
    delete copy.requestId;
    copy.groups = (copy.groups || []).map(group => ({
      ...group,
      partRequirements: [...(group.partRequirements || [])].sort((left, right) =>
        String(left.partId || "").localeCompare(String(right.partId || ""), undefined, { sensitivity: "base", numeric: true })
        || Number(left.length || 0) - Number(right.length || 0)
        || Number(left.quantity || 0) - Number(right.quantity || 0)
      )
    }));
    return canonicalize(copy);
  }

  function matchesRequest(value) {
    return JSON.stringify(comparableRequest(value)) === JSON.stringify(comparableRequest(request));
  }

  function createSolveResult(requestId) {
    const rawResponse = clone(response);
    rawResponse.batchId = `demo-batch-${window.NcNesting.createRequestId()}`;
    rawResponse.requestId = requestId || rawResponse.requestId;
    rawResponse.generatedAt = new Date().toISOString();
    const normalized = window.NcNesting.normalizeSolveResponse(rawResponse);
    if (!normalized.succeeded) throw new Error("The committed demo response could not be normalized.");
    normalized.isDemoResult = true;
    normalized.batchResult.isDemoResult = true;
    return normalized;
  }

  window.NcNestingDemo = Object.freeze({
    input: Object.freeze(input),
    request: Object.freeze(request),
    response: Object.freeze(response),
    matchesRequest,
    createSolveResult
  });
})();
