// SMArT cloud link for the ESP32 manikin.
//
//   setup():  smartCloudBegin();
//   loop():   fill a SmartInputs from your sensors, then smartCloudLoop(in);
//
// What it does for you:
//   * reads the laryngoscope LDR and drives the alert buzzer  (always, even offline)
//   * works out the 11 procedure steps and the alerts          (smart_steps.h)
//   * on a SECOND CPU TASK: joins WiFi, asks the backend which session this manikin
//     is working on, and sends live telemetry, step events, alerts and the final
//     /complete. Network trouble can therefore never stall your sensors or the buzzer.
//
// Needs only the ESP32 Arduino core (WiFi, HTTPClient, FreeRTOS).
// Copy smart_config.example.h to smart_config.h first.
#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <stdio.h>
#include <string.h>
#include "smart_config.h"
#include "smart_steps.h"
#include "smart_hw.h"

#define SMART_TELEMETRY_MS   300UL    // live data rate while a session is active
#define SMART_POLL_IDLE_MS   2000UL   // ask for a session this often while idle
#define SMART_POLL_BUSY_MS   5000UL   // ...and this often during a session
#define SMART_HTTP_TIMEOUT   2000     // ms (only the network task waits on this)
#define SMART_BACKOFF_MS     3000UL   // pause after a failed request
#ifndef SMART_FINISH_HOLD_MS
#define SMART_FINISH_HOLD_MS 2000UL   // after stylet removal, wait this long, then close the attempt
#endif
#ifndef SMART_STYLET_WAIT_MS
#define SMART_STYLET_WAIT_MS 30000UL  // tube at depth but stylet never reported out -> close the attempt after this
#endif
#ifndef SMART_ABORT_HOLD_MS
#define SMART_ABORT_HOLD_MS  20000UL  // laryngoscope out this long, never intubated -> attempt abandoned
#endif

