# Charger1 — History Summary
**Internal ID:** charger1 | **Period:** March 1, 2026 – May 17, 2026

---

## Overview

Charger1 is a heavily used DC fast charger with 706 sessions started and 700 completed between March and May 2026, reflecting a strong 99.1% session completion rate. Average energy delivered per session is approximately 21.4 kWh, with a peak session reaching 84.9 kWh — consistent with long-dwell EV use. The unit has been online continuously since late February 2026 and has rebooted 65 times over the observation period, averaging roughly one reboot every 1.2 days. No manual resets have been recorded, suggesting all reboots were self-initiated by the unit's firmware.

The charger operates at an average internal temperature of 294.6°C (sensor units), with a recorded peak of 326.2°C — the coolest running unit in this group. Fan speed averages 7,257 RPM, the highest of all five chargers, which may reflect active thermal management compensating for workload or ambient conditions. Voltage and current telemetry are not populating for this unit, which may indicate a firmware or sensor reporting gap worth investigating.

Session demand is relatively even across the week, peaking slightly on Thursdays (108 sessions) and Fridays (111 sessions). Fault events spike significantly on Thursdays (102) and Fridays (91), suggesting these high-demand days correlate with increased stress on the unit. Sunday through Wednesday fault rates are noticeably lower (31–59 events), making the Thu–Fri pattern the most actionable signal for proactive maintenance scheduling.

The charger's fault profile is dominated by vehicle-side and cable interface errors rather than internal hardware failures, making it a relatively healthy unit from a hardware standpoint. No high-severity hardware faults have been recorded for this charger.

---

## Session Statistics

| Metric | Value |
|---|---|
| Sessions started | 706 |
| Sessions completed | 700 |
| Completion rate | 99.1% |
| Average energy delivered | 21,435 Wh (21.4 kWh) |
| Peak energy delivered | 84,897 Wh (84.9 kWh) |
| First activity | Feb 28, 2026 |
| Last activity | May 17, 2026 |

---

## Operational Status Distribution

| Status | Count | Notes |
|---|---|---|
| Available | 4,654 | Healthy idle state |
| Preparing | 4,581 | High — reflects active user engagement |
| Charging | 1,655 | Active charging events |
| Finishing | 849 | Normal session wrap-up |
| Faulted | 431 | ~3.6% of status events |
| Unavailable | 183 | Low — minimal planned downtime |

---

## Hardware & Thermal Telemetry

| Metric | Average | Peak |
|---|---|---|
| Internal temperature | 294.6 (sensor units) | 326.2 |
| Fan RPM | 7,257 | — |
| Voltage | Not reporting | — |
| Current | Not reporting | — |

> ⚠️ Voltage and current telemetry are not populating. May indicate a sensor or firmware reporting issue. Recommend verifying MeterValues configuration at next service visit.

---

## Reboot History

| Event | Count | First | Last |
|---|---|---|---|
| BootNotification | 65 | Mar 10, 2026 | May 17, 2026 |
| Manual Reset | 0 | — | — |

Reboot frequency is approximately every 1.2 days. No manual resets recorded. All reboots appear firmware-initiated.

---

## Fault History

*Sorted by occurrence count. All faults are Low severity unless noted.*

| Code | Severity | Description | Count | First | Last |
|---|---|---|---|---|---|
| 878 | Low | CP voltage on CCS cable out of valid range | 34 | Mar 15 | May 16 |
| 873 | Low | PP voltage not detected — vehicle proximity signal missing or premature unplug | 34 | Mar 10 | May 16 |
| 956 | Low | DC:DC module (position 2) software output voltage above max threshold | 26 | Mar 14 | May 16 |
| 50 | Low | Vehicle detected error and initiated emergency shutdown | 20 | Mar 10 | May 7 |
| 74 | Low | Vehicle prematurely closed communication with charger | 17 | Mar 21 | May 14 |
| 867 | Low | Vehicle voltage mismatch (ISO-15118: FAILED_ChargingVoltageOutOfRange) | 16 | Mar 10 | May 15 |
| 988 | Low | DC:DC module (position 3) software output voltage above max threshold | 12 | Mar 10 | May 5 |
| 860 | Low | Connector lock fault (ISO-15118: FAILED_ChargerConnectorLockFault) | 8 | Mar 16 | May 4 |
| 63 | Low | Vehicle communication session timed out before charging could start | 7 | Mar 13 | May 4 |
| 983 | **Medium** | DC:DC module (position 3) output discharge fault | 6 | Mar 22 | Apr 23 |
| 858 | Low | Vehicle internal battery fault (ISO-15118: FAILED_EVRESSMalfunction) | 5 | Mar 9 | May 8 |
| 993 | Low | DC:DC module (position 3) hardware output current above max threshold | 5 | Mar 15 | May 13 |
| 875 | **High** | PP voltage — S3 button not released after plug-in | 3 | Apr 8 | May 8 |
| 318 | **High** | Charger needed extra time to discharge after isolation safety check | 3 | Mar 30 | May 8 |
| 797 | Info | Comms Unit (CU) sent hard reset request | 3 | Apr 30 | May 6 |
| 2466 | **High** | AC:DC module (position 2) entered fault state | 2 | Apr 24 | May 7 |
| 630 | Low | DC:DC modules offline, unresponsive, or faulty | 2 | Apr 3 | Apr 3 |
| 22 | Low | Vehicle has not initiated a charging request | 2 | Apr 12 | Apr 12 |
| 982 | **High** | DC:DC module (position 3) communication timeout | 1 | Mar 30 | Mar 30 |
| 313 | Low | Vehicle declined a charging request | 1 | May 11 | May 11 |

### Key Fault Patterns
- **Dominant faults are vehicle/cable-side** (codes 878, 873, 867, 860, 74) — most likely user or vehicle compatibility issues, not charger hardware problems.
- **DC:DC module voltage faults** (956, 988) are recurring across both positions 2 and 3 — worth monitoring for module degradation.
- **High-severity AC:DC fault (2466)** appeared twice in late April–May — escalate if recurrence increases.
- **Isolation discharge fault (318)** appeared 3 times — safety-critical, log for next scheduled inspection.

---

## Weekly Fault & Session Pattern

| Day | Sessions | Fault Events | Notes |
|---|---|---|---|
| Sunday | 106 | 31 | Low fault rate |
| Monday | 93 | 59 | Moderate |
| Tuesday | 99 | 49 | Moderate |
| Wednesday | 91 | 38 | Low-moderate |
| Thursday | 108 | 102 | ⚠️ High fault spike |
| Friday | 111 | 91 | ⚠️ High fault spike |
| Saturday | 98 | 46 | Moderate |

---

## Voice Agent Diagnosis Notes

- If caller reports charger won't start a session: most likely a cable/proximity pilot issue (codes 873, 878). Ask if connector clicked into place. Ask if vehicle displayed any errors.
- If caller reports session started then stopped unexpectedly: likely vehicle-initiated (codes 50, 74, 858). Ask if vehicle dashboard showed an error. May be vehicle-side, not charger fault.
- If charger shows Faulted status: check for DC:DC module errors (956, 988, 983). Unit may self-recover on next boot. Advise user to wait 2–3 minutes and retry.
- If charger shows Unavailable: low historical rate, likely a brief planned state. Advise user to try again shortly or contact site operator.
- Voltage/current telemetry not available for this unit — cannot remotely verify power delivery status in real time.
