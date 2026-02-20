# Fix for Anonymous User Calculation

## Problem
Dashboard shows "Anonymous: 0" even though there are 8 devices in analytics.

## Root Cause
The current code compares:
- `sessions.user_uid` (Google UID)
- `analytics.device_id` (Device ID)

These are different identifiers, so the comparison fails.

## Solution
The `sessions` table ALSO has `device_id`, so we can properly compare:

```typescript
// CURRENT (WRONG):
const anonymous24h = new Set(
  analytics
    .filter(e => isAfter(new Date(e.created_at), twentyFourHoursAgo))
    .map(e => e.device_id)
).size;

// FIXED (CORRECT):
// Get all device_ids that have signed in (from sessions)
const signedInDeviceIds = new Set(
  sessions
    .filter(s => s.device_id) // sessions with device_id
    .map(s => s.device_id)
);

// Get device_ids from analytics that are NOT in sessions
const anonymous24h = new Set(
  analytics
    .filter(e => isAfter(new Date(e.created_at), twentyFourHoursAgo))
    .filter(e => !signedInDeviceIds.has(e.device_id)) // NOT signed in
    .map(e => e.device_id)
).size;

// Also fix signed24h to use device_ids instead of user_uids
const signed24h = new Set(
  sessions
    .filter(s => s.device_id && s.last_activity && isAfter(new Date(s.last_activity), twentyFourHoursAgo))
    .map(s => s.device_id)
).size;
```

## Apply the Fix

1. Open `/Users/cryptobulla/.gemini/antigravity/scratch/nexus-dashboard/src/App.tsx`
2. Find line ~390 (the anonymous24h calculation)
3. Replace with the fixed code above
4. Commit and redeploy