namespace smart_internal {

// ---- State shared between your loop() and the network task (guarded by `mux`) ----
struct Shared {
  char     sid[48];          // current session id ("" = idle); written by the network task
  uint32_t gen;              // bumps whenever the session changes or ends
  SmartInputs in;            // latest inputs
  bool     intubated, styletRemoved;
  float    peakLift;
  uint16_t pendingSteps, pendingInferred;
  uint8_t  pendingAlerts;
  bool     complete;         // loop() asks the network task to close the attempt
};
Shared sh = {};
portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

SmartStepEngine   engine;
SmartBuzzerPlayer buzzer;
SmartLdr          ldr;
bool              buzzerOn = false;
uint32_t          lastGen = 0;
unsigned long     intubatedAt = 0, styletAt = 0, absentSince = 0;

// Network-task only
unsigned long lastPoll = 0, lastTelemetry = 0, lastWifiTry = 0, backoffUntil = 0;

inline void lock()   { portENTER_CRITICAL(&mux); }
inline void unlock() { portEXIT_CRITICAL(&mux); }

// ---- HTTP (network task only) -------------------------------------------------
// Returns the HTTP status, or <0 on a network error. For GET the body goes to `out`.
int request(bool post, const char* path, const char* body, char* out, size_t outLen) {
  char url[200];
  snprintf(url, sizeof(url), "%s%s", SMART_BACKEND_HOST, path);
  HTTPClient http;
  http.setConnectTimeout(SMART_HTTP_TIMEOUT);
  http.setTimeout(SMART_HTTP_TIMEOUT);
  if (!http.begin(url)) return -2;
  http.addHeader("x-device-id", SMART_DEVICE_ID);
  http.addHeader("x-device-key", SMART_DEVICE_KEY);
  int code;
  if (post) {
    http.addHeader("Content-Type", "application/json");
    code = http.POST((uint8_t*)body, strlen(body));
  } else {
    code = http.GET();
    if (code == 200 && out && outLen) {
      String s = http.getString();
      strncpy(out, s.c_str(), outLen - 1);
      out[outLen - 1] = 0;
    }
  }
  http.end();
  if (code == 401) Serial.println("[SMArT] backend rejected the device ID/key (401) - re-check smart_config.h / is the device active?");
  if (code < 200 || code >= 300) backoffUntil = millis() + SMART_BACKOFF_MS;
  return code;
}

void dropSession() {          // the backend says this session is gone / not ours
  lock();
  sh.sid[0] = 0; sh.gen++; sh.complete = false;
  sh.pendingSteps = sh.pendingInferred = 0; sh.pendingAlerts = 0;
  unlock();
}

// Reply is {"sessionId":"<uuid>"} or {"sessionId":null}
void pollSession() {
  char resp[160] = "";
  int code = request(false, "/api/esp32/sessions/active", nullptr, resp, sizeof(resp));
  if (code != 200) return;                         // network trouble: keep the current session
  const char* k = strstr(resp, "\"sessionId\":");
  if (!k) return;
  k += 12;
  while (*k == ' ') k++;
  char id[48] = "";
  if (*k == '"') {
    k++;
    size_t n = 0;
    while (*k && *k != '"' && n < sizeof(id) - 1) id[n++] = *k++;
    id[n] = 0;
  }                                                // else: null -> idle
  lock();
  bool changed = strcmp(id, sh.sid) != 0;
  if (changed) {
    strncpy(sh.sid, id, sizeof(sh.sid) - 1);
    sh.sid[sizeof(sh.sid) - 1] = 0;
    sh.gen++;
    sh.complete = false;
    sh.pendingSteps = sh.pendingInferred = 0; sh.pendingAlerts = 0;
  }
  unlock();
  if (changed) Serial.printf("[SMArT] session -> %s\n", id[0] ? id : "(idle)");
}

void netStep() {
  unsigned long now = millis();
  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastWifiTry > 10000UL) { lastWifiTry = now; WiFi.reconnect(); }
    return;
  }
  if (now < backoffUntil) return;

  char sid[48]; SmartInputs in; uint16_t steps, inferred; uint8_t alerts; float peak; bool complete, intub, stylet;
  lock();
  memcpy(sid, sh.sid, sizeof(sid));
  in = sh.in; steps = sh.pendingSteps; inferred = sh.pendingInferred; alerts = sh.pendingAlerts;
  peak = sh.peakLift; complete = sh.complete; intub = sh.intubated; stylet = sh.styletRemoved;
  unlock();

  if (now - lastPoll > (sid[0] ? SMART_POLL_BUSY_MS : SMART_POLL_IDLE_MS)) {
    lastPoll = now;
    pollSession();
    return;
  }
  if (!sid[0]) return;                             // idle: nothing to report

  char path[120], body[480];

  // 1. Step events, one per round trip, lowest step first
  if (steps) {
    int n = 1;
    while (!(steps & (1u << (n - 1)))) n++;
    snprintf(path, sizeof(path), "/api/esp32/sessions/%s/steps", sid);
    const bool inf = (inferred >> (n - 1)) & 1u;
    if (n == 7 && !isnan(peak) && !inf) snprintf(body, sizeof(body), "{\"stepNo\":7,\"metricValue\":%.2f,\"inferred\":false}", peak);
    else snprintf(body, sizeof(body), "{\"stepNo\":%d,\"inferred\":%s}", n, inf ? "true" : "false");
    int code = request(true, path, body, nullptr, 0);
    if (code >= 200 && code < 300) {
      lock(); sh.pendingSteps &= ~(1u << (n - 1)); sh.pendingInferred &= ~(1u << (n - 1)); unlock();
    } else if (code == 409 || code == 404) dropSession();
    return;
  }

  // 2. Live telemetry (immediately when an alert is waiting)
  if (alerts || now - lastTelemetry > SMART_TELEMETRY_MS) {
    lastTelemetry = now;
    const char *bannerType, *bannerMsg;
    smartBanner(in, intub, stylet, &bannerType, &bannerMsg);
    uint8_t bit = 0;
    for (int i = 0; i < SMART_ALERT_COUNT && !bit; i++) if (alerts & (1u << i)) bit = (uint8_t)(1u << i);
    char alertField[48] = "";
    if (bit) snprintf(alertField, sizeof(alertField), ",\"alertEvent\":\"%s\"", smartAlertName(bit));
    snprintf(path, sizeof(path), "/api/esp32/sessions/%s/telemetry", sid);
    snprintf(body, sizeof(body),
      "{\"toolDetected\":%s,\"laryngoscopePresent\":%s,\"teethSafe\":%s,\"depthCm\":%.1f,"
      "\"wrongPath\":%s,\"correctPath\":%s,\"headAngle\":%.1f,\"headCorrect\":%s,"
      "\"imuCalib\":%d,\"airflow\":%.2f,\"bannerMsg\":\"%s\",\"bannerType\":\"%s\"%s}",
      in.toolDetected ? "true" : "false", in.laryngoscopePresent ? "true" : "false",
      in.teethSafe ? "true" : "false", in.depthCm,
      in.wrongPath ? "true" : "false", in.correctPath ? "true" : "false",
      in.headAngle, in.headCorrect ? "true" : "false", in.imuCalib, in.airflow,
      bannerMsg, bannerType, alertField);
    int code = request(true, path, body, nullptr, 0);
    if (code >= 200 && code < 300) { if (bit) { lock(); sh.pendingAlerts &= ~bit; unlock(); } }
    else if (code == 409 || code == 404) dropSession();
    return;
  }

  // 3. Close the attempt (only once every step has been delivered)
  if (complete) {
    snprintf(path, sizeof(path), "/api/esp32/sessions/%s/complete", sid);
    // Total time to intubate is measured by the server (laryngoscope in -> tube at depth).
    if (!isnan(peak)) snprintf(body, sizeof(body), "{\"laryngoscopeLiftForce\":%.2f}", peak);
    else strcpy(body, "{}");
    int code = request(true, path, body, nullptr, 0);
    if ((code >= 200 && code < 300) || code == 409 || code == 404) {
      Serial.println("[SMArT] attempt reported as complete");
      dropSession();
    }
  }
}

