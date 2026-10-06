// SMArT - procedure step engine + alert detection (pure C++, no Arduino
// dependencies, so it is unit-tested on a PC: see test_steps.cpp).
//
// Turns the manikin's live sensor state into "step N completed" events for the
// 11 fixed procedure steps, and into alerts (the buzzer + app alerts).
//
//   1  Position yourself ................ no sensor  -> assumed (with step 3)
//   2  Sniffing position ................ IMU head tilt, laryngoscope in
//   3  Introduce laryngoscope (right) ... LDR
//   4  Sweep tongue to the left ......... no sensor  -> assumed (with step 9)
//   5  Tip in vallecula ................. no sensor yet (next hardware version) -> assumed
//   6  Do not press on teeth ............ teeth push-button
//   7  Sufficient force ................. no sensor  -> assumed (unless liftForcePsi is given)
//   8  See the vocal cords .............. no sensor  -> assumed (with step 9)
//   9  ETT through the vocal cords ...... reed switches: lung path = correct, food path = wrong
//   10 Insert ETT to 21 cm (F) / 23 cm (M) reed switches (depth)
//   11 Remove stylet .................... reed switch, reverse count
#pragma once
#include <stdint.h>
#include <math.h>
#include "smart_alerts.h"

// 1 = credit the steps that have no sensor from the steps around them (they are
// flagged "assumed" in the app). 0 = only credit what a sensor really saw.
#ifndef SMART_INFER_UNSENSED_STEPS
#define SMART_INFER_UNSENSED_STEPS 1
#endif
#ifndef SMART_MIN_LIFT_PSI
#define SMART_MIN_LIFT_PSI 1.0f
#endif
#ifndef SMART_MAX_LIFT_PSI
#define SMART_MAX_LIFT_PSI 22.0f
#endif
#define SMART_NO_STYLET_SENSOR (-2)

struct SmartInputs {
  bool  laryngoscopePresent = false;  // set by smart_cloud.h from the LDR
  bool  toolDetected   = false;
  bool  teethSafe      = true;        // false while the teeth push-button is pressed
  bool  wrongPath      = false;       // reed switch: food path (oesophagus)
  bool  correctPath    = false;       // reed switch: lung path (trachea)
  bool  headCorrect    = false;       // IMU head tilt inside the sniffing-position window
  int   depthIndex     = -1;          // reed-switch depth index, -1 = tube not inserted
  int   designatedIndex = 0;          // index that means 21 cm (F) / 23 cm (M)
  float depthCm        = 0;
  float headAngle      = 0;
  int   imuCalib       = 0;
  float airflow        = 0;
  float liftForcePsi   = NAN;         // NAN = no lift-force sensor fitted
  // Stylet reed-switch chain: index of the switch the stylet tip is at while it is
  // inside the tube (>= 0), and -1 once it has been counted all the way back out.
  // Keep the LAST reached index while between two switches (like depthIndex does).
  int   styletIndex    = SMART_NO_STYLET_SENSOR;
};

class SmartStepEngine {
 public:
  void reset() {
    done_ = inferred_ = 0; alerts_ = 0;
    teethTouched_ = sawLaryngoscope_ = intubated_ = styletRemoved_ = styletSeen_ = false;
    peakLift_ = NAN;
    armed_ = false;
    prevWrong_ = prevCorrect_ = prevOver_ = prevPresent_ = false; prevTeethSafe_ = true;
  }

  uint16_t done() const { return done_; }                 // bit (n-1) set = step n completed
  uint16_t inferredMask() const { return inferred_; }     // steps credited without a sensor
  bool intubated() const { return intubated_; }           // step 10: tube at designated depth
  bool styletRemoved() const { return styletRemoved_; }   // step 11
  bool teethTouched() const { return teethTouched_; }
  bool sawLaryngoscope() const { return sawLaryngoscope_; }
  float peakLiftForce() const { return peakLift_; }       // NAN if never measured
  uint8_t takeAlerts() { uint8_t a = alerts_; alerts_ = 0; return a; }  // alerts raised since last call

