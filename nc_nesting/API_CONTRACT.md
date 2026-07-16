# Azure Function contract

## Request

`POST` the complete batch to the URL in `scripts/config.js`. One Solve click sends one request containing every nesting group.

```json
{
  "schemaVersion": "1.0",
  "requestId": "demo-request-001",
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
      "steelGrade": "S355",
      "partRequirements": [
        {
          "partId": "HEA140-Column",
          "length": 4200,
          "quantity": 3
        },
        {
          "partId": "HEA140-Brace",
          "length": 1650,
          "quantity": 5
        },
        {
          "partId": "HEA140-Cap",
          "length": 700,
          "quantity": 4
        }
      ],
      "stockOrders": [
        {
          "stockOrderId": "Stock-A",
          "length": 6000,
          "availableQuantity": 3,
          "price": 105
        },
        {
          "stockOrderId": "Stock-B",
          "length": 12000,
          "availableQuantity": null,
          "price": 195
        }
      ],
      "storageStock": [
        {
          "groupedStorageStockId": "StorageStock:4300",
          "length": 4300,
          "quantity": 1
        }
      ]
    },
    {
      "groupId": "group-2",
      "profileName": "HEB240",
      "steelGrade": "S275",
      "partRequirements": [
        {
          "partId": "HEB240-Rafter",
          "length": 3200,
          "quantity": 2
        },
        {
          "partId": "HEB240-Plate",
          "length": 900,
          "quantity": 4
        }
      ],
      "stockOrders": [
        {
          "stockOrderId": "Stock-C",
          "length": 7500,
          "availableQuantity": 4,
          "price": 148
        }
      ],
      "storageStock": [
        {
          "groupedStorageStockId": "StorageStock:3500",
          "length": 3500,
          "quantity": 1
        }
      ]
    },
    {
      "groupId": "group-3",
      "profileName": "RHS 100x50x5",
      "steelGrade": "S275",
      "partRequirements": [
        {
          "partId": "RHS-S275-Stiffener",
          "length": 1100,
          "quantity": 6
        },
        {
          "partId": "RHS-S275-Tie",
          "length": 750,
          "quantity": 4
        }
      ],
      "stockOrders": [
        {
          "stockOrderId": "Stock-E",
          "length": 7500,
          "availableQuantity": null,
          "price": 96
        }
      ],
      "storageStock": []
    },
    {
      "groupId": "group-4",
      "profileName": "RHS 100x50x5",
      "steelGrade": "S355",
      "partRequirements": [
        {
          "partId": "RHS-S355-Post",
          "length": 2300,
          "quantity": 4
        },
        {
          "partId": "RHS-S355-Rail",
          "length": 1450,
          "quantity": 3
        }
      ],
      "stockOrders": [
        {
          "stockOrderId": "Stock-D",
          "length": 6000,
          "availableQuantity": 3,
          "price": 78
        },
        {
          "stockOrderId": "Stock-E",
          "length": 7500,
          "availableQuantity": null,
          "price": 96
        }
      ],
      "storageStock": [
        {
          "groupedStorageStockId": "StorageStock:3100",
          "length": 3100,
          "quantity": 2
        }
      ]
    }
  ]
}
```

`availableQuantity: null` means unlimited stock-order availability. `price` remains in the request even though the current solver may not use it.

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
  "batchResult": {
    "status": "Completed",
    "batchId": "batch-123",
    "generatedAt": "2026-07-14T10:00:10Z",
    "currency": "Israeli New Shekel",
    "groups": []
  },
  "plans": {
    "group-1": {
      "groupId": "group-1",
      "status": "Optimal",
      "profileName": "HEA140",
      "steelGrade": "S355",
      "settings": {},
      "requestedParts": [],
      "stockOrderOptions": [],
      "stockPieces": [
        {
          "pieceNumber": 1,
          "stockLength": 4300,
          "segments": [
            { "type": "StartTrim", "length": 20 },
            { "type": "ToolCut", "length": 3 },
            { "type": "Part", "partId": "HEA140-Column", "length": 4200 },
            { "type": "ToolCut", "length": 3 },
            { "type": "NonReusableOffcut", "length": 51 },
            { "type": "ToolCut", "length": 3 },
            { "type": "EndTrim", "length": 20 }
          ]
        }
      ],
      "storageRetrievals": [
        {
          "storageStockId": "Storage-A",
          "quantity": 1,
          "stockLength": 4300,
          "utilizationPercentage": 97.7,
          "wasteLength": 100
        }
      ],
      "totals": {}
    }
  }
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
