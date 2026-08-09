# Finance Module Security & Validation Fixes

This document outlines the 7 issues identified in the Finance module and how they were resolved.

## 1. Exception Handling (FM-BUG-002)
- **Issue:** Foreign key reference failures caused a `500 Internal Server Error`.
- **Fix:** Added a specific handler for `sqlalchemy.exc.IntegrityError` in `app/middleware/exception_handler.py`.
- **Result:** Foreign key violations and database constraint failures now safely return a clean `422 Unprocessable Entity` response.

## 2. Authorization & Middleware Ordering (FM-BUG-001, FM-BUG-006)
- **BOLA Fix (FM-BUG-001):** Added `_role: str = Depends(require_roles("finance"))` to all 5 invoice READ endpoints (`GET /invoices`, `GET /invoices/{id}`, `GET /invoices/{id}/items`, `GET /invoices/{id}/payments`, `GET /invoices/{id}/pdf`) to prevent standard clients from reading other users' invoices.
- **Middleware Ordering (FM-BUG-006):** Shifted the execution order of `get_current_user` by moving it to the `APIRouter` dependencies array for the entire Finance router.
- **Result:** The authentication dependency now consistently runs *before* any route-specific ORM code executes (like `get_invoice_service`). Missing tokens now correctly return `401 Unauthorized` instead of crashing with `500`.

## 3. Business Logic Validation (FM-BUG-003, FM-BUG-005)
- **Advance Invoices (FM-BUG-003):** Updated `create_advance_invoice_for_lead` in `app/modules/finance/service.py` to check for existing advances using `get_advance_for_lead(lead_id)`.
  - *Result:* Attempting to create a duplicate advance invoice for the same lead now returns a `409 Conflict` (via `DuplicateException`).
- **Payment Verification (FM-BUG-005):** Updated `finance_verify` in `app/modules/finance/service.py` to check that `payment.status == PAYMENT_STATUS_SUBMITTED`.
  - *Result:* Attempting to verify a payment that has already been verified or rejected now correctly throws a `400 Bad Request`.

## 4. Input Validation & Schemas (FM-BUG-007)
- **Invoice Number Limit:** Reduced the `max_length` of `invoice_number` from 100 to 99 in `InvoiceBase` and `InvoiceUpdate`.
- **Negative Expenses:** Added `gt=0` constraint to `amount` in `ExpenseBase` and `ExpenseUpdate`.
- **Result:** The schema validation will now natively reject negative expenses and invoice numbers that are 100 characters long with a `422 Unprocessable Entity`.

## 5. Rate Limiting (FM-BUG-004)
- **Exponential Backoff:** Added an `exponential_backoff` flag to `RateLimitRule` in `app/middleware/rate_limiter.py`. The rate limiter now uses a penalty counter to double the wait time (`Retry-After`) on consecutive limit hits.
- **Finance Limits:** Added a new rule specifically for `/api/v1/finance` with a strict limit of 10 requests per minute and exponential backoff enabled.
- **Per-Account Enforcement:** Modified `RateLimiterMiddleware` to perform dual-tier enforcement. If the request carries an `Authorization` header, it extracts the `user_id` and tracks hits per-IP *and* per-account independently.

## Validation
All code changes apply directly to the identified weaknesses in the application. You can confirm these fixes by rerunning your automated tests (e.g., `pytest app/tests`).
