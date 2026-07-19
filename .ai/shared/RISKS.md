# Risks

1. **Production access replacement:** previously disclosed production access must be replaced outside chat before public paid launch.
2. **Email proof:** one approved production delivery must record a successful provider result before transactional delivery is called proven.
3. **Payment lifecycle proof:** the authenticated checkout → signed update → persisted entitlement → unlock → cancel → relock sequence remains unproven.
4. **Legal boundary:** the owner approved the launch baseline, but qualified legal review remains required.
5. **Payload boundary:** structured request bodies remain capped at 1 MiB; large files use signed direct-to-storage uploads.
6. **Preview/Production isolation:** Preview and Production configuration are separate. A Preview `Missing` card is not a production outage. Use an isolated non-production backend for Preview testing and redeploy after configuration changes.
7. **Readiness compatibility:** the JSON endpoint intentionally retains compatibility aliases. Human pages must use a canonical display list or duplicate and contradictory labels can return.
8. **Billing legacy data:** older billing rows without proven organization ownership remain ineligible for organization-scoped paid access.
9. **Index effectiveness:** reviewed indexes are active, but production benefit should be checked later against real workload telemetry.
10. **Membership compatibility:** do not remove compatibility fallbacks or add new constraints without live inventory and cross-tenant tests.
11. **Browser evidence:** PWA install, update, offline behavior, accessibility depth, and private-route behavior still need a reproducible browser harness.
12. **Physical-device boundary:** haptics consent is regression-tested, but physical vibration hardware is not production-verified.
13. **OpenAPI schema depth:** several heterogeneous payloads remain generic and should be tightened without runtime-shape changes.
14. **Service-worker asset coupling:** cached asset changes must synchronize worker version, rendered query tokens, manifest expectations, and tests.
15. **Unrelated local work:** previously recorded untracked operator files must remain untouched and uncommitted.
16. **Execution-environment evidence:** missing mounts, unavailable models, quota limits, or terminated commands must not be classified as application failures without reproducible repository or deployment evidence.