  // Feed the latest sensor state; returns the steps newly completed by it.
  //
  // After reset() the engine stays idle until the manikin is EMPTY (no laryngoscope,
  // no tube) once: otherwise a tube left in from the previous attempt would instantly
  // "complete" the next one.
  uint16_t update(const SmartInputs& in) {
    const bool empty = !in.laryngoscopePresent && in.depthIndex < 0 && !in.wrongPath && !in.correctPath;
    if (!armed_) {
      if (!empty) return 0;
      armed_ = true;
      prevTeethSafe_ = in.teethSafe;
    }

    uint16_t before = done_;
    const bool inMouth = in.laryngoscopePresent || in.depthIndex >= 0;

    if (in.laryngoscopePresent) sawLaryngoscope_ = true;
    if (!in.teethSafe && inMouth && !intubated_) teethTouched_ = true;
    if (!isnan(in.liftForcePsi) && in.laryngoscopePresent) {
      if (isnan(peakLift_) || in.liftForcePsi > peakLift_) peakLift_ = in.liftForcePsi;
    }

    // ---- Alerts (edges only: one alert per event, re-armed when the condition clears)
    if (in.wrongPath && !prevWrong_) raise(SMART_ALERT_WRONG_PATH);
    if (in.correctPath && !in.wrongPath && !prevCorrect_) raise(SMART_ALERT_CORRECT_PATH);
    if (!in.teethSafe && prevTeethSafe_ && inMouth) raise(SMART_ALERT_TEETH);
    const bool over = in.depthIndex >= 0 && in.depthIndex > in.designatedIndex;
    if (over && !prevOver_) raise(SMART_ALERT_OVER_DEPTH);
    if (in.laryngoscopePresent && !prevPresent_ && !in.headCorrect) raise(SMART_ALERT_HEAD_POSITION);
    prevWrong_ = in.wrongPath; prevCorrect_ = in.correctPath && !in.wrongPath;
    prevOver_ = over; prevPresent_ = in.laryngoscopePresent; prevTeethSafe_ = in.teethSafe;

    // ---- Sensed steps
    if (in.laryngoscopePresent) {
      mark(3);                                           // 3  LDR
      if (in.headCorrect) mark(2);                       // 2  IMU, while the laryngoscope is in
    }
    if (in.depthIndex >= 0 && sawLaryngoscope_ && !teethTouched_) mark(6);    // 6  teeth button never pressed
    if (!isnan(peakLift_) && peakLift_ >= SMART_MIN_LIFT_PSI && peakLift_ <= SMART_MAX_LIFT_PSI) mark(7);
    if (in.correctPath && !in.wrongPath) mark(9);        // 9  lung path reed switch

    if (!intubated_ && in.depthIndex >= 0 && in.depthIndex == in.designatedIndex &&
        in.correctPath && !in.wrongPath) {               // 10 tube at 21 cm / 23 cm
      mark(10);
      intubated_ = true;
      raise(SMART_ALERT_END_POINT);
    }

    if (in.styletIndex >= 0) styletSeen_ = true;
    if (intubated_ && !styletRemoved_ && styletSeen_ && in.styletIndex == -1) {  // 11 reverse count finished
      mark(11);
      styletRemoved_ = true;
      raise(SMART_ALERT_PROCESS_COMPLETE);
    }

    // ---- Steps with no sensor: credited from the sensed steps around them
    #if SMART_INFER_UNSENSED_STEPS
    if (has(3)) infer(1);
    if (has(3) && has(9)) { infer(4); infer(5); infer(8); }
    if (has(9) && isnan(peakLift_)) infer(7);            // only when there is no force sensor at all
    #endif

    return (uint16_t)(done_ & ~before);
  }

 private:
  uint16_t done_ = 0, inferred_ = 0;
  uint8_t alerts_ = 0;
  bool teethTouched_ = false, sawLaryngoscope_ = false, intubated_ = false;
  bool styletRemoved_ = false, styletSeen_ = false, armed_ = false;
  bool prevWrong_ = false, prevCorrect_ = false, prevOver_ = false, prevPresent_ = false, prevTeethSafe_ = true;
  float peakLift_ = NAN;
  bool has(int n) const { return (done_ >> (n - 1)) & 1u; }
  void mark(int n) { done_ |= (uint16_t)(1u << (n - 1)); }
  void infer(int n) { if (!has(n)) { mark(n); inferred_ |= (uint16_t)(1u << (n - 1)); } }
  void raise(uint8_t a) { alerts_ |= a; }
};

// Banner shown at the top of the Coach / Check screens.
// type: "wrong" (red) | "complete" (green; also what stops the app's intubation timer) | "progress"
inline void smartBanner(const SmartInputs& in, bool intubated, bool styletRemoved,
                        const char** type, const char** msg) {
  const bool inMouth = in.laryngoscopePresent || in.depthIndex >= 0;
  if (in.wrongPath)                                  { *type = "wrong"; *msg = "WRONG PATH - FOOD PIPE"; return; }
  if (in.depthIndex >= 0 && in.depthIndex > in.designatedIndex) { *type = "wrong"; *msg = "TUBE TOO DEEP"; return; }
  if (!in.teethSafe && inMouth && !intubated)        { *type = "wrong"; *msg = "PRESSURE ON TEETH"; return; }
  if (styletRemoved)                                 { *type = "complete"; *msg = "PROCEDURE COMPLETE"; return; }
  if (intubated)                                     { *type = "complete"; *msg = "TUBE AT DEPTH - REMOVE STYLET"; return; }
  *type = "progress";
  *msg = inMouth ? "IN PROGRESS" : "WAITING FOR LARYNGOSCOPE";
}
