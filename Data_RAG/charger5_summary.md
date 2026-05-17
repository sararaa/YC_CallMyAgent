# Charger5 — History Summary
**Internal ID:** charger5 | **Period:** March 1, 2026 – May 17, 2026

---

## Overview

Charger5 is the highest-energy-per-session charger in the group with 397 sessions started and 399 completed — a boundary artifact placing the effective completion rate at ~100%. Despite having the fewest sessions of the five chargers, it delivers the highest average energy per session at 26.5 kWh, and holds the group's peak session record at 166.9 kWh — nearly 47% higher than the next highest peak. This profile suggests charger5 serves longer-dwell, higher-capacity vehicles, possibly at a location with extended parking availability.

This charger is also the most concerning from a hardware reliability standpoint. It has rebooted 113 times over the period — nearly twice the rate of the next most rebooted unit — averaging a reboot approximately every 0.75 days. It has had 6 manual resets between March and April 2026. This combination of high reboot frequency and manual operator intervention suggests a chronically unstable unit. The reboot rate alone is a strong indicator that this charger should be prioritized for hardware inspection or firmware review.

The fault picture is dominated by a severe and recent hardware event: codes 1308 (AC contactor fault, High severity, 54 occurrences) and 2434 (AC:DC module fault state, High severity, 39 occurrences) both appeared starting May 6, 2026 and are ongoing as of May 11. This represents an active, unresolved hardware failure affecting the AC power input system. The charger may currently be operating in a degraded or intermittently unavailable state.

Average internal temperature is 292.8°C — the lowest in the group — with a peak of 326.1°C. Fan speed averages 6,003 RPM. The low average temperature combined with the highest peak suggests the charger runs cool most of the time but experiences significant thermal excursions, potentially correlated with the AC:DC module fault events.

A physical security event was also recorded: the front door of the charger was opened on April 10, 2026 (codes 772 and 770 — door open and door sensor disagreement). This was a brief event (7 minutes) but should be noted as a potential unauthorized access or maintenance visit without a logged work order.

---

## Session Statistics

| Metric | Value |
|---|---|
| Sessions started | 397 |
| Sessions completed | 399 |
| Completion rate | ~100% (boundary artifact) |
| Average energy delivered | 26,547 Wh (26.5 kWh) — highest in group |
| Peak energy delivered | 166,995 Wh (167.0 kWh) — highest in group |
| First activity | Feb 28, 2026 |
| Last activity | May 17, 2026 |

---

## Operational Status Distribution

| Status | Count | Notes |
|---|---|---|
| Available | 3,619 | Lower than group average — reflects instability |
| Preparing | 2,093 | High relative to session count |
| Charging | 914 | Active charging |
| Finishing | 911 | Normal wrap-up |
| Unavailable | 869 | Moderate |
| Faulted | 276 | Lower raw count but concentrated in recent weeks |

---

## Hardware & Thermal Telemetry

| Metric | Average | Peak |
|---|---|---|
| Internal temperature | 292.8 (sensor units) | 326.1 |
| Fan RPM | 6,003 | — |
| Voltage | Not reporting | — |
| Current | Not reporting | — |

> ⚠️ Lowest average temperature in group (292.8) but highest peak (326.1) — wide thermal range suggests intermittent high-load events or cooling irregularities, potentially correlated with AC:DC module faults.
> ⚠️ Voltage and current telemetry not populating.

---

## Reboot History

| Event | Count | First | Last |
|---|---|---|---|
| BootNotification | 113 | Mar 1, 2026 | May 17, 2026 |
| Manual Reset | 6 | Mar 10, 2026 | Apr 3, 2026 |

**113 reboots** — nearly double the next most rebooted unit (charger2 at 71). Averaging a reboot every ~0.75 days across the observation period. Six manual resets were all concentrated in March–early April, suggesting an earlier instability period that may have been partially resolved before the new AC:DC fault cluster began in May.

---

## Fault History

*Sorted by occurrence count. All faults are Low severity unless noted.*

