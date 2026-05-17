# Charger3 — History Summary
**Internal ID:** charger3 | **Period:** March 1, 2026 – May 17, 2026

---

## Overview

Charger3 is a consistently active DC fast charger with 653 sessions started and 658 completed. The slightly higher completion count than start count is a known artifact of session records spanning the data start boundary — functionally the completion rate is effectively 100%. Average energy per session is 21.9 kWh, the second highest in the group, with a peak session of 117.8 kWh. The unit has been online since late February 2026.

The charger has rebooted 66 times over the period (roughly every 1.2 days) and has had 2 manual resets — both clustered in late April to early May 2026, coinciding with a period of elevated AC:DC module faults. Average internal temperature is 301.3°C with a peak of 324.3°C, and fan speed averages 6,684 RPM — all within normal operating range for this fleet.

Charger3 stands out for having the most distributed fault load across the week — fault events are elevated every day with no single dominant low-fault day. Fridays are the worst (172 fault events), and even the best days (Sunday, Saturday) still see over 120 fault events. This suggests a chronic underlying condition rather than a demand-driven spike pattern. The fault profile confirms this: charger3 has the broadest variety of fault codes in the group and is the only unit to show High-severity faults across three distinct categories (PP/S3 button, isolation discharge, and AC:DC module failure).

Voltage and current telemetry are not populating, consistent with the fleet-wide reporting gap.

---

## Session Statistics

| Metric | Value |
|---|---|
| Sessions started | 653 |
| Sessions completed | 658 |
| Completion rate | ~100% (boundary artifact) |
| Average energy delivered | 21,931 Wh (21.9 kWh) |
| Peak energy delivered | 117,808 Wh (117.8 kWh) |
| First activity | Feb 28, 2026 |
| Last activity | May 17, 2026 |

---

## Operational Status Distribution

| Status | Count | Notes |
|---|---|---|
| Available | 9,669 | Healthy idle |
| Unavailable | 3,654 | ⚠️ Second highest in group |
| Charging | 1,811 | Active charging |
| Preparing | 1,711 | User engagement |
| Faulted | 1,011 | ⚠️ Second highest fault count — ~5.3% of status events |
| Finishing | 742 | Normal wrap-up |

---

## Hardware & Thermal Telemetry

| Metric | Average | Peak |
|---|---|---|
| Internal temperature | 301.3 (sensor units) | 324.3 |
| Fan RPM | 6,684 | — |
| Voltage | Not reporting | — |
| Current | Not reporting | — |

> ⚠️ Voltage and current telemetry not populating. Recommend verifying MeterValues configuration.

---

## Reboot History

| Event | Count | First | Last |
|---|---|---|---|
| BootNotification | 66 | Mar 10, 2026 | May 16, 2026 |
| Manual Reset | 2 | Apr 30, 2026 | May 6, 2026 |

Both manual resets occurred within a week of each other in late April–early May, overlapping with the AC:DC module fault (code 2466) appearances on Apr 24 and May 7. Likely operator response to that fault.

---

## Fault History

*Sorted by occurrence count. All faults are Low severity unless noted.*

| Code | Severity | Description | Count | First | Last |
|---|---|---|---|---|---|
| 878 | Low | CP voltage on CCS cable out of valid range | 34 | Mar 15 | May 16 |
| 873 | Low | PP voltage not detected — proximity signal missing or premature unplug | 34 | Mar 10 | May 16 |
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
| 797 | Info | Comms Unit sent hard reset request | 3 | Apr 30 | May 6 |
| 2466 | **High** | AC:DC module (position 2) entered fault state | 2 | Apr 24 | May 7 |
| 630 | Low | DC:DC modules offline, unresponsive, or faulty | 2 | Apr 3 | Apr 3 |
| 22 | Low | Vehicle has not initiated a charging request | 2 | Apr 12 | Apr 12 |
| 982 | **High** | DC:DC module (position 3) communication timeout | 1 | Mar 30 | Mar 30 |
| 313 | Low | Vehicle declined a charging request | 1 | May 11 | May 11 |

### Key Fault Patterns
- **Cable/proximity faults (878, 873)** are the top recurring issues — 34 each, persistent across the full observation window through May 16. Likely a combination of user handling and cable wear.
- **DC:DC module voltage faults (956, 988)** across both positions 2 and 3 — chronic, low-severity but persistent. Monitor for escalation.
- **AC:DC module fault (2466)** — High severity, appeared twice in April–May. Correlated with the two manual resets. If this recurs, module replacement should be evaluated.
- **Isolation discharge fault (318)** — High severity, safety-critical. Three occurrences across March–May. Must be logged for next inspection.
- **S3 button fault (875)** — High severity, 3 occurrences. May indicate physical connector wear or user mishandling.
- This charger has the most diverse fault code set of the five units, suggesting generalized wear across multiple subsystems.

---

## Weekly Fault & Session Pattern

| Day | Sessions | Fault Events | Notes |
|---|---|---|---|
| Sunday | 91 | 124 | Elevated baseline |
| Monday | 96 | 115 | Elevated baseline |
| Tuesday | 82 | 136 | High |
| Wednesday | 94 | 155 | High |
| Thursday | 91 | 137 | High |
| Friday | 96 | 172 | ⚠️ Peak fault day |
| Saturday | 103 | 123 | Elevated baseline |

> ⚠️ No low-fault days — fault load is elevated across the entire week. This is the defining characteristic of this charger and distinguishes it from the demand-driven spike patterns seen on charger1 and charger2.

---

## Voice Agent Diagnosis Notes

- If caller reports charger won't connect: cable interface faults are the most common issue (878, 873). Ask if the connector fully seated and clicked. Ask if the vehicle proximity light or dashboard shows a plug-in confirmation.
- If caller reports charger shows Faulted: this unit has a chronic fault pattern. Ask if the display shows an error code. Advise a full unplug, 2-minute wait, and retry. If still faulted, escalate — this unit has a history of requiring operator resets.
- If caller reports the charger was working then suddenly went Unavailable: likely a DC:DC or AC:DC module event. Unit may recover on reboot. Advise 3–5 minute wait. If recurring, flag for hardware inspection — module faults (956, 988, 2466) have been persistent.
- If caller mentions the connector feels loose or hard to plug in: S3 button fault (875) and connector lock fault (860) are both on record. Advise user not to force the connector. Escalate for physical inspection.
- Safety note: isolation discharge fault (318) has occurred 3 times. If caller reports any unusual behavior during the safety check phase of charging startup, do not advise retry — escalate to operator immediately.
