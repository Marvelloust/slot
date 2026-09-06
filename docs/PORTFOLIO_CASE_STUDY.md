# Slot — Portfolio Case Study

## Problem

Most scheduling products assume the scarce thing is a person's time.

Studios, labs, workshops, clinics, production teams and equipment businesses have a different problem: a single job may require **several independent resources at the same time**.

A shoot may need:
- a room
- a camera package
- lighting
- audio

One conflict invalidates the whole bundle.

## Product decision

Slot centers the interface on a resource board rather than a meeting calendar.

Each horizontal lane is an independently bookable asset.

The user builds a bundle and asks the system for a valid allocation.

## Constraint model

Availability includes:
- booking overlap
- maintenance
- operational day boundaries
- resource-specific setup buffer
- resource-specific turnaround buffer

The suggestion solver then tries to minimize disruption.

Priority:
1. preserve requested date/time and substitute equivalent gear
2. preserve all resources and shift time
3. preserve requested time on a nearby day

## Race-condition protection

The most important backend behavior is the second availability check at commit time.

```text
check availability
→ show suggestion
→ time passes
→ another booking happens
→ user confirms old suggestion
→ server checks again
→ 409 instead of double-booking
```

## Suggested portfolio caption

> Slot is a constraint-based resource scheduler for studios and equipment teams. I built resource bundles, setup/turnaround buffers, maintenance blocks, overlap detection, ranked alternative generation, utilization metrics, and an atomic server-side recheck that prevents stale recommendations from creating double bookings.
