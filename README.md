# Slot — Resource Scheduling Without the Usual Calendar App

> **How to test this portfolio project:** Download or clone the complete folder and run it locally. Slot uses a Node constraint solver and atomic booking API, so GitHub Pages alone will not run the full system.

## Run

Requirements: **Node.js 18+**

```bash
npm start
```

Open:

```text
http://localhost:4180
```

No `npm install` and no build step are required.

## Test

```bash
npm test
npm run check
```

---

## What Slot is

Slot is a resource scheduler for a creative studio.

It schedules **bundles of scarce resources**, not just people:

- Studio A
- Studio B
- Camera Kit 1
- Camera Kit 2
- Lighting Kit
- Editing Room
- Audio Kit

A booking might require:

```text
Studio A
+ Camera Kit 1
+ Lighting Kit
Sep 12 · 1:00–5:00 PM
```

If any resource is unavailable, the entire bundle is unavailable.

The core product is only three concepts:

1. **Resource board**
2. **Booking composer**
3. **Conflict resolution**

## Constraint logic

### Resource-level overlap

The backend checks every requested resource independently.

### Turnaround buffers

Availability includes setup/turnaround time.

For example:

```text
Camera Kit 1
booking: 14:00–15:00
buffer: 15 min before / 15 min after
blocked window: 13:45–15:15
```

A request starting at 13:50 therefore conflicts even though the visible booking begins at 14:00.

### Maintenance blocks

Maintenance is treated as a hard resource constraint.

Seeded example:

```text
Camera Kit 1
Product tabletop pickup
14:00–15:00
```

### Alternative solver

When a request conflicts, Slot searches for:

1. same-time resource substitutions inside the same resource group
2. earlier/later times preserving booking duration
3. the same time on nearby days

Suggestions are scored so minimal disruption tends to appear first.

Example:

```text
Requested:
Studio A
Camera Kit 1
Lighting Kit
13:00–17:00

Conflict:
Camera Kit 1 unavailable

Possible suggestion:
Camera Kit 1 → Camera Kit 2
same date
same time
```

or:

```text
Shift entire bundle later by 90 minutes
```

### Atomic booking recheck

A suggestion is not a reservation.

When the user clicks **Confirm booking**, the server runs the conflict solver again immediately before writing the booking.

If another team has taken one of those resources in the meantime, the API returns:

```text
409 Conflict
```

with a fresh conflict list and new suggestions.

This prevents a stale frontend recommendation from creating a double booking.

## Portfolio race-condition demo

1. Open New booking.
2. Request:
   - Studio A
   - Camera Kit 1
   - Lighting Kit
   - Sep 12
   - 13:00–17:00
3. Click **Check constraints**.
4. Review the Camera Kit conflict.
5. Review suggested alternatives.
6. Apply a clean alternative such as Camera Kit 2.
7. Click **Simulate stale option**.
8. Slot creates a competing backend hold but deliberately leaves the old recommendation on screen.
9. Click **Confirm booking**.
10. The server performs its atomic recheck, returns `409 Conflict`, and supplies fresh alternatives.
11. Choose a new clean option and confirm it.

This demonstrates that resource scheduling is not just CRUD.

## Visual direction

Slot intentionally avoids the look of Calendly, Google Calendar, or another SaaS dashboard.

The UI is based on:
- studio call sheets
- production planning boards
- architectural grids
- equipment checkout schedules

Design traits:
- large horizontal time ruler
- persistent resource lanes
- strong black structural borders
- off-white drafting-paper background
- orange confirmed work
- cobalt maintenance blocks
- visible turnaround buffers
- compact operational typography

## Architecture

```text
Resource board
       │
       ▼
Booking composer
       │
       ▼
Availability API
├── resource overlap
├── buffers
├── maintenance
└── bundle validation
       │
       ├── available → confirm
       │
       └── conflict
              │
              ▼
        suggestion solver
        ├── substitute resource
        ├── shift time
        └── nearby day
              │
              ▼
        atomic confirm recheck
```

## Seeded conflict

On Sep 12:

```text
Camera Kit 1
Product tabletop pickup
14:00–15:00
```

Requesting Camera Kit 1 from 13:00–17:00 therefore produces the intended conflict.

See:
- `docs/PORTFOLIO_CASE_STUDY.md`
- `docs/TEST_PLAN.md`
