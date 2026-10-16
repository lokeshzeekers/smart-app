#include "Arduino.h"
#include "WiFi.h"
#include "HTTPClient.h"
#include "smart_config.h"
#include <chrono>
#include <thread>
#include <cstdarg>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>

static auto T0 = std::chrono::steady_clock::now();
unsigned long millis() { return (unsigned long)std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - T0).count(); }
void delay(int ms) { std::this_thread::sleep_for(std::chrono::milliseconds(ms)); }
void vTaskDelay(TickType_t ms) { delay((int)ms); }
std::atomic<int> g_ldr{3000};
SerialT Serial;
WiFiT WiFi;
bool g_completed = false;

void SerialT::printf(const char* f, ...) { va_list a; va_start(a, f); std::printf("%7lu ", millis()); std::vprintf(f, a); va_end(a); std::fflush(stdout); }
void SerialT::println(const char* s) { std::printf("%s\n", s); std::fflush(stdout); if (std::strstr(s, "attempt reported as complete")) g_completed = true; }

static bool g_buzz = false;
void digitalWrite(int pin, int v) {
  if (pin == SMART_BUZZER_PIN && (v == HIGH) != g_buzz) { g_buzz = (v == HIGH); std::printf("%7lu BUZZER %s\n", millis(), g_buzz ? "ON" : "off"); std::fflush(stdout); }
}
BaseType_t xTaskCreatePinnedToCore(TaskFunction_t fn, const char*, uint32_t, void* arg, UBaseType_t, TaskHandle_t*, BaseType_t) { std::thread(fn, arg).detach(); return 1; }

bool HTTPClient::begin(const char* url) {
  std::string u(url);
  if (u.rfind("http://", 0) != 0) return false;   // no TLS on the PC harness
  u = u.substr(7);
  size_t slash = u.find('/');
  std::string hp = u.substr(0, slash);
  path = slash == std::string::npos ? "/" : u.substr(slash);
  size_t c = hp.find(':');
  host = hp.substr(0, c);
  port = c == std::string::npos ? 80 : atoi(hp.c_str() + c + 1);
  hdrs.clear();
  return true;
}
int HTTPClient::send(const char* method, const std::string& payload) {
  int fd = socket(AF_INET, SOCK_STREAM, 0);
  if (fd < 0) return -1;
  timeval tv{2, 0};
  setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof tv);
  sockaddr_in a{};
  a.sin_family = AF_INET; a.sin_port = htons(port); inet_pton(AF_INET, host.c_str(), &a.sin_addr);
  if (connect(fd, (sockaddr*)&a, sizeof a) < 0) { close(fd); return -1; }
  std::string req = std::string(method) + " " + path + " HTTP/1.1\r\nHost: " + host + "\r\nConnection: close\r\n" + hdrs;
  if (std::string(method) == "POST") req += "Content-Length: " + std::to_string(payload.size()) + "\r\n";
  req += "\r\n" + payload;
  if (write(fd, req.data(), req.size()) < 0) { close(fd); return -1; }
  std::string resp; char buf[1024]; ssize_t n;
  while ((n = read(fd, buf, sizeof buf)) > 0) resp.append(buf, (size_t)n);
  close(fd);
  if (resp.size() < 12) return -1;
  int code = atoi(resp.c_str() + 9);
  size_t he = resp.find("\r\n\r\n");
  body = he == std::string::npos ? "" : resp.substr(he + 4);
  return code;
}
