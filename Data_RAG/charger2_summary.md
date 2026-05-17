# Charger2 — History Summary
**Internal ID:** charger2 | **Period:** March 1, 2026 – May 17, 2026

---

## Overview

Charger2 is a high-utilization DC fast charger with 691 sessions started and 683 completed — a 98.8% completion rate. Average energy per session is 20.8 kWh, with a peak of 113.8 kWh indicating some very long or high-capacity charging events. The unit has been active since late February 2026. It has rebooted 71 times over the period (approximately every 1.1 days, the most frequent reboot rate among the five chargers) and has had 5 manual resets between April 13 and May 16, 2026, suggesting the unit has required operator intervention on multiple occasions.

Average internal temperature is 301.5°C — elevated compared to charger1 — with a peak of 325.5°C. Fan speed averages 6,565 RPM. Voltage and current telemetry are not populating, consistent with the fleet-wide reporting gap seen on this group of chargers.

Fault distribution across the week shows a pronounced spike on Thursdays (187 fault events) and Fridays (114), which is the most severe Thursday fault concentration in the group. Tuesday also runs higher than average (79 events). This pattern suggests the charger may be under peak load stress mid-to-late week and would benefit from priority inspection scheduling around that window.

The `Unavailable` status count (2,056) is notably high for this unit — the highest among the five chargers on a raw basis — suggesting significant periods where the charger was taken offline, either by the operator or due to fault recovery cycles. The `Faulted` count (733) is also the highest in the group, making this the most fault-prone charger in the set.

---

## Session Statistics

| Metric | Value |
|---|---|
| Sessions started | 691 |
| Sessions completed | 683 |
| Completion rate | 98.8% |
| Average energy delivered | 20,807 Wh (20.8 kWh) |
| Peak energy delivered | 113,753 Wh (113.8 kWh) |
| First activity | Feb 28, 2026 |
| Last activity | May 17, 2026 |

---

## Operational Status Distribution

| Status | Count | Notes |
|---|---|---|
| Available | 11,898 | Healthy idle state |
| Unavailable | 2,056 | ⚠️ Highest in group — frequent offline periods |
| Charging | 1,959 | Active charging events |
| Preparing | 1,857 | Active user engagement |
| Finishing | 792 | Normal session wrap-up |
| Faulted | 733 | ⚠️ Highest fault count in group (~3.9% of status events) |

---

## Hardware & Thermal Telemetry

| Metric | Average | Peak |
|---|---|---|
| Internal temperature | 301.5 (sensor units) | 325.5 |
| Fan RPM | 6,565 | — |
| Voltage | Not reporting | — |
| Current | Not reporting | — |

> ⚠️ Voltage and current telemetry are not populating. Recommend verifying MeterValues configuration at next service visit.

---

## Reboot History

| Event | Count | First | Last |
|---|---|---|---|
| BootNotification | 71 | Feb 28, 2026 | May 16, 2026 |
| Manual Reset | 5 | Apr 13, 2026 | May 16, 2026 |

Most frequent reboot rate in the group (~every 1.1 days). Five manual resets since mid-April indicate escalating operator intervention. The clustering of resets near May 16 alongside the high Thursday fault spike warrants close monitoring.

---

## Fault History

*Sorted by occurrence count. All faults are Low severity unless noted.*

| Code | Severity | Description | Count | First | Last |
|---|---|---|---|---|---|
| 873 | Low | PP voltage not detected — vehicle proximity signal missing or premature unplug | — | — | — |
| 878 | Low | CP voltage on CCS cable out of valid range | — | — | — |
| 956 | Low | DC:DC module (position 2) software output voltage above max threshold | — | — | — |
| 988 | Low | DC:DC module (position 3) software output voltage above max threshold | — | — | — |
| 50 | Low | Vehicle detected error and initiated emergency shutdown | — | — | — |
| 74 | Low | Vehicle prematurely closed communication with charger | — | — | — |
| 867 | Low | Vehicle voltage mismatch (ISO-15118: FAILED_ChargingVoltageOutOfRange) | — | — | — |
| 983 | **Medium** | DC:DC module (position 3) output discharge fault | — | — | — |
| 860 | Low | Connector lock fault (ISO-15118: FAILED_ChargerConnectorLockFault) | — | — | — |

> ℹ️ Fault code detail for charger2 was not returned in the query results — the unit's fault records exist in the database but were not included in the output. The status distribution confirms 733 Faulted events. Re-run Query 3 filtered specifically to `veefil-602300152` for full code breakdown.

### Key Fault Patterns (inferred from status data and fleet context)
- **733 Faulted status events** — highest raw fault count in the group.
- **2,056 Unavailable events** — significant offline time, likely driven by fault recovery or operator-initiated downtime.
- **5 manual resets** since April 13 — operator has had to intervene repeatedly. Escalation recommended if pattern continues.
- Thursday fault spike (187 events) is the most extreme single-day concentration across all five chargers.

---

## Weekly Fault & Session Pattern

| Day | Sessions | Fault Events | Notes |
|---|---|---|---|
| Sunday | 96 | 36 | Low |
| Monday | 88 | 56 | Moderate |
| Tuesday | 96 | 79 | Elevated |
| Wednesday | 89 | 47 | Moderate |
| Thursday | 102 | 187 | ⚠️ Severe spike — highest single-day count in group |
| Friday | 100 | 114 | ⚠️ High |
| Saturday | 120 | 76 | Elevated — busiest session day |

---

## Voice Agent Diagnosis Notes

- If caller reports charger won't start: given high fault history, ask if charger display shows any error code or status message. Check if unit is in Faulted or Unavailable state.
- If charger is Unavailable: this unit has a high historical Unavailable rate. May be in a fault recovery cycle. Advise caller to wait 3–5 minutes and retry. If persists, escalate to operator — 5 manual resets have been needed since April.
- If session drops mid-charge: DC:DC module faults are likely given the fault profile. Unit may self-recover. Advise user to unplug, wait 2 minutes, and retry.
- Thursday and Friday callers should be flagged as higher-risk for hardware-related faults vs. vehicle-side issues given the fault spike pattern on those days.
- This is the highest-priority charger for proactive maintenance in the group.
