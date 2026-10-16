#pragma once
#include "Arduino.h"
struct WiFiT {
  void mode(int) {}
  void setAutoReconnect(bool) {}
  void begin(const char*, const char*) {}
  int status() { return 3; }
  String localIP() { return String("127.0.0.1"); }
  void reconnect() {}
};
extern WiFiT WiFi;
struct WiFiClient { void stop() {} };
