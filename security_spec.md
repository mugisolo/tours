# Security Specification: Pearl of Africa Tourism Explorer

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every document in `/itineraries/{itineraryId}` and `/bookmarks/{bookmarkId}` MUST have `ownerId == request.auth.uid`. Only the verified owner can read, list, create, update, or delete their own documents.
2. **Verified Identity**: All writes (`create`, `update`, `delete`) require `request.auth != null && request.auth.token.email_verified == true`.
3. **Path ID Hardening**: All document IDs (`{itineraryId}`, `{bookmarkId}`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` characters.
4. **Volumetric & Schema Bounds**:
   - `TripItinerary`: Exact keys `['ownerId', 'title', 'stopIds', 'totalDistanceKm', 'daysCount', 'notes', 'createdAt', 'updatedAt']`. `title` length `1..120`, `notes` length `0..1000`, `stopIds` list size `1..25` with string item validation, `totalDistanceKm >= 0`, `daysCount >= 1 && daysCount <= 60`.
   - `UserBookmark`: Exact keys `['ownerId', 'attractionId', 'personalNote', 'visited', 'createdAt', 'updatedAt']`. `attractionId` regex `^[a-zA-Z0-9_\-]+$`, `personalNote` length `0..500`, `visited` boolean.
5. **Temporal & Immutable Integrity**: `createdAt == request.time` on create; `updatedAt == request.time` on create and update; `ownerId` and `createdAt` are strictly immutable on update.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Payload 1 (Identity Spoofing on Create)**: Authenticated user `uid_A` creates an itinerary with `ownerId: "uid_B"`. -> `PERMISSION_DENIED`
2. **Payload 2 (Unverified Email Write)**: User with `email_verified: false` attempts to create a valid itinerary. -> `PERMISSION_DENIED`
3. **Payload 3 (Shadow/Ghost Field Injection on Create)**: User creates an itinerary including `"isAdmin": true`. -> `PERMISSION_DENIED`
4. **Payload 4 (Shadow/Ghost Field Injection on Update)**: User updates an itinerary adding `"role": "admin"`. -> `PERMISSION_DENIED`
5. **Payload 5 (Owner Hijack on Update)**: User attempts to mutate `ownerId` during an update. -> `PERMISSION_DENIED`
6. **Payload 6 (Immortal Field Mutation)**: User attempts to change `createdAt` during an update. -> `PERMISSION_DENIED`
7. **Payload 7 (Client Timestamp Spoofing)**: User supplies a forged past/future timestamp instead of `request.time` for `updatedAt`. -> `PERMISSION_DENIED`
8. **Payload 8 (Denial-of-Wallet Oversized String)**: User submits a 5,000-character string in `title` or `notes`. -> `PERMISSION_DENIED`
9. **Payload 9 (Unbounded Array Injection)**: User submits 100 items in `stopIds` (exceeding max 25) or non-string first element. -> `PERMISSION_DENIED`
10. **Payload 10 (Path ID Poisoning)**: User targets `/itineraries/invalid id with spaces and $pecial!` on create. -> `PERMISSION_DENIED`
11. **Payload 11 (Cross-Tenant Read/Get)**: User `uid_A` attempts `get` on an itinerary owned by `uid_B`. -> `PERMISSION_DENIED`
12. **Payload 12 (Blanket Unfiltered List Query)**: User `uid_A` executes an unfiltered `list` query across `/itineraries` without `where('ownerId', '==', 'uid_A')`. -> `PERMISSION_DENIED`
