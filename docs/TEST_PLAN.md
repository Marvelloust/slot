# Slot Test Plan

## Startup
- [ ] `npm start`
- [ ] `http://localhost:4180`
- [ ] Sep 12 board loads
- [ ] seven resources appear
- [ ] seeded bookings and maintenance appear

## Resource board
- [ ] Previous/next day work
- [ ] Date picker works
- [ ] Bookings position correctly on timeline
- [ ] Maintenance blocks use different visual treatment
- [ ] Buffer zones are visible
- [ ] Utilization updates by date
- [ ] Clicking a block shows allocation details

## Booking composer
- [ ] title required
- [ ] organizer editable
- [ ] date/start/end selectable
- [ ] resources multi-select
- [ ] empty resource bundle is blocked
- [ ] end before start is blocked
- [ ] bookings outside operating day are blocked

## Conflict detection
- [ ] Request Sep 12 13:00–17:00
- [ ] Select Studio A + Camera Kit 1 + Lighting Kit
- [ ] Camera Kit 1 conflict appears
- [ ] Busy time is shown
- [ ] Buffered busy window is shown

## Suggestions
- [ ] Same-time replacement is proposed when possible
- [ ] Shifted-time options appear
- [ ] Nearby-day option appears where appropriate
- [ ] Applying a suggestion updates date/time/resources
- [ ] Recheck reports bundle available

## Commit
- [ ] Confirm clean booking
- [ ] Booking appears on every selected resource lane
- [ ] Audit item is created
- [ ] Utilization updates

## Atomic stale-option protection
- [ ] Find or create a clean bundle
- [ ] Use `/api/dev/competing` or the UI simulation to place another hold
- [ ] Attempt to commit the stale bundle
- [ ] API returns 409
- [ ] Fresh conflicts and suggestions are returned
- [ ] No double booking is persisted

## Cancellation
- [ ] Open confirmed booking
- [ ] Cancel it
- [ ] Blocks disappear from all resource lanes
- [ ] Audit event is added

## Reset
- [ ] Activity → Reset demo
- [ ] seeded schedule returns
