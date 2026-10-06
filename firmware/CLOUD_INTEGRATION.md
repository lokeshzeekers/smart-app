# SMArT manikin - connection, steps, alerts and firmware

How a physical manikin is linked to a trainer and trainee, what each of the 11
steps is sensed by, how the buzzer and app alerts work, and how to flash the
firmware. Code is in `firmware/smart_cloud/`.

## 1. How it works

```
Admin ── registers manikin ──► DEVICE ID + KEY (shown once) ──► flashed into the ESP32
  └─ assigns the manikin to a trainer (or leaves it shared)
Trainer ── (optional) pins a trainee to one manikin
Trainee ── opens Coach / Check / Certification on the phone
            └─ the app creates a session tagged with the trainee's manikin
ESP32  ── asks the backend every 2 s: "what is my current session?"
            └─ then sends:  live telemetry (~3/s)   -> phone: depth, path, neck angle,
                                                       laryngoscope PRESENT/ABSENT, timer
                            step events              -> green / "assumed" dots
                            alerts                   -> alert feed on the phone (+ buzzer on the manikin)
                            final /complete          -> metrics, SMArT score, trainer review queue
```

**Who can use which manikin** (enforced by the backend, not just the app):

| Setup | Result |
|---|---|
| Manikin unassigned | Any trainee can pick it |
| Admin assigns it to a trainer | Only that trainer's trainees see it |
| Trainer pins a trainee to a manikin | That trainee always uses it; cannot change it |
| Trainee asks for a manikin that isn't theirs | Rejected: "That manikin is not available to you" |
| A manikin tries to write into a session that isn't open on it | Rejected (409) |

**One live session per manikin.** Starting or resuming a session closes any other
open session on that manikin (another trainee's, or the same trainee's other
mode), so the manikin always reports to the person using it now.

**Online status.** Home shows a green dot for a manikin that has contacted the
server in the last 20 s; the admin Manikins tab shows Online / Offline / Never connected.

## 2. The 11 steps and what senses them

Steps 10 and 11 follow the physical sequence: **10 = insert ETT, 11 = remove stylet.**

| # | Step | Sensor | How it is credited |
|---|---|---|---|
| 1 | Position yourself | none | *assumed* once step 3 is seen |
| 2 | Sniffing position | IMU head tilt | **sensed**: neck angle in range while the laryngoscope is in |
| 3 | Introduce laryngoscope (right) | LDR | **sensed** |
| 4 | Sweep tongue to the left | none | *assumed* together with step 9 |
| 5 | Tip in vallecula | none (next hardware version) | *assumed* together with step 9 |
| 6 | Do not press on teeth | push-button | **sensed**: tube inserted and the button was never pressed |
| 7 | Sufficient force | none | *assumed* together with step 9 (real if a lift-force sensor is added) |
| 8 | See the vocal cords | none | *assumed* together with step 9 |
| 9 | ETT through the vocal cords | reed switches | **sensed**: lung path = correct, food path = wrong. Shown in the app as "CORRECT - LUNG PATH" / "WRONG - FOOD PATH" |
| 10 | ETT to 21 cm (F) / 23 cm (M) | reed switches (depth) | **sensed**: designated depth reached on the correct path |
| 11 | Remove stylet | reed switch, reverse count | **sensed**: count runs back to "out" after step 10 |

**"Assumed" steps** (1, 4, 5, 7, 8) have no sensor, so the firmware credits them
from the sensed steps around them. The app marks them with a light-green dot and
the word *assumed*, so a trainer can tell sensed from assumed. They still count
towards the pass mark (10 of 11). Without them every attempt would fail, as only
6 steps are sensed. For strict scoring add
`#define SMART_INFER_UNSENSED_STEPS 0` to `smart_config.h`; assumed steps are then
never credited, and attempts will score as fails until those sensors exist.

## 3. Alerts

Every alert sounds the **buzzer on the manikin** (instantly, even with no WiFi) and
appears in the **alert feed on the phone** (the phone also vibrates for the red
ones). Each alert fires once per event and re-arms when the condition clears.
Alerts are stored per session for the trainer.

| Alert | Fires when | Buzzer pattern |
|---|---|---|
| Wrong path | tube goes down the food pipe (reed switch) | 3 fast beeps |
| Pressure on teeth | teeth button pressed while instruments are in the mouth | 1 long beep |
| Too deep | tube past the designated depth | 2 long beeps |
| Head position | laryngoscope goes in with the neck not in the sniffing position | 2 short beeps |
| Tube at depth | step 10 reached | short, short, long |
| Stylet removed | step 11 reached (procedure complete) | short, short, long (slower) |
| Correct path | tube goes down the lung path | 1 tiny chirp |

If several fire together, the most important one sounds (wrong path > teeth >
too deep > head position > tube at depth > stylet removed > correct path).

## 4. Timer

Starts the first time the laryngoscope is detected (LDR) and stops when the tube
reaches the designated depth (step 10). Shown live on Coach and Check, and saved as
**Total time to intubate** (a value sent by the firmware itself takes priority).
The server measures it, so the ESP32 needs no clock.

## 5. How an attempt ends

The firmware closes the attempt (`/complete`) when:
- the stylet is out (step 11): about 2 s later, once all steps are delivered; or
- the tube is at depth but the stylet is never reported out: after 30 s; or
- the laryngoscope was taken out again without ever intubating: after 20 s (abandoned).

The next attempt only starts counting once the manikin is empty (no laryngoscope,
no tube), so a tube left in does not complete the next attempt by itself.
Check and Certification attempts get a SMArT score and go to the trainer's review queue.

