# Azure Function contract

## Request

`POST` the complete batch to the URL in `scripts/config.js`. One Solve click sends one request containing every nesting group.

```json
{
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
}
```

`availableQuantity: null` means unlimited stock-order availability. Every stock order includes `price`: a positive whole-number JSON value, or `null` when the optional input is blank.

The request deliberately excludes frontend-only data, including part sources, imported filenames, display metadata, storage-selection audits, storage source records, individual storage IDs, warehouse areas, locations, retrieval data, and repeated storage profile/grade values. The browser keeps those values in the persisted active project and matches them to results using stable IDs.

Storage selection works as follows:

1. Profile and steel grade must match the nesting group.
2. A storage length must fit at least one requested part including start and end trim.
3. Compatible records with the same length are combined.
4. Individual source records and storage areas remain in browser project state; only the grouped ID, length, and quantity are sent.

The complete generated demo request is in `examples/demo-solve-request.json`.

## Successful response

Return the summary and all plans in the same response:

```json
{
  "succeeded": true,
  "schemaVersion": "1.0",
  "requestId": "request-123",
  "batchId": "batch-123",
  "currency": "Israeli New Shekel",
  "batchResult": [
    {
      "groupId": "group-1",
      "profileName": "HEA140",
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
      "lengthSubgroups": []
    }
  ],
  "plans": [
    {
      "groupId": "group-1",
      "profileName": "HEA140",
      "steelGrade": "S235",
      "status": "Optimal",
      "cuttingSettings": {
        "toolWidth": 3,
        "trimStart": 20,
        "trimEnd": 20,
        "reusableMinimumLength": 1250
      },
      "requestedParts": [],
      "selectedStockOrders": [],
      "selectedGroupedStorageStock": [],
      "stockPieces": [
        {
          "pieceNumber": 1,
          "stockSource": "StockOrder",
          "stockOrderId": "Order-A",
          "groupedStorageStockId": null,
          "stockLength": 6000,
          "segments": []
        }
      ],
      "totals": {}
    }
  ]
}
```

The backend should return stable solver IDs such as `groupId`, `partId`, `stockOrderId`/`stockTypeId`, and `groupedStorageStockId`. It is not expected to echo frontend-only fields or individual warehouse records.

Each stock piece must provide its complete `segments` sequence. The frontend does not add missing tool cuts. Supported segment types are `StartTrim`, `ToolCut`, `Part`, `ReusableOffcut`, `NonReusableOffcut`, and `EndTrim`. Part lengths exclude tool width.

Storage retrieval summaries should supply `utilizationPercentage` and `wasteLength`. The frontend displays `wasteLength` directly and does not estimate it from the rendered bar.

For naming migration, the cutting-plan renderer still accepts legacy stock-order properties `regularStockOptions`, `RegularStock`, `totalRegularStockLengthOrdered`, and `regularStockPieceCount`, but all visible UI wording is **stock order**.

## Failed response

Use a non-2xx HTTP status or `succeeded: false`:

```json
{
  "succeeded": false,
  "errors": [
    {
      "profileName": "HEA140",
      "steelGrade": "S355",
      "category": "Infeasible",
      "message": "No feasible cutting plan was found."
    }
  ]
}
```
