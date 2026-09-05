# Connecting the manikin to the SMArT backend

Your current firmware runs its own WiFi Access Point and serves a local
webpage from the ESP32 itself - it never talks to the internet. To show up
live in the SMArT app, it needs to do three new things instead:

1. Join your real WiFi network (STA mode) instead of creating its own AP.
2. Poll the backend to find out which session it should report against
   (no keypad/display needed on the device - the trainee picks the
   manikin from a dropdown on their phone, and the backend just tells the
   device "here's your current job" when it asks).
3. POST the same JSON it already builds today - to the backend instead of
   only serving it on the local page.

## 1. New credentials to add to the firmware

Register the device once via the admin dashboard (Manikins tab ->
"+ Register a manikin"). You'll get two values shown ONE TIME ONLY - save
them immediately:

```cpp
const char* DEVICE_ID  = "SMART-XXXXXXXX";      // x-device-id
const char* DEVICE_KEY = "the-generated-key";   // x-device-key
const char* BACKEND_HOST = "http://<your-server-ip-or-domain>:4000";

const char* WIFI_SSID = "YourLabWiFi";
const char* WIFI_PASSWORD = "YourWiFiPassword";
```

## 2. Replace the WiFi setup in `setup()`

Replace this block:

```cpp
WiFi.mode(WIFI_AP);
WiFi.softAP(AP_SSID, AP_PASSWORD);
```

with:

```cpp
WiFi.mode(WIFI_STA);
WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
Serial.print("Connecting to WiFi");
while (WiFi.status() != WL_CONNECTED) {
  delay(400);
  Serial.print(".");
}
Serial.println();
Serial.print("Connected, IP: ");
Serial.println(WiFi.localIP());
```

You can keep `server.begin()` and the local webpage too if you still want
it for on-bench debugging - it's harmless to run both.

## 3. Add an HTTP helper + active-session polling

Add near the top:

```cpp
#include <HTTPClient.h>

String currentSessionId = "";
unsigned long lastSessionCheck = 0;
unsigned long lastTelemetryPush = 0;

bool httpPostJson(const String& path, const String& body) {
  HTTPClient http;
  http.begin(String(BACKEND_HOST) + path);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-id", DEVICE_ID);
  http.addHeader("x-device-key", DEVICE_KEY);
  int code = http.POST(body);
  http.end();
  return code >= 200 && code < 300;
}

String httpGetJson(const String& path) {
  HTTPClient http;
  http.begin(String(BACKEND_HOST) + path);
  http.addHeader("x-device-id", DEVICE_ID);
  http.addHeader("x-device-key", DEVICE_KEY);
  int code = http.GET();
  String body = code == 200 ? http.getString() : "";
  http.end();
  return body;
}

void checkActiveSession() {
  String resp = httpGetJson("/api/esp32/sessions/active");
  if (resp.length() == 0) return;
  // crude extraction - fine for a single "sessionId" field; swap in
  // ArduinoJson if you want this more robust
  int start = resp.indexOf(':') + 1;
  String val = resp.substring(start, resp.indexOf('}'));
  val.trim();
  if (val == "null") {
    currentSessionId = "";
  } else {
    val.replace("\"", "");
    currentSessionId = val;
  }
}
```

## 4. Call these from `loop()`

Right after your existing `readAllSensors(); runStateMachine();` calls,
add:

```cpp
unsigned long now = millis();

// Find out which session to report to, every 2s while idle
if (currentSessionId == "" && now - lastSessionCheck > 2000) {
  lastSessionCheck = now;
  checkActiveSession();
}

// Push the same live state your local /api/data already builds, every
// ~300ms while a session is active
if (currentSessionId != "" && now - lastTelemetryPush > 300) {
  lastTelemetryPush = now;

  String bannerType = (!teethSafe || wrongPathLatched || currentDepthIndex > DESIGNATED_INDEX)
    ? "wrong"
    : (currentDepthIndex == DESIGNATED_INDEX ? "complete" : "progress");

  String body = "{";
  body += "\"toolDetected\":" + String(toolDetected ? "true" : "false") + ",";
  body += "\"teethSafe\":" + String(teethSafe ? "true" : "false") + ",";
  body += "\"depthCm\":" + String(currentDepthIndex >= 0 ? depthPosition[currentDepthIndex] : 0, 1) + ",";
  body += "\"wrongPath\":" + String(wrongPathLatched ? "true" : "false") + ",";
  body += "\"correctPath\":" + String(correctPathLatched ? "true" : "false") + ",";
  body += "\"headAngle\":" + String(headAngle, 1) + ",";
  body += "\"headCorrect\":" + String((headAngle >= HEAD_ANGLE_MIN && headAngle <= HEAD_ANGLE_MAX) ? "true" : "false") + ",";
  body += "\"imuCalib\":" + String(imuCalibStatus) + ",";
  body += "\"airflow\":" + String(airFlow_slm, 2) + ",";
  body += "\"bannerType\":\"" + bannerType + "\"";
  body += "}";

  httpPostJson("/api/esp32/sessions/" + currentSessionId + "/telemetry", body);
}

// When a session finishes (tube fully removed after reaching depth),
// tell the backend and clear the session so the device goes back to
// polling for the next one
if (currentSessionId != "" && currentState == IDLE && maxDepthIndexReached == -1) {
  httpPostJson("/api/esp32/sessions/" + currentSessionId + "/complete", "{}");
  currentSessionId = "";
}
```

## 5. In the app

1. Trainer/admin logs in -> Admin dashboard -> Manikins tab -> register
   the device, note the ID + key, flash them into the firmware above.
2. Power on the manikin - it joins your WiFi and starts polling.
3. A trainee opens SMArT, picks this manikin from the dropdown on Home
   (only shows up if more than one is registered), taps Coach/Check/
   Certification - this creates a session tagged with that device.
4. Within ~2 seconds the manikin's next poll picks up that session ID
   and starts pushing live telemetry - the trainee's Coach/Check screen
   should light up with real depth/path/angle data within a few hundred
   ms of that.

## Notes

- `BACKEND_HOST` needs to be reachable from the manikin's WiFi network -
  if your backend is only bound to localhost on your dev machine, the
  ESP32 won't be able to reach it. Use your machine's LAN IP (e.g.
  `http://192.168.1.50:4000`) for local testing, or your real server
  domain in production.
- The `x-device-key` is shown once at registration time and only its
  bcrypt hash is stored - if you lose it, deactivate that device from the
  admin dashboard and register a new one.
- The step-by-step "coach dots" (`/api/esp32/sessions/:id/steps`) and
  final summary (`/complete`) were already supported before this change;
  this only adds the missing piece — live telemetry.
