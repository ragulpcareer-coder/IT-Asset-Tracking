# Interactive Test Charter

## Goal
Validate end-to-end user flows with realistic operator behavior and role switching.

## Scenarios
1. First-user bootstrap
- Register first user
- Confirm role becomes Super Admin
- Verify login and dashboard load

2. Standard user onboarding
- Register non-admin user
- Approve from admin route
- Verify restricted route access

3. Asset lifecycle
- Create asset
- Edit asset
- Assign asset
- Close lifecycle and verify audit log entries

4. Security behavior
- Trigger failed login lockout
- Validate 2FA prompt and verification
- Confirm unauthorized admin route returns 403/redirect

## Evidence to capture
- API responses with timestamps
- Browser screenshots for each major state
- Audit log rows for each mutation
- Database snapshots before/after critical flows

