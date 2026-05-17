# Charger4 — History Summary
**Internal ID:** charger4 | **Period:** March 1, 2026 – May 17, 2026

---

## Overview

Charger4 is a well-utilized DC fast charger with 573 sessions started and 568 completed — a 99.1% completion rate. Average energy delivered per session is 19.9 kWh, the lowest in the group, though its peak session reached 115.9 kWh. The unit has been active since late February 2026 and last reported activity on May 17, 2026 at 05:25 — notably earlier in the day than the other chargers, which may simply reflect its location's traffic pattern.

The charger has rebooted 60 times over the period (roughly every 1.3 days, the most stable reboot rate in the group) and has had 5 manual resets between March 14 and May 2, 2026. Average internal temperature is 301.0°C with a peak of 324.0°C, and fan speed averages 5,577 RPM — the lowest fan speed in the group, suggesting either lower ambient temperature, lower workload intensity, or a fan that may warrant inspection.

Charger4 has a distinctive fault pattern: Saturdays are by far the worst fault day (167 events), with Sundays also elevated (107 events). Weekday fault rates are considerably lower (41–71 events), making this the only charger in the group where weekend days are the primary fault concern. This is consistent with higher weekend foot traffic at this location and suggests users at this site are more likely to be less experienced with DC fast charging on weekends.

The fault profile is notable for having the highest-severity recurring fault in the group: code 875 (S3 button not released after plug-in) appeared 125 times — the most of any single fault code across all five chargers. This is a strong indicator of a physical usability issue at this location, either a damaged connector, poor signage, or user behavior that should be addressed with on-site guidance.

---

## Session Statistics

| Metric | Value |
|---|---|
| Sessions started | 573 |
| Sessions completed | 568 |
| Completion rate | 99.1% |
| Average energy delivered | 19,915 Wh (19.9 kWh) |
| Peak energy delivered | 115,860 Wh (115.9 kWh) |
| First activity | Feb 28, 2026 |
| Last activity | May 17, 2026 (05:25) |

---

## Operational Status Distribution

| Status | Count | Notes |
|---|---|---|
| Available | 10,686 | Healthy idle |
| Unavailable | 2,247 | Moderate — above charger1 baseline |
| Preparing | 1,974 | Active user engagement |
| Charging | 1,609 | Active charging |
| Finishing | 836 | Normal wrap-up |
| Faulted | 589 | ~3.5% of status events |

---

## Hardware & Thermal Telemetry

| Metric | Average | Peak |
|---|---|---|
| Internal temperature | 301.0 (sensor units) | 324.0 |
| Fan RPM | 5,577 | — |
| Voltage | Not reporting | — |
| Current | Not reporting | — |

> ⚠️ Fan RPM (5,577) is the lowest in the group. Combined with average temperatures in line with other chargers, this warrants a fan inspection — lower RPM at similar temperatures could indicate fan wear.
> ⚠️ Voltage and current telemetry not populating.

---

## Reboot History

| Event | Count | First | Last |
|---|---|---|---|
| BootNotification | 60 | Feb 28, 2026 | May 12, 2026 |
| Manual Reset | 5 | Mar 14, 2026 | May 2, 2026 |

Five manual resets spread across the full observation period (March through May), suggesting recurring issues requiring operator intervention. Unlike charger2 where resets clustered recently, these are distributed — indicating a longer-running instability.

---

## Fault History

*Sorted by occurrence count. All faults are Low severity unless noted.*

