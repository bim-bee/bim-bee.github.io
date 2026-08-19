# Azure Function contract

## Request

`POST` the solve batch to the URL in `scripts/config.js`. One Solve click still produces one backend optimization request. Incremental solving sends only groups that currently require backend work: changed/uncached problems, matching-fingerprint `GreedyOnly` groups, and selected matching-fingerprint `BestKnown` groups whose previous optimization was incomplete and whose new backend workload is materially lighter.

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

Each group may also include an optional frontend-generated `greedyBaseline`. It is a complete feasible seed expressed with the same stable part and stock identities used by the optimization problem:

```json
{
  "groupId": "group-1",
  "greedyBaseline": {
    "groupId": "group-1",
    "algorithmVersion": "greedy-bfd-v2",
    "objective": {
      "orderedStockQuantity": 21,
      "totalStockLengthConsumed": 208700,
      "reusableOffcutLength": 1500,
      "reusableOffcutCount": 1
    },
    "layouts": [
      {
        "stockSource": "StockOrder",
        "stockOrderId": "Order-C",
        "quantity": 4,
        "partCounts": {
          "HEA-S235-BRACE": 1,
          "HEA-S235-BEAM#2": 2
        }
      },
      {
        "stockSource": "StorageStock",
        "groupedStorageStockId": "StorageStock:3700",
        "quantity": 1,
        "partCounts": {
          "HEA-S235-COLUMN#2": 1
        }
      }
    ]
  }
}
```

The baseline is optional and untrusted. The backend must resolve every referenced part and stock option, validate exact demand, capacity, trim/tool-width arithmetic, finite availability, and canonical layout identity before using it. Frontend greedy capacity uses the same transformed geometry as the backend: each item is `PartLength + ToolWidth`, and stock capacity is `StockLength - TrimStart - TrimEnd + ToolWidth`, which is equivalent to fitting only `(N - 1)` internal kerfs. An invalid or absent baseline must not redefine the nesting problem or prevent the backend from solving it normally. A valid complete baseline may be added to the backend layout/column pool and used as an incumbent or upper bound.

The greedy baseline is not part of the optimization-problem fingerprint. The frontend uses a separate greedy algorithm/cache version when heuristic changes require cached baselines to be refreshed. Result quality/source is also separate from the fingerprint: a matching-fingerprint frontend-local `GreedyOnly` result is still sent to the backend on the next Solve, matching `Optimal` results are reused, and matching `BestKnown` results are normally reused but may be selected for another backend attempt when their previous optimization remains unresolved and the estimated backend-request pressure is materially lower.

The request deliberately excludes frontend-only data, including part sources, imported filenames, display metadata, storage-selection audits, storage source records, individual storage IDs, warehouse areas, locations, retrieval data, repeated storage profile/grade values, cache retry disposition, and solve-context metadata. The browser keeps those values in the persisted active project and matches them to results using stable IDs.

## Frontend incremental cache and `BestKnown` retry policy

The group fingerprint describes only the canonical optimization problem: profile, grade, parts, stock orders, grouped storage stock, and cutting settings. Solver status, proof state, prior solve time, batch complexity, and retry history are not fingerprint inputs.

For a structurally valid matching-fingerprint group cache entry, the frontend applies a separate disposition policy:

- `Optimal` → reuse.
- `GreedyOnly` → send to the backend.
- `BestKnown` → reuse by default, but it may be sent again when full lexicographic optimality remains unresolved, the prior stop condition is compatible with receiving more solver effort, and the estimated workload of the new backend request is materially lower than the workload that produced the cached result.

The frontend persists a local per-group `solveContext` with the existing group cache. It records the actual backend-requested group count, combined frontend complexity cost/pressure, reliability, per-group complexity summary, and available backend optimization stop/progress metadata. This context is cache/scheduling metadata only and is not sent as a retry flag. A selected retry is simply included as a normal group in the same `/solve` request with the same canonical problem and, when available, its cached greedy baseline.

Retry selection is deterministic and incremental. Changed/uncached and `GreedyOnly` groups form the mandatory backend workload first. Candidate `BestKnown` groups are then considered against that workload, with unresolved primary-objective gaps favored before weaker later-objective opportunities. As candidates are added, their complexity is included in the proposed request pressure so the browser does not recreate the same overloaded batch by blindly retrying every `BestKnown` group.

After any backend attempt, the cache entry is replaced with the returned plan, proof metadata, unchanged problem fingerprint, greedy baseline, and the new solve context. This update occurs even when the result remains the same `BestKnown`, so an immediate identical Solve does not repeatedly retry under the same workload. Older cache entries without solve context remain reusable; missing historical metadata alone does not force a retry.

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
      "status": "Optimal",
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

