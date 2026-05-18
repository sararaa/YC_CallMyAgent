# Voice Agent Knowledge Base: EV Charging Support

## Core Troubleshooting Principles

- **The "Lift Trick"** : If the connector won't click or lock into the vehicle, lift the handle up by the back (toward the sky) while plugging in. The CCS1 connector is heavy, and this ensures proper pin contact.
- **45-Second Rule** : After swiping to pay or starting a session in the app, you have approximately 45 seconds to plug in. If you take longer, the charger will lock you out and you must restart.
- **App-First Sequence** : On many networks, you must start the session in the app FIRST, then plug in. Plugging in first often causes a handshake failure.
- **Stuck Button** : If the connector won't insert or release, press the physical button on top of the CCS handle several times to unstick it.

## Speed & Performance Issues

### The 30-40kW "Dead Zone"
- If the charger shows exactly 30-40kW on a 150kW or 350kW unit, this indicates a **cooling system failure** inside the charger.
- **Do not restart or wait.** Immediately unplug and move to a different charger number.
- This is a confirmed hardware failure.

### Derated Speeds
- If the screen shows "Full speed unavailable" or similar, a component inside the power cabinet has failed. Move to another stall.

### Shared Power (Paired Chargers)
- Multiple dispensers often share one power cabinet.
- If you are on a 350kW charger and another vehicle is using the paired 350kW charger next to you, you will split the total power (typically dropping to ~175kW or lower).
- **Solution:** Move to a stall where the adjacent unit is empty.

## Connection & Handshake Failures

### "Vehicle Not Responding" Error
- **Cause:** The handshake between charger and vehicle failed.
- **Fix:** Unplug. Close the app completely. Reopen the app, swipe to start, then plug in within 45 seconds.

### Timeout Errors
- **Cause:** Too much time passed between payment and plugging in.
- **Fix:** Restart the session from the beginning.

### Vehicle-Side Lock Issues
- The vehicle's charge port lock may be stuck.
- **Fix:** Check the vehicle's infotainment screen for a "Release Charge Port" or "Unlock Charge Port" button. Press this even if nothing is plugged in.
- **Alternative Fix:** Set the vehicle's max charge limit to 80%, then back to 100% to reset the handshake logic.

## App & Account Workflow

### Pre-Arrival Checklist
- Install the app before arriving at the station. Cellular reception is often poor at charging sites.
- Add a payment method and verify the card before plugging in.
- Carry a physical credit card as a backup (tap-to-pay readers are available on most newer units).

### Swipe to Start
- Locate the "Swipe to Start" button in the app.
- Swipe, then plug in. Do not plug in first.

### Payment Authorization
- Some cards require a small authorization hold. If this fails, the bank may flag it as fraud. A physical backup card solves this.

## Emergency & Escalation Protocols

### When to Move Stalls
- **Move immediately if:** Speed is stuck at 30-40kW, screen is frozen/black, or you get repeated "Vehicle not responding" after two attempts.
- **Try one reboot attempt if:** Session times out or app freezes.

### Remote Reboot
- A support agent can remotely reboot a charger. This takes approximately 2-3 minutes.
- Stay plugged in while the reboot occurs.

### The Free Session Fallback
- If a charger is broken and the customer calls support, the agent can often activate the charger remotely for free as compensation.
- **Instruction:** Stay plugged in while the support rep sends the "start" signal.

## Known Hardware Failure Patterns

| Symptom | Likely Cause | Action |
|:---|:---|:---|
| Exactly 30-40kW on a high-speed unit | Cooling system / temp sensor failure | Move stalls immediately |
| Connector won't click | Heavy CCS1 handle alignment | Use the lift trick |
| Connector won't release | Stuck physical button | Press button repeatedly |
| Screen on but session won't start | 45-second timeout violation | Restart app and swipe again |
| Frozen black screen | Internal component failure | Move stalls or request remote reboot |
| Slow charging on hot day | Weather-related component derate | Move to shaded stall if available |

## Weather & Environmental Factors

- **Heatwaves:** Internal components (cooling pumps, sensors) are prone to failure in extreme heat. Expect more 30-40kW stalls during summer.
- **Cold snaps:** Connectors may be stiff. Warm the handle slightly (keep inside vehicle before use) or apply firm, steady pressure when plugging in.

## Connector Types Reference

- **CCS (Combined Charging System):** Large connector with two lower DC pins. Most common for fast charging. Green label or marking typical.
- **CHAdeMO:** Distinctive round connector. Used primarily on older vehicles (e.g., Nissan Leaf). Blue label typical.

## Troubleshooting Decision Tree

### Step 1: Identify the problem
- "Won't connect at all?"
- "Charges but very slow (under 50kW)?"
- "Session starts then stops?"

### Step 2: Won't connect
→ Check screen is on  
→ Press button to ensure not stuck  
→ Use lift trick while inserting  
→ Confirm app-first sequence  
→ Restart app, swipe, plug within 45 seconds

### Step 3: Very slow (30-40kW)
→ Unplug immediately  
→ Move to a different charger number  
→ Do not waste time restarting

### Step 4: Moderate slow (50-100kW but expected 150+)
→ Check if adjacent stall is occupied (shared power)  
→ If yes, move to isolated stall  
→ If no, likely derated hardware → move stalls

### Step 5: Session starts then stops
→ Check vehicle charge limit (may be set too low)  
→ Check for vehicle-side lock error  
→ Try different charger

## Offline / No Cellular Signal

- The app requires data to start a session.
- **Workaround:** Use a physical credit card on the charger's tap-to-pay reader.
- **Workaround:** Call the support number (available 24/7) to have a session started remotely.

## Summary of User Actions (Quick Reference)

| User says... | Agent response |
|:---|:---|
| "It won't plug in" | "Lift the handle up slightly while inserting, and check that the button isn't stuck." |
| "It's charging at 30kW" | "That charger has a cooling failure. Unplug and move to a different unit immediately." |
| "The app won't start" | "Close the app completely, swipe to start, then plug in within 45 seconds." |
| "It says vehicle not responding" | "Unplug. Set your car's charge limit to 80% then back to 100%, then try the app-first sequence again." |
| "The screen is black" | "Move to another stall, or I can request a remote reboot if you stay plugged in for 2-3 minutes." |