# Deprecations

This document tracks deprecated API endpoints and features in the Convexa platform.

## Deprecated Routes

Currently, no routes are marked as deprecated. Future deprecations will be documented here.

## Deprecation Policy

When deprecating routes:

1. **Deprecation Header**: All deprecated routes emit a `Deprecation` header following RFC 8594
2. **Logging**: Deprecation usage is logged once per process startup to avoid log spam
3. **Timeline**: Deprecated routes are supported for at least 6 months after deprecation
4. **Documentation**: Clear migration paths are provided for all deprecated endpoints

## Header Format

Deprecated routes include the following header:
```
Deprecation: Wed, 01 Jan 2025 00:00:00 GMT
Sunset: Wed, 01 Jul 2025 00:00:00 GMT
Link: <https://docs.convexa.ai/migrations/route-name>; rel="successor-version"
```

## Migration Process

1. **Announce**: Deprecation announced in release notes and API documentation
2. **Header**: `Deprecation` header added to responses
3. **Grace Period**: 6-month minimum support period
4. **Sunset**: Route removal with `410 Gone` responses
5. **Cleanup**: Route and related code removal

## Future Considerations

- Consider versioning strategy for major API changes
- Implement automated deprecation notices in client SDKs
- Add monitoring for deprecated route usage

---
*Last updated: 2025-09-24*