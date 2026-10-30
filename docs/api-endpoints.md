# API Request Endpoints

Requests used in the Bruno collection (`bruno/`). Use them to call and test the Tubo API.

## Setup

| Variable | Value (Dev environment) | Notes |
|---|---|---|
| `baseUrl` | `http://localhost:4000` | API base URL |
| `token` | JWT from the login request | Sent as `Authorization: Bearer {{token}}` |

Run the login request first, then copy the returned token into the `token` variable.

## Endpoints

| # | Name | Method | Path | Auth |
|---|---|---|---|---|
| 1 | Login User A | `POST` | `/api/auth/login` | None |
| 2 | Create Valid Invoice | `POST` | `/api/invoices` | Bearer |
| 3 | Test Duplicate Detection | `POST` | `/api/invoices` | Bearer |
| 4 | Test Math Validation Guardrail | `POST` | `/api/invoices` | Bearer |
| 5 | List Invoices with Pagination | `GET` | `/api/invoices` | Bearer |
| 6 | Get Invoice By ID | `GET` | `/api/invoices/:id` | Bearer |
| 7 | Test Retry Guardrail | `POST` | `/api/invoices/:id/retry` | Bearer |
| 8 | [1] Test Tenant Isolation | `POST` | `/api/auth/login` | None |
| 9 | [2] Test Tenant Isolation | `GET` | `/api/invoices` | Bearer |

---

### 1. Login User A

`POST {{baseUrl}}/api/auth/login`

Logs in as `userA@alpha.com`. Returns the JWT used by the other requests.

```json
{
  "email": "userA@alpha.com",
  "password": "password123"
}
```

### 2. Create Valid Invoice

`POST {{baseUrl}}/api/invoices`

Creates invoice `INV-1001`. Line totals are consistent: `quantity × unitPrice + tax = lineTotal`.

```json
{
  "invoiceNumber": "INV-1001",
  "invoiceDate": "2026-10-30T00:00:00.000Z",
  "customerName": "Acme Global",
  "customerTaxId": "TIN-999-888",
  "customerEmail": "billing@acmeglobal.com",
  "currency": "USD",
  "items": [
    { "description": "Cloud Architecture Consulting", "quantity": 2, "unitPrice": 500.00, "tax": 100.00, "lineTotal": 1100.00 },
    { "description": "Database Optimization", "quantity": 1, "unitPrice": 400.00, "tax": 40.00, "lineTotal": 440.00 }
  ]
}
```

### 3. Test Duplicate Detection

`POST {{baseUrl}}/api/invoices`

Sends the same body as request 2 (`INV-1001`) again. The API should reject it as a duplicate invoice number for the company.

### 4. Test Math Validation Guardrail

`POST {{baseUrl}}/api/invoices`

Invoice `INV-1002` with a tampered line total. `2 × 100 + 20 = 220`, but `lineTotal` is `500`. The API should reject the invoice.

```json
{
  "invoiceNumber": "INV-1002",
  "invoiceDate": "2026-10-30T00:00:00.000Z",
  "customerName": "Acme Global",
  "customerTaxId": "TIN-999-888",
  "customerEmail": "billing@acmeglobal.com",
  "currency": "USD",
  "items": [
    { "description": "Tampered Line Item", "quantity": 2, "unitPrice": 100.00, "tax": 20.00, "lineTotal": 500.00 }
  ]
}
```

### 5. List Invoices with Pagination

`GET {{baseUrl}}/api/invoices?page=1&limit=10&status=FAILED`

| Query | Value | Description |
|---|---|---|
| `page` | `1` | Page number |
| `limit` | `10` | Items per page |
| `status` | `FAILED` | Filter by invoice status |

### 6. Get Invoice By ID

`GET {{baseUrl}}/api/invoices/<INVOICE-ID>`

Replace `<INVOICE-ID>` with an invoice ID from a create or list response.

### 7. Test Retry Guardrail

`POST {{baseUrl}}/api/invoices/<INVOICE-ID>/retry`

Requests a retry for an invoice. Replace `<INVOICE-ID>` with an invoice ID. The API should reject retries for invoices that are not eligible.

### 8. [1] Test Tenant Isolation

`POST {{baseUrl}}/api/auth/login`

Logs in as `userB@beta.com`, a user in a different company. Save the returned token as `token` before running request 9.

```json
{
  "email": "userB@beta.com",
  "password": "password123"
}
```

### 9. [2] Test Tenant Isolation

`GET {{baseUrl}}/api/invoices`

Lists invoices using User B's token. The result should not include invoices created by User A's company.

---

## Test Flow

1. Run **1** to log in as User A and set `token`.
2. Run **2** to create `INV-1001`.
3. Run **3** to confirm duplicates are rejected.
4. Run **4** to confirm the math check rejects the tampered invoice.
5. Run **5** and **6** to list and fetch invoices.
6. Run **7** on a failed invoice to confirm retry rules.
7. Run **8** then **9** to confirm User B cannot see User A's invoices.
