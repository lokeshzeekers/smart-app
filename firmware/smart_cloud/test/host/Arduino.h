#pragma once
// Minimal PC stand-in for the Arduino/ESP32 APIs that smart_cloud.h uses. It lets the REAL
// firmware code compile (all board-core variants) and even run against the real backend
// (see test/run_tests.sh). Not part of the firmware itself.
#include <string>
#include <cstdint>
#include <cstring>
#include <cstdio>
#include <cmath>
#include <mutex>
#include <atomic>
#define HIGH 1
#define LOW 0
#define INPUT 0
#define OUTPUT 1
#define WIFI_STA 1
#define WL_CONNECTED 3
#ifndef ESP_ARDUINO_VERSION_MAJOR
#define ESP_ARDUINO_VERSION_MAJOR 3     // override with -DESP_ARDUINO_VERSION_MAJOR=2 to check old cores
#endif
struct String {
  std::string s;
  String() {}
  String(const char* x) : s(x) {}
  String(const std::string& x) : s(x) {}
  const char* c_str() const { return s.c_str(); }
};
unsigned long millis();
void delay(int ms);
extern std::atomic<int> g_ldr;
inline int analogRead(int) { return g_ldr.load(); }
inline int digitalRead(int) { return 0; }
inline void pinMode(int, int) {}
void digitalWrite(int pin, int v);
#if ESP_ARDUINO_VERSION_MAJOR >= 3
inline bool ledcAttach(uint8_t, uint32_t, uint8_t) { return true; }
inline uint32_t ledcWriteTone(uint8_t, uint32_t) { return 0; }
#else
inline uint32_t ledcSetup(uint8_t, uint32_t, uint8_t) { return 0; }
inline void ledcAttachPin(uint8_t, uint8_t) {}
inline uint32_t ledcWriteTone(uint8_t, uint32_t) { return 0; }
#endif
struct SerialT {
  void print(const char* s) { std::fputs(s, stdout); std::fflush(stdout); }
  void println(const char* s);
  void println(const String& s) { println(s.c_str()); }
  void printf(const char* f, ...) __attribute__((format(printf, 2, 3)));
};
extern SerialT Serial;
typedef void (*TaskFunction_t)(void*);
typedef void* TaskHandle_t;
typedef uint32_t TickType_t;
typedef int BaseType_t;
typedef unsigned UBaseType_t;
struct portMUX_TYPE { std::recursive_mutex m; };
#define portMUX_INITIALIZER_UNLOCKED {}
inline void portENTER_CRITICAL(portMUX_TYPE* p) { p->m.lock(); }
inline void portEXIT_CRITICAL(portMUX_TYPE* p) { p->m.unlock(); }
#define pdMS_TO_TICKS(x) ((TickType_t)(x))
void vTaskDelay(TickType_t ms);
BaseType_t xTaskCreatePinnedToCore(TaskFunction_t fn, const char*, uint32_t, void* arg, UBaseType_t, TaskHandle_t*, BaseType_t);
