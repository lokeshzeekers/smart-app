// SMArT - hardware drivers: laryngoscope LDR (step 3) and the alert buzzer.
#pragma once
#include <Arduino.h>
#include "smart_config.h"

#ifndef SMART_LDR_DEBUG
#define SMART_LDR_DEBUG 0
#endif
#ifndef SMART_BUZZER_PIN
#define SMART_BUZZER_PIN (-1)
#endif
#ifndef SMART_BUZZER_ACTIVE
#define SMART_BUZZER_ACTIVE 1
#endif
#ifndef SMART_BUZZER_ACTIVE_LOW
#define SMART_BUZZER_ACTIVE_LOW 0
#endif
#ifndef SMART_BUZZER_FREQ
#define SMART_BUZZER_FREQ 2700
#endif
#define SMART_BUZZER_LEDC_CH 7   // only used with a passive buzzer on core 2.x

// ---- Laryngoscope LDR -------------------------------------------------------
class SmartLdr {
 public:
  void begin() { pinMode(SMART_LDR_PIN, INPUT); }
  // true = laryngoscope present. Debounced, and (analog) with hysteresis.
  bool update(unsigned long now) {
    bool raw = readRaw(now);
    if (raw != rawLast_) { rawLast_ = raw; changedAt_ = now; }
    if (raw != state_ && now - changedAt_ >= SMART_LDR_DEBOUNCE_MS) state_ = raw;
    return state_;
  }
 private:
  bool state_ = false, rawLast_ = false, high_ = false;
  unsigned long changedAt_ = 0, lastPrint_ = 0;
  bool readRaw(unsigned long now) {
#if SMART_LDR_ANALOG
    int v = analogRead(SMART_LDR_PIN);
  #if SMART_LDR_DEBUG
    if (now - lastPrint_ > 1000) { lastPrint_ = now; Serial.printf("[LDR] raw=%d threshold=%d -> %s\n", v, SMART_LDR_THRESHOLD, state_ ? "PRESENT" : "absent"); }
  #endif
    if (v >= SMART_LDR_THRESHOLD + SMART_LDR_HYSTERESIS) high_ = true;
    else if (v <= SMART_LDR_THRESHOLD - SMART_LDR_HYSTERESIS) high_ = false;
    return SMART_LDR_PRESENT_WHEN_HIGH ? high_ : !high_;
#else
    (void)now;
    int d = digitalRead(SMART_LDR_PIN);
    return SMART_LDR_PRESENT_WHEN_HIGH ? (d == HIGH) : (d == LOW);
#endif
  }
};

// ---- Buzzer -----------------------------------------------------------------
inline void smartBuzzerBegin() {
#if SMART_BUZZER_PIN >= 0
  #if SMART_BUZZER_ACTIVE
  pinMode(SMART_BUZZER_PIN, OUTPUT);
  digitalWrite(SMART_BUZZER_PIN, SMART_BUZZER_ACTIVE_LOW ? HIGH : LOW);
  #elif ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(SMART_BUZZER_PIN, SMART_BUZZER_FREQ, 8);
  ledcWriteTone(SMART_BUZZER_PIN, 0);
  #else
  ledcSetup(SMART_BUZZER_LEDC_CH, SMART_BUZZER_FREQ, 8);
  ledcAttachPin(SMART_BUZZER_PIN, SMART_BUZZER_LEDC_CH);
  ledcWriteTone(SMART_BUZZER_LEDC_CH, 0);
  #endif
#endif
}

inline void smartBuzzerSet(bool on) {
#if SMART_BUZZER_PIN >= 0
  #if SMART_BUZZER_ACTIVE
  digitalWrite(SMART_BUZZER_PIN, (on != (bool)SMART_BUZZER_ACTIVE_LOW) ? HIGH : LOW);
  #elif ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWriteTone(SMART_BUZZER_PIN, on ? SMART_BUZZER_FREQ : 0);
  #else
  ledcWriteTone(SMART_BUZZER_LEDC_CH, on ? SMART_BUZZER_FREQ : 0);
  #endif
#else
  (void)on;
#endif
}
