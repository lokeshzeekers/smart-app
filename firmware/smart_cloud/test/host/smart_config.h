#pragma once
// Test configuration for the PC harness (the real smart_config.h is git-ignored).
// The values the tests vary are overridable with -D flags.
#define SMART_DEVICE_ID    "SMART-TEST0001"
#define SMART_DEVICE_KEY   "test-device-key-123"
#define SMART_BACKEND_HOST "http://127.0.0.1:4100"
#define SMART_WIFI_SSID     "x"
#define SMART_WIFI_PASSWORD "y"
#define SMART_LDR_PIN 34
#ifndef SMART_LDR_ANALOG
#define SMART_LDR_ANALOG 1
#endif
#define SMART_LDR_THRESHOLD 2000
#define SMART_LDR_HYSTERESIS 150
#define SMART_LDR_PRESENT_WHEN_HIGH 0
#define SMART_LDR_DEBOUNCE_MS 200
#define SMART_LDR_DEBUG 0
#ifndef SMART_BUZZER_PIN
#define SMART_BUZZER_PIN 25
#endif
#ifndef SMART_BUZZER_ACTIVE
#define SMART_BUZZER_ACTIVE 1
#endif
#define SMART_BUZZER_ACTIVE_LOW 0
#define SMART_BUZZER_FREQ 2700
#define SMART_FINISH_HOLD_MS 1500UL