## 6. One-time setup

1. **Backend (existing database):** run both migrations, then restart the backend and rebuild the frontend:
   ```bash
   psql "$DATABASE_URL" -f backend/db/migrations/005_laryngoscope_timer.sql
   psql "$DATABASE_URL" -f backend/db/migrations/006_alerts_and_step_order.sql
   ```
   Fresh install: `schema.sql` + `seed.sql` already contain everything.
   Note: sessions recorded *before* migration 006 keep their old step numbers, so for
   those, steps 10 and 11 read the other way round.
2. **Register the manikin:** Admin -> Manikins -> "+ Register a manikin". Copy the **device ID and key now** (the key is never shown again; if lost, deactivate and register a new one).
3. **Assign a trainer** in the same tab (or leave it shared).
4. **Optionally pin a trainee:** Trainer -> open the trainee -> choose the manikin.
5. **Firmware:** section 7.

## 7. Firmware

Only the ESP32 Arduino core is needed (WiFi, HTTPClient, FreeRTOS). Works with core 2.x and 3.x.

1. Copy `firmware/smart_cloud/` into your sketch folder.
2. Copy `smart_config.example.h` to `smart_config.h` and fill in device ID/key, backend address, WiFi, LDR and buzzer pins (`smart_config.h` is git-ignored).
3. Follow `example_integration.ino`: `#include "smart_cloud.h"`, remove the old Access-Point lines, call `smartCloudBegin()` in `setup()` and `smartCloudLoop(in)` in `loop()`, after copying your sensor variables into `SmartInputs`.

The backend address must be reachable from the manikin's WiFi: use the PC's LAN IP
(e.g. `http://192.168.1.50:4000`) for bench tests, never `localhost`. The code uses
plain HTTP; for an HTTPS-only server, expose an HTTP port on the LAN or switch the
code to `WiFiClientSecure`.

WiFi and server calls run in a **separate background task**, so a slow or missing
network can never stall your sensors or the buzzer. Requests time out after 2 s and
pause 3 s after a failure; WiFi reconnects on its own.

### Laryngoscope LDR

- Wire the module's **AO** pin to an ADC1 pin (ESP32: GPIO 32-39; ESP32-S3: GPIO 1-10). ADC2 pins stop working while WiFi is on. Using the **DO** pin? Set `SMART_LDR_ANALOG 0`.
- With `SMART_LDR_DEBUG 1` the Serial Monitor prints `[LDR] raw=...` every second. Note the value with the laryngoscope **out** and **in**, and set `SMART_LDR_THRESHOLD` halfway between.
- If the reading goes **up** when the laryngoscope is in, set `SMART_LDR_PRESENT_WHEN_HIGH 1`.
- Shield the LDR from room-light changes, otherwise the status will flicker.

### Buzzer

- **Active buzzer** (beeps by itself when powered; most 3-pin modules): `SMART_BUZZER_ACTIVE 1`. If it sounds when the pin is LOW, set `SMART_BUZZER_ACTIVE_LOW 1`.
- **Passive buzzer** (needs a tone): `SMART_BUZZER_ACTIVE 0`; the tone is `SMART_BUZZER_FREQ`.
- No buzzer: `SMART_BUZZER_PIN -1`.

### Stylet (step 11): please check against your wiring

The firmware expects one number from you, `in.styletIndex`: the reed-switch index
the stylet tip is at while it is inside the tube (0, 1, 2, ...), counting **down**
as it is withdrawn, and `-1` once it is fully out. Step 11 is credited when it
reaches `-1` after the tube is at depth. Hold the last reached index while between two
switches, or a gap will read as "out". If the line is left out, step 11 is never
credited and the attempt closes by the 30 s rule.

## 8. Testing

1. Power the manikin: Serial Monitor shows `connected, IP ...`. The manikin shows **online** on the trainee's Home screen.
2. Log in as the trainee and open Coach. Serial shows `[SMArT] session -> <id>`.
3. Move the laryngoscope in: PRESENT, the timer runs, steps 1-3 light up.
4. Push the tube down the **food path**: red banner, 3 beeps, alert on the phone. Pull back and use the **lung path**: 1 chirp.
5. Reach the designated depth: timer stops, short-short-long. Pull the stylet back: step 11, short-short-long.
6. About 2 s later Serial prints `attempt reported as complete`; Check/Certification show the score.

Unit tests for the step, alert and buzzer logic (on a PC):
`cd firmware/smart_cloud && g++ -std=c++11 test_steps.cpp -o test_steps && ./test_steps`

## 9. Troubleshooting

| Symptom | Check |
|---|---|
| "Waiting for manikin connection" never clears | Backend address reachable from the manikin's WiFi? Device ID/key correct and device active? Session started with *this* manikin? |
| Serial: `backend rejected the device ID/key (401)` | Wrong or old key, or the device was deactivated |
| Laryngoscope status flickers | Raise `SMART_LDR_HYSTERESIS` / `SMART_LDR_DEBOUNCE_MS`; shield the LDR |
| Buzzer silent | `SMART_BUZZER_PIN`, active vs passive, `ACTIVE_LOW` |
| Steps never light up | `smartCloudLoop` not called every loop, or `depthIndex` / `correctPath` not copied from your sensors |
| No steps after a previous attempt | The previous tube/laryngoscope is still in; remove everything and the next attempt starts |

## 10. Notes

- Live telemetry goes over socket.io and is not stored per tick; steps, final metrics and alerts are written to the database.
- A session stays open until completed, so reopening a mode screen reuses it instead of creating duplicates.
