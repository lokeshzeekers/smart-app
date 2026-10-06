// SMArT - alert kinds, buzzer patterns and the (hardware-free) buzzer player.
// Pure C++ so it can be unit-tested on a PC (see test_steps.cpp).
#pragma once
#include <stdint.h>

// One bit per alert. The names sent to the backend are in smartAlertName().
enum SmartAlert : uint8_t {
  SMART_ALERT_WRONG_PATH       = 1 << 0,  // tube went down the food pipe (oesophagus)
  SMART_ALERT_CORRECT_PATH     = 1 << 1,  // tube went down the airway (lungs)
  SMART_ALERT_TEETH            = 1 << 2,  // pressure on teeth (button pressed)
  SMART_ALERT_OVER_DEPTH       = 1 << 3,  // tube past the designated depth
  SMART_ALERT_END_POINT        = 1 << 4,  // tube at 21 cm (F) / 23 cm (M)  = step 10
  SMART_ALERT_PROCESS_COMPLETE = 1 << 5,  // stylet removed                 = step 11
  SMART_ALERT_HEAD_POSITION    = 1 << 6   // laryngoscope in, neck not in sniffing position
};
#define SMART_ALERT_COUNT 7

inline const char* smartAlertName(uint8_t bit) {
  switch (bit) {
    case SMART_ALERT_WRONG_PATH:       return "wrong_path";
    case SMART_ALERT_CORRECT_PATH:     return "correct_path";
    case SMART_ALERT_TEETH:            return "teeth_contact";
    case SMART_ALERT_OVER_DEPTH:       return "over_depth";
    case SMART_ALERT_END_POINT:        return "end_point";
    case SMART_ALERT_PROCESS_COMPLETE: return "process_complete";
    case SMART_ALERT_HEAD_POSITION:    return "head_position";
  }
  return "";
}

// Higher = more important. A more important alert interrupts a less important one.
inline uint8_t smartAlertRank(uint8_t bit) {
  switch (bit) {
    case SMART_ALERT_WRONG_PATH:       return 7;
    case SMART_ALERT_TEETH:            return 6;
    case SMART_ALERT_OVER_DEPTH:       return 5;
    case SMART_ALERT_HEAD_POSITION:    return 4;
    case SMART_ALERT_END_POINT:        return 3;
    case SMART_ALERT_PROCESS_COMPLETE: return 2;
    case SMART_ALERT_CORRECT_PATH:     return 1;
  }
  return 0;
}

// Buzzer patterns in ms: on, off, on, off ... terminated by 0.
inline const uint16_t* smartAlertPattern(uint8_t bit) {
  static const uint16_t wrong[]   = {150, 100, 150, 100, 150, 0};  // 3 fast beeps
  static const uint16_t teeth[]   = {600, 0};                      // 1 long beep
  static const uint16_t over[]    = {700, 200, 700, 0};            // 2 long beeps
  static const uint16_t head[]    = {100, 100, 100, 0};            // 2 short beeps
  static const uint16_t endp[]    = {100, 80, 100, 80, 400, 0};    // short, short, long
  static const uint16_t done[]    = {150, 100, 150, 100, 600, 0};  // short, short, long (slower)
  static const uint16_t correct[] = {80, 0};                       // 1 tiny chirp
  switch (bit) {
    case SMART_ALERT_WRONG_PATH:       return wrong;
    case SMART_ALERT_TEETH:            return teeth;
    case SMART_ALERT_OVER_DEPTH:       return over;
    case SMART_ALERT_HEAD_POSITION:    return head;
    case SMART_ALERT_END_POINT:        return endp;
    case SMART_ALERT_PROCESS_COMPLETE: return done;
    case SMART_ALERT_CORRECT_PATH:     return correct;
  }
  return nullptr;
}

// Plays one pattern at a time without ever blocking. trigger() picks the most
// important alert in the mask; update(now) says whether the buzzer is ON now.
class SmartBuzzerPlayer {
 public:
  void trigger(uint8_t mask, unsigned long now) {
    uint8_t best = 0, bestRank = 0;
    for (int i = 0; i < SMART_ALERT_COUNT; i++) {
      uint8_t bit = (uint8_t)(1u << i);
      if ((mask & bit) && smartAlertRank(bit) > bestRank) { best = bit; bestRank = smartAlertRank(bit); }
    }
    if (!best) return;
    update(now);                               // retire a pattern that has already finished
    if (active_ && bestRank < rank_) return;   // something more important is still sounding
    pat_ = smartAlertPattern(best);
    rank_ = bestRank;
    idx_ = 0;
    segEnd_ = now + pat_[0];
    active_ = true;
  }
  bool update(unsigned long now) {
    if (!active_) return false;
    while ((long)(now - segEnd_) >= 0) {
      idx_++;
      if (pat_[idx_] == 0) { active_ = false; return false; }
      segEnd_ += pat_[idx_];
    }
    return (idx_ % 2) == 0;
  }
  bool active() const { return active_; }
 private:
  const uint16_t* pat_ = nullptr;
  uint8_t idx_ = 0, rank_ = 0;
  unsigned long segEnd_ = 0;
  bool active_ = false;
};