| Code | Severity | Description | Count | First | Last |
|---|---|---|---|---|---|
| 875 | **High** | PP voltage — S3 button not released after plug-in | 125 | Apr 17 | May 12 |
| 873 | Low | PP voltage not detected — proximity signal missing or premature unplug | 99 | Mar 11 | May 4 |
| 824 | Low | RFID/app authorization not detected within timeout period | 86 | Mar 10 | May 2 |
| 63 | Low | Vehicle communication timed out before charging could start | 38 | Feb 28 | Apr 30 |
| 50 | Low | Vehicle detected error and initiated emergency shutdown | 35 | Feb 28 | May 3 |
| 867 | Low | Vehicle voltage mismatch (ISO-15118: FAILED_ChargingVoltageOutOfRange) | 34 | Mar 9 | Apr 22 |
| 878 | Low | CP voltage on CCS cable out of valid range | 26 | Mar 21 | Apr 22 |
| 74 | Low | Vehicle prematurely closed communication with charger | 22 | Mar 14 | May 3 |
| 62 | Low | Vehicle did not initiate communication within expected time | 21 | Apr 17 | May 12 |
| 988 | Low | DC:DC module (position 3) software output voltage above max threshold | 15 | Mar 14 | Apr 28 |
| 956 | Low | DC:DC module (position 2) software output voltage above max threshold | 12 | Mar 12 | Apr 29 |
| 860 | Low | Connector lock fault (ISO-15118: FAILED_ChargerConnectorLockFault) | 9 | Mar 17 | Apr 19 |
| 797 | Info | Comms Unit sent hard reset request | 8 | Mar 14 | May 2 |
| 858 | Low | Vehicle internal battery fault (ISO-15118: FAILED_EVRESSMalfunction) | 8 | Mar 22 | Apr 29 |
| 898 | Low | IOC power-cycled the LCD/HMI screen due to communication timeout | 4 | Mar 23 | Apr 22 |
| 983 | **Medium** | DC:DC module (position 3) output discharge fault | 4 | Apr 4 | Apr 27 |
| 1321 | Low | AC:DC module (position 1) DC Bus voltage above max threshold | 4 | Feb 28 | Apr 19 |
| 313 | Low | Vehicle declined a charging request | 3 | Apr 7 | Apr 7 |
| 993 | Low | DC:DC module (position 3) hardware output current above max threshold | 3 | Mar 15 | Mar 22 |
| 823 | Low | User authorization declined or backend timeout | 3 | Mar 14 | Apr 30 |
| 961 | Low | DC:DC module (position 2) hardware output current above max threshold | 2 | Mar 15 | Mar 15 |
| 792 | **High** | CPO link down — affects ISO-15118 plug-and-charge authentication | 2 | Mar 24 | Mar 24 |
| 869 | Low | Communication handshake with vehicle timed out (setup network) | 2 | Apr 15 | Apr 29 |
| 2466 | **High** | AC:DC module (position 2) entered fault state | 1 | Mar 11 | Mar 11 |

### Key Fault Patterns
- **Code 875 (S3 button, High severity) — 125 occurrences** — by far the most frequent High-severity fault across all five chargers and all fault codes. This began April 17 and has been recurring through May 12. Strongly suggests a physical connector issue or user behavior pattern specific to this location. On-site signage or hardware inspection strongly recommended.
- **Code 824 (RFID/app timeout) — 86 occurrences** — the highest authorization failure rate in the group. This charger has a significant user authentication problem — may be related to app connectivity, RFID reader sensitivity, or network issues at the site.
- **Code 873 (proximity pilot) — 99 occurrences** — second only to code 875. Combined with 875, this unit has a severe connector interface problem.
- **HMI power cycle (898)** — screen reboots due to communication timeout. 4 occurrences — worth noting if callers report a blank or frozen screen.
- **CPO link fault (792, High)** — 2 occurrences in March. Affects plug-and-charge (ISO-15118) authentication. If this recurs, backend connectivity at this site should be investigated.

---

## Weekly Fault & Session Pattern

| Day | Sessions | Fault Events | Notes |
|---|---|---|---|
| Sunday | 89 | 107 | ⚠️ Elevated |
| Monday | 76 | 64 | Moderate |
| Tuesday | 81 | 71 | Moderate |
| Wednesday | 84 | 41 | Lowest fault day |
| Thursday | 84 | 61 | Moderate |
| Friday | 74 | 55 | Moderate |
| Saturday | 85 | 167 | ⚠️ Severe spike — worst day by far |

> ⚠️ Weekend fault pattern is unique in the group. Saturday is the highest fault day despite not being the highest session day — suggesting weekend users have more difficulty with the connector or authentication process.

---

## Voice Agent Diagnosis Notes

- If caller can't plug in or charger won't recognize the connector: code 875 (S3 button) and 873 (proximity pilot) are the top faults by far. Ask if the connector clicked fully into place. Ask if the user twisted or pulled the handle before the session started. This is the most common issue at this charger — physical connector guidance is the first step.
- If caller can't authenticate (RFID or app not working): code 824 is the second most common fault. Ask if the app shows connected. Ask if the RFID card was held close to the reader for 3+ seconds. This charger has an above-average authorization failure rate — may be a site-specific network or reader sensitivity issue.
- If caller reports a blank or frozen screen: code 898 (HMI power cycle) is on record. Advise the user to wait 60 seconds for the screen to reboot. If it doesn't recover, escalate to operator.
- If caller reports plug-and-charge (automatic authentication via cable) isn't working: code 792 (CPO link) was recorded in March. May indicate backend connectivity issues. Try manual RFID or app authentication as a fallback.
- Weekend callers (especially Saturday) should be treated as higher likelihood of connector/authentication issues given the fault pattern. Walk through physical plug-in steps first before assuming a hardware fault.
