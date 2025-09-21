# Guardrails Snapshot Documentation

This document explains the fields found in the `guardrails_state_<ts>.json` snapshot files and how to interpret them. These snapshots provide insight into the operational state of the system's guardrails, particularly concerning API usage and circuit breaker status.

## Snapshot Fields

*   **`status`**: Indicates the overall status of the guardrails snapshot.
    *   `"available"`: The guardrails state was successfully fetched from the running backend server.
    *   `"unavailable"`: The backend server was not reachable on the specified `port`, so the guardrails state could not be fetched. This is an expected fallback behavior when the server is offline.
*   **`port`**: The port number on which the backend server was expected to be running when the snapshot was attempted.
*   **`error`**: If `status` is `"unavailable"`, this field will contain the error message encountered when trying to connect to the backend server.
*   **`timestamp`**: The ISO 8601 formatted timestamp indicating when the snapshot was taken.
*   **`breakerState`**: (Only present if `status` is `"available"`) Describes the current state of the circuit breaker.
    *   `"OPEN"`: The circuit is open, meaning requests to the protected service are currently being blocked to prevent further overload or errors. This state is typically entered after a high error rate is detected.
    *   `"HALF_OPEN"`: The circuit is half-open, meaning a limited number of trial requests are allowed to pass through to the protected service. If these trial requests succeed, the circuit may transition to `CLOSED`; otherwise, it will revert to `OPEN`.
    *   `"CLOSED"`: The circuit is closed, meaning requests are flowing normally to the protected service. This is the default operational state.
*   **`budgetCapUsd`**: (Only present if `status` is `"available"`) The configured daily budget cap in USD for API spending.
*   **`budgetSpentUsd`**: (Only present if `status` is `"available"`) The amount of budget spent in USD so far for the current day.
*   **`tokenBucket`**: (Only present if `status` is `"available"`) Provides details about the rate limiting token bucket.
    *   `capacity`: The maximum number of tokens the bucket can hold (e.g., maximum requests per second).
    *   `tokens`: The current number of available tokens in the bucket.
    *   `lastRefill`: The timestamp of the last time the token bucket was refilled.
    *   `refillRate`: The rate at which tokens are added back to the bucket (e.g., tokens per second).

## Interpretation

The guardrails snapshot helps in understanding the system's health and resource management.

*   **Circuit Breaker (`breakerState`)**:
    *   A `CLOSED` state is ideal, indicating normal operation.
    *   An `OPEN` state suggests that the system has detected issues with an upstream service (e.g., a third-party API) and has temporarily stopped sending requests to it. This prevents cascading failures and allows the service to recover.
    *   A `HALF_OPEN` state is a recovery attempt. Monitoring this state is crucial to see if the service is stabilizing or if the circuit needs to remain `OPEN`.
*   **Budget (`budgetCapUsd`, `budgetSpentUsd`)**: These fields allow tracking of API expenditure against a predefined daily limit. A `budgetSpentUsd` close to or exceeding `budgetCapUsd` indicates that the system is nearing or has hit its spending limit, which might trigger rate limiting or service degradation.
*   **Token Bucket (`tokenBucket`)**: This mechanism controls the rate of requests to prevent exceeding API limits. Monitoring `tokens` relative to `capacity` and `refillRate` can help identify if the system is being throttled or if the rate limits are being effectively managed.

By reviewing these fields, operators and QA personnel can quickly assess the system's stability, cost control, and adherence to API usage policies.
