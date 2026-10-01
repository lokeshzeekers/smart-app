# Connecting the manikin to the SMArT backend

The manikin firmware used to run its own WiFi Access Point and serve a local
page; it never talked to the internet. To show up live in the SMArT app it
now does four things:

1. Joins your real WiFi network (STA mode) instead of creating its own AP.
2. Polls the backend to find out which session it should report against
   (the trainee picks the manikin on their phone; no keypad/display needed).
3. POSTs live telemetry (depth, path, angle, **laryngoscope present/absent**,
   banner text) to the backend ~3x per second.
4. POSTs each completed procedure step, and a final `/complete` when the
   attempt ends.

> Variable names below (`toolDetected`, `teethSafe`, `currentDepthIndex`,
> `depthPosition`, `DESIGNATED_INDEX`, `maxDepthIndexReached`, `currentState`,
> `IDLE`, `airFlow_slm`, ...) are taken from your existing firmware. The
> firmware itself is not in this repo, so adjust names if yours differ.

## 0. Update the backend first

Fresh install: `backend/db/schema.sql` already contains everything.
Existing database - run the incremental migration once:

```bash
psql "$DATABASE_URL" -f backend/db/migrations/005_laryngoscope_timer.sql
```

Then restart the backend and rebuild the frontend. The backend must be
reachable from the manikin's WiFi: use your machine's LAN IP
(e.g. `http://192.168.1.50:4000`) for bench testing, not `localhost`.
The ESP32 code below uses plain HTTP; if production sits behind HTTPS you
must switch to `WiFiClientSecure` (or expose an HTTP port on the LAN).

## 1. Credentials

Register the device in the admin dashboard (Manikins tab ->
"+ Register a manikin"). The ID and key are shown **once** - save them.

```cpp
const char* DEVICE_ID    = "SMART-XXXXXXXX";     // x-device-id
const char* DEVICE_KEY   = "the-generated-key";  // x-device-key
const char* BACKEND_HOST = "http://192.168.1.50:4000";

const char* WIFI_SSID     = "YourLabWiFi";
const char* WIFI_PASSWORD = "YourWiFiPassword";
```

## 2. WiFi in `setup()`

Replace `WiFi.mode(WIFI_AP); WiFi.softAP(...)` with:

```cpp
WiFi.mode(WIFI_STA);
WiFi.setAutoReconnect(true);
WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
Serial.print("Connecting to WiFi");
unsigned long t0 = millis();
while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) {
  delay(400);
  Serial.print(".");
}
Serial.println(WiFi.status() == WL_CONNECTED ? " connected" : " FAILED (will keep retrying)");
Serial.println(WiFi.localIP());
```

The 20 s limit matters: a plain `while (!connected)` loop hangs the whole
manikin (sensors included) if the router is off. `setAutoReconnect` brings
the link back later on its own. `server.begin()` and the local page can stay
for bench debugging.

## 3. Helpers (near the top of the sketch)

```cpp
#include <HTTPClient.h>

String currentSessionId = "";
bool sessionSawActivity = false;       // set once the trainee actually starts
uint16_t stepsSent = 0;                // bitmask, bit (n-1) = step n already sent
unsigned long lastSessionCheck = 0;
unsigned long lastTelemetryPush = 0;

// Laryngoscope presence - wire this to YOUR laryngoscope sensor/flag.
// (If your existing `toolDetected` is the laryngoscope sensor, just use it.)
bool laryngoscopePresent = false;

int httpPostJson(const String& path, const String& body) {
  if (WiFi.status() != WL_CONNECTED) return -1;
  HTTPClient http;
  http.setConnectTimeout(1500);   // never stall sensors for long
  http.setTimeout(1500);
  http.begin(String(BACKEND_HOST) + path);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-id", DEVICE_ID);
  http.addHeader("x-device-key", DEVICE_KEY);
  int code = http.POST(body);
  http.end();
  return code;
}

// returns "" on network/HTTP error, otherwise the response body
String httpGetJson(const String& path) {
  if (WiFi.status() != WL_CONNECTED) return "";
  HTTPClient http;
  http.setConnectTimeout(1500);
  http.setTimeout(1500);
  http.begin(String(BACKEND_HOST) + path);
  http.addHeader("x-device-id", DEVICE_ID);
  http.addHeader("x-device-key", DEVICE_KEY);
  int code = http.GET();
  String body = (code == 200) ? http.getString() : "";
  http.end();
  return body;
}

// Response is {"sessionId":"<uuid>"} or {"sessionId":null}
void checkActiveSession() {
  String resp = httpGetJson("/api/esp32/sessions/active");
  if (resp.length() == 0) return;                 // network error: keep state
  int k = resp.indexOf("\"sessionId\":");
  if (k < 0) return;
  String val = resp.substring(k + 12, resp.indexOf('}', k));
  val.trim();
  val.replace("\"", "");
  String newId = (val == "null") ? "" : val;
  if (newId != currentSessionId) {                // new / changed / ended elsewhere
    currentSessionId = newId;
    sessionSawActivity = false;
    stepsSent = 0;
  }
}

// Call once per completed procedure step (1..11). Safe to call every loop -
// it only sends the first time. metric is e.g. lift force in psi for step 7.
void pushStep(int stepNo, float metric = NAN) {
  if (currentSessionId == "" || stepNo < 1 || stepNo > 11) return;
  uint16_t bit = 1 << (stepNo - 1);
  if (stepsSent & bit) return;
  String body = "{\"stepNo\":" + String(stepNo);
  if (!isnan(metric)) body += ",\"metricValue\":" + String(metric, 2);
  body += "}";
  int code = httpPostJson("/api/esp32/sessions/" + currentSessionId + "/steps", body);
  if (code >= 200 && code < 300) stepsSent |= bit;   // retry next loop if it failed
}
```

