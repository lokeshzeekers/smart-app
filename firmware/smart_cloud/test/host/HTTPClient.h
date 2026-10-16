#pragma once
#include "WiFiClientSecure.h"
// Minimal blocking HTTP/1.1 client over POSIX sockets (http://host:port/path only; https is
// declared so the code compiles, but the PC harness can't do TLS and reports failure).
struct HTTPClient {
  std::string host, path, hdrs, body;
  int port = 80;
  void setConnectTimeout(int) {}
  void setTimeout(int) {}
  void setReuse(bool) {}
  bool begin(const char* url);
  bool begin(WiFiClient&, const String& url) { return begin(url.c_str()); }
  void addHeader(const char* k, const char* v) { hdrs += std::string(k) + ": " + v + "\r\n"; }
  int POST(uint8_t* data, size_t len) { return send("POST", std::string((char*)data, len)); }
  int GET() { return send("GET", ""); }
  String getString() { return String(body); }
  void end() {}
  int send(const char* method, const std::string& payload);
};