| Code | Severity | Description | Count | First | Last |
|---|---|---|---|---|---|
| 1308 | **High** | AC:DC module (position 1) AC contactor fault | 54 | May 6 | May 11 |
| 2434 | **High** | AC:DC module (position 1) entered fault state | 39 | May 6 | May 10 |
| 873 | Low | PP voltage not detected — proximity signal missing or premature unplug | 25 | Mar 11 | May 12 |
| 50 | Low | Vehicle detected error and initiated emergency shutdown | 20 | Feb 28 | May 16 |
| 988 | Low | DC:DC module (position 3) software output voltage above max threshold | 19 | Mar 13 | May 4 |
| 956 | Low | DC:DC module (position 2) software output voltage above max threshold | 11 | Mar 16 | May 2 |
| 63 | Low | Vehicle communication timed out before charging could start | 11 | Feb 28 | May 3 |
| 824 | Low | RFID/app authorization not detected within timeout period | 8 | Mar 12 | May 11 |
| 797 | Info | Comms Unit sent hard reset request | 7 | Mar 10 | Apr 3 |
| 983 | **Medium** | DC:DC module (position 3) output discharge fault | 7 | Mar 23 | May 4 |
| 858 | Low | Vehicle internal battery fault (ISO-15118: FAILED_EVRESSMalfunction) | 5 | Mar 10 | May 12 |
| 991 | Low | DC:DC module (position 3) DC Bus voltage above max threshold | 5 | May 5 | May 6 |
| 630 | Low | DC:DC modules offline, unresponsive, or faulty | 5 | May 6 | May 12 |
| 772 | **High** | SMU detected front door of charger opened | 3 | Apr 10 | Apr 10 |
| 74 | Low | Vehicle prematurely closed communication with charger | 3 | Apr 2 | Apr 24 |
| 503 | **High** | All AC:DC modules unavailable (offline, not responding, or in fault) | 2 | May 5 | May 5 |
| 770 | **High** | SMU detected disagreement between two door sensors | 2 | Apr 10 | Apr 10 |
| 875 | **High** | PP voltage — S3 button not released after plug-in | 2 | Mar 20 | Mar 25 |
| 1353 | Low | AC:DC module (position 2) DC Bus voltage above max threshold | 2 | May 5 | May 6 |
| 1327 | Low | AC:DC module (position 1) entered fault ride-through state | 1 | May 5 | May 5 |
| 961 | Low | DC:DC module (position 2) hardware output current above max threshold | 1 | May 3 | May 3 |
| 993 | Low | DC:DC module (position 3) hardware output current above max threshold | 1 | Mar 24 | Mar 24 |
| 867 | Low | Vehicle voltage mismatch (ISO-15118: FAILED_ChargingVoltageOutOfRange) | 1 | Apr 28 | Apr 28 |
| 1321 | Low | AC:DC module (position 1) DC Bus voltage above max threshold | 1 | Mar 24 | Mar 24 |
| 869 | Low | Communication handshake with vehicle timed out (setup network) | 1 | May 4 | May 4 |

### Key Fault Patterns

#### 🔴 Active Hardware Emergency (May 2026)
- **Code 1308 (AC contactor fault, High) — 54 occurrences since May 6**: The AC:DC module's AC contactor is repeatedly faulting. This is a critical power input component. 54 occurrences in 5 days indicates an active, unresolved failure.
- **Code 2434 (AC:DC module fault state, High) — 39 occurrences since May 6**: The AC:DC module itself is entering fault state. Combined with 1308, this unit's AC power input system is severely compromised.
- **Code 503 (All AC:DC modules unavailable, High) — 2 occurrences May 5**: The charger briefly lost all AC:DC modules simultaneously — the precursor to the contactor/fault cluster that followed.
- **Code 630 (DC:DC modules offline) — 5 occurrences since May 6**: Downstream DC:DC modules are going offline as a result of the AC:DC failure.
- This cluster of faults beginning May 5–6 represents a cascading power system failure. **This charger may currently be non-functional or operating intermittently.**

#### 🟡 Earlier Instability (March–April)
- **DC:DC module voltage faults (988, 956)** — chronic low-level issues throughout the period.
- **DC:DC discharge fault (983, Medium)** — 7 occurrences through early May.
- **6 manual resets in March–April** — operator was actively managing instability before the May event.

#### 🚪 Physical Security Event (April 10)
- **Codes 770 and 772** — door sensor disagreement and front door open detected within 7 minutes of each other on April 10. Likely a maintenance visit or inspection, but no corroborating reset or BootNotification was logged at that time. Should be verified against maintenance records.

---

## Weekly Fault & Session Pattern

| Day | Sessions | Fault Events | Notes |
|---|---|---|---|
| Sunday | 59 | 74 | Elevated |
| Monday | 47 | 44 | Moderate |
| Tuesday | 60 | 30 | Lower |
| Wednesday | 55 | 28 | Lowest fault day |
| Thursday | 54 | 10 | ⚠️ Unusually low — possible downtime |
| Friday | 64 | 33 | Moderate |
| Saturday | 58 | 17 | Low |

> ⚠️ Thursday showing only 10 fault events despite comparable session counts is unusual and may reflect a period where the charger was offline or in a state that didn't generate fault logs. Cross-reference with BootNotification timestamps for Thursday dates.

---

## Voice Agent Diagnosis Notes

- **If caller reports charger is offline or showing Faulted/Unavailable as of May 2026**: this charger has an active, unresolved AC:DC module and AC contactor failure (codes 1308, 2434) that began May 6. The charger may be non-functional. Do not advise retry — escalate immediately to operator for hardware inspection. This is not a user-fixable issue.
- If caller reports charger worked briefly then stopped: consistent with the intermittent AC:DC fault pattern. The unit is cycling in and out of fault state. Advise the caller this is a known hardware issue and provide alternate charger locations if available.
- If caller reports the charger screen is on and appears normal but won't start charging: DC:DC modules going offline (code 630) can cause this. The unit may appear functional but be unable to deliver power. Escalate to operator.
- If caller reports authentication issues (RFID/app): code 824 present (8 occurrences). Standard troubleshooting applies — hold RFID card closer, check app connection — but given the charger's overall instability, hardware may be the underlying cause.
- For any call regarding this charger during May 2026: lead with the possibility that the charger is experiencing an active hardware failure and set appropriate expectations before troubleshooting user-side issues.
- **High priority for maintenance dispatch.** This charger should not be the first recommendation for users needing a reliable charge until the AC:DC fault cluster is resolved.