## 4. Call from `loop()`

After your existing `readAllSensors(); runStateMachine();`:

```cpp
unsigned long now = millis();

// Which session am I working on? 2 s while idle, 5 s while active (so the
// device also notices if the session was ended or replaced from the app).
if (now - lastSessionCheck > (currentSessionId == "" ? 2000UL : 5000UL)) {
  lastSessionCheck = now;
  checkActiveSession();
}

if (currentSessionId != "") {
  // Trainee has really started once anything is detected
  if (laryngoscopePresent || toolDetected || maxDepthIndexReached >= 0) sessionSawActivity = true;

  // Live telemetry every ~300 ms
  if (now - lastTelemetryPush > 300) {
    lastTelemetryPush = now;

    bool wrong = (!teethSafe || wrongPathLatched || currentDepthIndex > DESIGNATED_INDEX);
    bool done  = (currentDepthIndex == DESIGNATED_INDEX);
    const char* bannerType = wrong ? "wrong" : (done ? "complete" : "progress");
    const char* bannerMsg  = wrong ? (!teethSafe ? "TEETH CONTACT" : "WRONG PATH")
                                   : (done ? "INTUBATION COMPLETE" : "IN PROGRESS");

    String body = "{";
    body += "\"toolDetected\":" + String(toolDetected ? "true" : "false") + ",";
    body += "\"laryngoscopePresent\":" + String(laryngoscopePresent ? "true" : "false") + ",";
    body += "\"teethSafe\":" + String(teethSafe ? "true" : "false") + ",";
    body += "\"depthCm\":" + String(currentDepthIndex >= 0 ? depthPosition[currentDepthIndex] : 0, 1) + ",";
    body += "\"wrongPath\":" + String(wrongPathLatched ? "true" : "false") + ",";
    body += "\"correctPath\":" + String(correctPathLatched ? "true" : "false") + ",";
    body += "\"headAngle\":" + String(headAngle, 1) + ",";
    body += "\"headCorrect\":" + String((headAngle >= HEAD_ANGLE_MIN && headAngle <= HEAD_ANGLE_MAX) ? "true" : "false") + ",";
    body += "\"imuCalib\":" + String(imuCalibStatus) + ",";
    body += "\"airflow\":" + String(airFlow_slm, 2) + ",";
    body += "\"bannerMsg\":\"" + String(bannerMsg) + "\",";
    body += "\"bannerType\":\"" + String(bannerType) + "\"";
    body += "}";
    httpPostJson("/api/esp32/sessions/" + currentSessionId + "/telemetry", body);
  }

  // Finished: tube removed again AFTER the trainee had actually started.
  // (`sessionSawActivity` is essential - without it this condition is true
  // the instant a session is picked up, because the manikin starts IDLE with
  // nothing reached, and the attempt would be completed immediately.)
  if (sessionSawActivity && currentState == IDLE && maxDepthIndexReached == -1) {
    // Total time to intubate (laryngoscope entry -> tube at depth) is
    // measured by the server from the telemetry stream, so no clock is
    // needed on the ESP32.
    int code = httpPostJson("/api/esp32/sessions/" + currentSessionId + "/complete", "{}");
    if (code >= 200 && code < 300) {
      currentSessionId = "";
      sessionSawActivity = false;
      stepsSent = 0;
    }
  }
}
```

If you measure them, put these in the `/complete` body instead of `{}`:
`{"laryngoscopeLiftForce":22,"timeToPlaceEtt":2.18,"ettLocationCm":-1}`
(`totalTimeToIntubate` is optional - if omitted, the server uses the
measured laryngoscope-entry-to-intubation time.) Fields you don't send are stored as empty
and are ignored by the scoring.

Call `pushStep(n)` from the state machine at the moment each step is
confirmed, e.g. `pushStep(3)` when the laryngoscope is introduced,
`pushStep(7, liftForcePsi)` for the lift-force step and `pushStep(11)` when
the designated depth is reached. If no steps are sent, the Coach dots stay
grey and the attempt scores 0/11 as a fail.

## 5. Laryngoscope status and timer

- The Coach and Check screens show **Laryngoscope: PRESENT / ABSENT** from
  the `laryngoscopePresent` field.
- The **Intubation timer** starts the first time the server sees
  `laryngoscopePresent: true` and stops when telemetry reports
  `bannerType: "complete"` (tube at the designated depth).
- The final value is saved as **Total time to intubate** (seconds) and shown
  on Check, Certification, trainer Review and in the Excel export. If the
  firmware sends its own `totalTimeToIntubate` in `/complete`, that value is
  used instead.

## 6. In the app

1. Admin -> Manikins -> register the device, flash ID + key into the firmware.
2. Power the manikin: it joins WiFi and starts polling.
3. A trainee opens Coach / Check / Certification (pick the manikin on Home if
   several are registered). This creates a session tagged with that device.
4. Within ~2 s the manikin picks up the session and starts pushing telemetry;
   the screen shows depth/path/angle, laryngoscope status and the timer.

## Notes

- `x-device-key` is shown once and only its bcrypt hash is stored. If lost,
  deactivate the device and register a new one.
- A session stays open until the manikin calls `/complete`, so reopening a
  mode screen reuses the open session instead of creating duplicates.
- Telemetry is relayed live over socket.io and not stored per tick; only
  steps, final metrics and alert events are written to the database.
