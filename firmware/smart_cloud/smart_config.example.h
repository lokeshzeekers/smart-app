// Copy this file to smart_config.h and fill it in. smart_config.h is
// git-ignored so your WiFi password and device key never reach GitHub.
#pragma once

// --- From Admin dashboard -> Manikins -> "+ Register a manikin" (shown ONCE) ---
#define SMART_DEVICE_ID    "SMART-XXXXXXXX"
#define SMART_DEVICE_KEY   "paste-the-generated-key"

// Where the backend lives. Never "localhost" - the manikin is a different machine.
//   production (HTTPS, behind the Caddy server from DEPLOYMENT.md):  "https://smart.example.com"
//   bench test on your own network (plain HTTP to a dev backend):    "http://192.168.1.50:4000"
// With https:// the traffic is encrypted. By default the server's identity is NOT checked;
// to check it, paste your certificate authority as a PEM string here, e.g.
//   #define SMART_ROOT_CA "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n"
// (for a Let's Encrypt domain that is the "ISRG Root X1" certificate - see CLOUD_INTEGRATION.md).
#define SMART_BACKEND_HOST "https://smart.example.com"

#define SMART_WIFI_SSID     "YourLabWiFi"
#define SMART_WIFI_PASSWORD "YourWiFiPassword"

// --- Laryngoscope LDR module (step 3) ---
#define SMART_LDR_PIN            34     // ADC1 pin (32-39 on ESP32; 1-10 on ESP32-S3). ADC2 stops working with WiFi on
#define SMART_LDR_ANALOG         1      // 1 = AO pin (analogRead), 0 = DO pin (digitalRead)
#define SMART_LDR_THRESHOLD      2000   // analog: 0..4095 - set from the serial readout (see README)
#define SMART_LDR_HYSTERESIS     150    // analog: dead band so it doesn't flicker
#define SMART_LDR_PRESENT_WHEN_HIGH 0   // 1 if the reading goes UP when the laryngoscope is in
#define SMART_LDR_DEBOUNCE_MS    200    // a change must hold this long before it counts
#define SMART_LDR_DEBUG          1      // 1 = print the raw reading once a second (for calibration)

// --- Buzzer (alerts) ---
#define SMART_BUZZER_PIN         25     // -1 = no buzzer
#define SMART_BUZZER_ACTIVE      1      // 1 = active buzzer (beeps by itself when powered), 0 = passive (needs a tone)
#define SMART_BUZZER_ACTIVE_LOW  0      // 1 if the buzzer module sounds when the pin is LOW
#define SMART_BUZZER_FREQ        2700   // passive buzzer only: tone in Hz

// --- Behaviour (optional, defaults shown) ---
// #define SMART_INFER_UNSENSED_STEPS 1  // 0 = never credit steps that have no sensor
// #define SMART_FINISH_HOLD_MS    2000   // after stylet removal, wait this long then close the attempt
// #define SMART_STYLET_WAIT_MS   30000   // after the tube is at depth, wait this long for stylet removal, then close
// #define SMART_ABORT_HOLD_MS    20000   // laryngoscope out this long without intubation -> attempt abandoned