void netTask(void*) {
  for (;;) {
    netStep();
    vTaskDelay(pdMS_TO_TICKS(15));
  }
}

}  // namespace smart_internal

// ---- Public API ----------------------------------------------------------------
inline void smartCloudBegin() {
  using namespace smart_internal;
  ldr.begin();
  smartBuzzerBegin();
  engine.reset();

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(SMART_WIFI_SSID, SMART_WIFI_PASSWORD);
  Serial.print("[SMArT] connecting to WiFi");
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) { delay(300); Serial.print("."); }
  if (WiFi.status() == WL_CONNECTED) { Serial.print(" connected, IP "); Serial.println(WiFi.localIP()); }
  else Serial.println(" not connected yet (keeps retrying in the background; sensors and buzzer work offline)");

  xTaskCreatePinnedToCore(netTask, "smart_net", 8192, nullptr, 1, nullptr, 0);
}

// Call every loop(). Never blocks. `in` comes from your sensors; the laryngoscope
// field is filled in here from the LDR.
inline void smartCloudLoop(SmartInputs in) {
  using namespace smart_internal;
  const unsigned long now = millis();
  in.laryngoscopePresent = ldr.update(now);

  // A new (or ended) session = a fresh attempt
  lock(); uint32_t gen = sh.gen; bool active = sh.sid[0] != 0; unlock();
  if (gen != lastGen) {
    lastGen = gen;
    engine.reset();
    intubatedAt = styletAt = absentSince = 0;
  }

  const uint16_t newSteps = engine.update(in);
  const uint8_t alerts = engine.takeAlerts();

  // Buzzer: immediate and local - works with no WiFi and no session
  if (alerts) {
    buzzer.trigger(alerts, now);
    for (int i = 0; i < SMART_ALERT_COUNT; i++) if (alerts & (1u << i)) Serial.printf("[SMArT] alert: %s\n", smartAlertName((uint8_t)(1u << i)));
  }
  bool on = buzzer.update(now);
  if (on != buzzerOn) { buzzerOn = on; smartBuzzerSet(on); }

  // Hand the new facts to the network task
  lock();
  sh.in = in;
  sh.intubated = engine.intubated();
  sh.styletRemoved = engine.styletRemoved();
  sh.peakLift = engine.peakLiftForce();
  if (sh.sid[0]) {
    sh.pendingSteps |= newSteps;
    sh.pendingInferred |= (uint16_t)(newSteps & engine.inferredMask());
    sh.pendingAlerts |= alerts;
  }
  unlock();

  // When is the attempt over?
  //   stylet out (step 11)  -> a moment later, with all steps delivered
  //   tube at depth but stylet never reported out -> after SMART_STYLET_WAIT_MS
  //   laryngoscope taken out again and never intubated -> after SMART_ABORT_HOLD_MS
  if (!active) return;
  if (engine.intubated() && !intubatedAt) intubatedAt = now;
  if (engine.styletRemoved() && !styletAt) styletAt = now;
  if (in.laryngoscopePresent) absentSince = 0;
  else if (engine.sawLaryngoscope() && !absentSince) absentSince = now;

  const bool finish =
      (styletAt && now - styletAt > SMART_FINISH_HOLD_MS) ||
      (engine.intubated() && intubatedAt && now - intubatedAt > SMART_STYLET_WAIT_MS) ||
      (!engine.intubated() && absentSince && now - absentSince > SMART_ABORT_HOLD_MS);
  if (finish) { lock(); sh.complete = true; unlock(); }
}
