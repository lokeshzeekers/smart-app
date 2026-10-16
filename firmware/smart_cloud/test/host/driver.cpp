// Plays ONE simulated attempt through the REAL firmware code (see e2e.js for the backend side).
#include "smart_cloud.h"
extern std::atomic<int> g_ldr;
extern bool g_completed;
int main() {
  setvbuf(stdout, nullptr, _IOLBF, 0);
  smartCloudBegin();
  SmartInputs in; in.designatedIndex = 4;
  const unsigned long start = millis();
  bool done = false;
  while (!done && millis() - start < 40000) {
    const unsigned long t = millis() - start;
    if (t > 3000) in.headCorrect = true;                                                           // IMU: sniffing position
    if (t > 3500) g_ldr = 1000;                                                                    // LDR: laryngoscope in
    if (t > 4000 && t < 4600) { in.depthIndex = 1; in.wrongPath = true; in.correctPath = false; }  // FOOD path
    if (t >= 4600 && t < 5000) { in.depthIndex = -1; in.wrongPath = false; }                       // pulled back
    if (t >= 5000 && t < 6000) { in.depthIndex = 1; in.correctPath = true; }                       // LUNG path
    if (t >= 6000) { in.depthIndex = 4; in.correctPath = true; }                                   // 21/23 cm
    if (t >= 7000) in.styletIndex = 4;                                                             // stylet in tube
    if (t >= 7500) in.styletIndex = 2;                                                             // reverse count...
    if (t >= 8000) in.styletIndex = -1;                                                            // ...stylet out
    in.depthCm = in.depthIndex >= 0 ? in.depthIndex * 2.0f : 0;
    in.toolDetected = in.depthIndex >= 0;
    smartCloudLoop(in);
    delay(5);
    if (g_completed) { delay(300); done = true; }
  }
  std::printf("driver finished after %lu ms (%s)\n", millis() - start, done ? "attempt completed" : "TIMEOUT");
  return done ? 0 : 1;
}