Each solved group should also expose authoritative optimization metadata. The canonical frontend contract is:

```json
{
  "optimization": {
    "status": "Optimal",
    "bestFeasibleObjective": {
      "orderedStockQuantity": 20,
      "totalStockLengthConsumed": 202700,
      "reusableOffcutLength": 0,
      "reusableOffcutCount": 0
    },
    "bestProvenBound": {
      "orderedStockQuantity": 20,
      "totalStockLengthConsumed": 202700,
      "reusableOffcutLength": 0,
      "reusableOffcutCount": 0
    },
    "provenOptimum": {
      "orderedStockQuantity": 20,
      "totalStockLengthConsumed": 202700,
      "reusableOffcutLength": 0,
      "reusableOffcutCount": 0
    }
  }
}
```

`status` uses `Optimal`, `BestKnown`, or `Failed`. `Optimal` may be reported only when the backend has mathematically proven optimality. `BestKnown` means a complete feasible plan was returned without full proof. Both `Optimal` and `BestKnown` are normal successful backend solve statuses. Reaching the backend calculation deadline with a valid incumbent must therefore return `BestKnown`, not a frontend-visible timeout failure. `bestProvenBound` is solver proof information, not a value inferred by the browser. When proof is complete, `provenOptimum` may be returned explicitly; otherwise the frontend treats the authoritative feasible plan and proven bound as separate concepts.

Where available, the backend may also return `stopReason`, `provenObjectiveCount` (0–4), and/or `objectiveProgress` inside `optimization`. The frontend preserves these fields as authoritative optimization-progress metadata. Temporary budget/deadline reasons can support a later context-based `BestKnown` retry; hard representation/safety limitations do not become retryable merely because another batch is lighter.

The objective vector is lexicographic in this order: minimize ordered stock quantity, minimize total stock length consumed, maximize reusable offcut length, then minimize reusable offcut count. The backend result remains authoritative for the actual cutting plan, feasibility, bounds, and proof status. The backend does not need to echo the frontend greedy baseline; the browser persists its own canonical copy by `groupId`.

## Backend deadline and frontend transport safeguard

The backend owns the normal calculation deadline. It validates incumbents, optimizes within its batch budget, reserves time for finalization, and returns a complete HTTP response containing `Optimal` and/or `BestKnown` groups.

The frontend request timeout is deliberately longer than the backend's expected response window. It is currently configured as a 150-second safety timeout and exists only for abnormal transport/infrastructure cases such as a stuck connection or a backend that stops responding. It is not a second optimizer deadline and must not turn a healthy backend `BestKnown` result into an error.

HTTP/application error responses remain backend errors. They are not classified as an unreachable calculation service merely because the HTTP status is 4xx/5xx. The frontend preserves meaningful structured backend errors where available.

## Frontend-local greedy fallback

`GreedyOnly` is a frontend-owned local result status. It is **not** a backend optimization status and must not be returned by the backend contract.

If no usable backend response is received because of a genuine network/unreachable failure or the abnormal frontend safety timeout, the frontend may offer an explicit **Continue with greedy solution** choice, but only when every backend-required group already has a complete valid local greedy baseline. The frontend never chooses this fallback automatically.

When accepted, the browser materializes the canonical greedy layouts into the existing solved-batch and physical cutting-plan structures and stores the affected groups as `GreedyOnly`. Cached unchanged `Optimal`/`BestKnown` groups remain unchanged, so one persisted batch may contain mixed result sources.

A `GreedyOnly` result carries no backend validation, proven bound, proven optimum, or optimizer-improvement claim. On a future Solve it remains backend-required even when the optimization-problem fingerprint is unchanged.

Each stock piece must provide its complete additive `segments` sequence. Supported segment types are `StartTrim`, `ToolCut`, `Part`, `ReusableOffcut`, `NonReusableOffcut`, and `EndTrim`. Part lengths exclude tool width. The corrected sequence is `StartTrim -> Part -> [ToolCut -> Part]... -> terminal ToolCut -> Offcut -> EndTrim`; there is no extra start-boundary or end-boundary tool-cut segment on top of the trims. Internal cuts are full tool width. The terminal tool-cut segment is `min(ToolWidth, RawRemainder)`, and the reported offcut is the resulting net offcut `max(0, RawRemainder - ToolWidth)`. `actualConsumedLength` is `StockLength - NetOffcut`.

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
