// Host-side unit tests for the step engine, alerts, banner and buzzer player.
//   g++ -std=c++11 -Wall test_steps.cpp -o test_steps && ./test_steps
#include <cstdio>
#include <cstring>
#include "smart_steps.h"
static int fails = 0;
#define CHECK(c) do { if (!(c)) { printf("FAIL line %d: %s\n", __LINE__, #c); fails++; } } while (0)
static bool has(uint16_t m, int n) { return (m >> (n - 1)) & 1u; }

static SmartInputs empty(int designated = 4) { SmartInputs i; i.designatedIndex = designated; return i; }

int main() {
  // ---- A clean attempt, step by step ---------------------------------------
  {
    SmartStepEngine e; SmartInputs in = empty();
    CHECK(e.update(in) == 0 && e.takeAlerts() == 0);                 // empty manikin: armed, nothing happens

    in.laryngoscopePresent = true; in.headCorrect = true;
    uint16_t n = e.update(in);
    CHECK(has(n, 3) && has(n, 2) && has(n, 1) && !has(n, 9));
    CHECK(e.takeAlerts() == 0);                                      // head was right: no head alert
    CHECK(has(e.inferredMask(), 1) && !has(e.inferredMask(), 3));    // 1 assumed, 3 sensed

    in.depthIndex = 1; in.correctPath = true;
    n = e.update(in);
    CHECK(has(n, 6) && has(n, 9) && has(n, 4) && has(n, 5) && has(n, 8) && has(n, 7));
    CHECK(has(e.inferredMask(), 4) && has(e.inferredMask(), 5) && has(e.inferredMask(), 7) && has(e.inferredMask(), 8));
    CHECK(!has(e.inferredMask(), 6) && !has(e.inferredMask(), 9));
    CHECK(e.takeAlerts() == SMART_ALERT_CORRECT_PATH);
    CHECK(!e.intubated());

    in.depthIndex = 4; n = e.update(in);                             // 21/23 cm reached
    CHECK(has(n, 10) && e.intubated() && !has(n, 11));
    CHECK(e.takeAlerts() == SMART_ALERT_END_POINT);

    in.styletIndex = 4; e.update(in);                                // stylet inside
    in.styletIndex = 2; e.update(in); CHECK(!e.styletRemoved());     // counting back
    in.styletIndex = -1; n = e.update(in);                           // reverse count done
    CHECK(has(n, 11) && e.styletRemoved() && e.done() == 0x7FF);
    CHECK(e.takeAlerts() == SMART_ALERT_PROCESS_COMPLETE);
    CHECK(e.update(in) == 0 && e.takeAlerts() == 0);                 // nothing is reported twice
  }

  // ---- Stylet: needs a sensor, and only counts after the tube is at depth ---
  {
    SmartStepEngine e; SmartInputs in = empty(); e.update(in);
    in.laryngoscopePresent = true; in.depthIndex = 4; in.correctPath = true; e.update(in);
    CHECK(e.intubated() && !e.styletRemoved());                      // no stylet sensor wired -> step 11 never invented
    SmartStepEngine f; SmartInputs g = empty(); f.update(g);
    g.styletIndex = 3; f.update(g); g.styletIndex = -1; f.update(g); // stylet out BEFORE the tube is at depth
    CHECK(!f.styletRemoved());
  }

  // ---- Wrong path (food pipe) ----------------------------------------------
  {
    SmartStepEngine e; SmartInputs in = empty(); e.update(in);
    in.laryngoscopePresent = true; in.headCorrect = true; e.update(in); e.takeAlerts();
    in.depthIndex = 2; in.wrongPath = true; e.update(in);
    CHECK((e.takeAlerts() & SMART_ALERT_WRONG_PATH) && !has(e.done(), 9));
    e.update(in); CHECK(e.takeAlerts() == 0);                        // one alert, not one per tick
    in.wrongPath = false; e.update(in); in.wrongPath = true; e.update(in);
    CHECK(e.takeAlerts() & SMART_ALERT_WRONG_PATH);                  // re-armed after it cleared
    in.depthIndex = 4; in.correctPath = true;                        // wrong path still latched
    e.update(in); CHECK(!has(e.done(), 10) && !e.intubated());
  }

  // ---- Teeth push-button ------------------------------------------------------
  {
    SmartStepEngine e; SmartInputs in = empty(); e.update(in);
    in.teethSafe = false; e.update(in);
    CHECK(e.takeAlerts() == 0);                                      // pressing it with nothing in the mouth is ignored
    in.teethSafe = true; in.laryngoscopePresent = true; in.headCorrect = true; e.update(in); e.takeAlerts();
    in.teethSafe = false; e.update(in);
    CHECK(e.takeAlerts() == SMART_ALERT_TEETH && e.teethTouched());
    in.teethSafe = true; in.depthIndex = 1; in.correctPath = true; e.update(in);
    CHECK(!has(e.done(), 6));                                        // pressed on teeth -> step 6 not earned
  }

  // ---- Head position alert ------------------------------------------------------
  {
    SmartStepEngine e; SmartInputs in = empty(); e.update(in);
    in.laryngoscopePresent = true; in.headCorrect = false; e.update(in);
    CHECK(e.takeAlerts() == SMART_ALERT_HEAD_POSITION && !has(e.done(), 2) && has(e.done(), 3));
    in.headCorrect = true; e.update(in); CHECK(has(e.done(), 2));    // fixed later -> step 2 earned
  }

  // ---- Over depth -----------------------------------------------------------------
  {
    SmartStepEngine e; SmartInputs in = empty(); e.update(in);
    in.laryngoscopePresent = true; in.headCorrect = true; in.correctPath = true; in.depthIndex = 5; e.update(in);
    CHECK((e.takeAlerts() & SMART_ALERT_OVER_DEPTH) && !e.intubated());
  }

  // ---- A tube left in from the last attempt must not complete the next one ---------
  {
    SmartStepEngine e; SmartInputs in = empty();
    in.laryngoscopePresent = true; in.depthIndex = 4; in.correctPath = true; in.headCorrect = true;
    CHECK(e.update(in) == 0 && e.takeAlerts() == 0 && e.done() == 0);   // not armed yet
    in = empty(); CHECK(e.update(in) == 0);                              // everything out -> armed
    in.laryngoscopePresent = true; in.headCorrect = true; CHECK(has(e.update(in), 3));
  }

  // ---- Lift-force sensor: measured value decides step 7 --------------------------
  {
    SmartStepEngine e; SmartInputs in = empty(); e.update(in);
    in.laryngoscopePresent = true; in.liftForcePsi = 30; e.update(in);
    in.depthIndex = 4; in.correctPath = true; e.update(in);
    CHECK(!has(e.done(), 7));                                            // too much force
    SmartStepEngine g; SmartInputs h = empty(); g.update(h);
    h.laryngoscopePresent = true; h.liftForcePsi = 15; g.update(h);
    CHECK(has(g.done(), 7) && !has(g.inferredMask(), 7));
  }

  // ---- reset ----------------------------------------------------------------------------
  { SmartStepEngine e; SmartInputs in = empty(); e.update(in); in.laryngoscopePresent = true; e.update(in);
    e.reset(); CHECK(e.done() == 0 && !e.sawLaryngoscope() && e.inferredMask() == 0); }

  // ---- Banner ------------------------------------------------------------------------------
  {
    SmartInputs in = empty(); const char *t, *m;
    smartBanner(in, false, false, &t, &m); CHECK(!strcmp(t, "progress") && !strcmp(m, "WAITING FOR LARYNGOSCOPE"));
    in.wrongPath = true; smartBanner(in, false, false, &t, &m); CHECK(!strcmp(t, "wrong") && !strcmp(m, "WRONG PATH - FOOD PIPE"));
    in.wrongPath = false; smartBanner(in, true, false, &t, &m); CHECK(!strcmp(t, "complete") && !strcmp(m, "TUBE AT DEPTH - REMOVE STYLET"));
    smartBanner(in, true, true, &t, &m); CHECK(!strcmp(t, "complete") && !strcmp(m, "PROCEDURE COMPLETE"));
  }

  // ---- Buzzer player (never blocks, honours priority) -------------------------------------------
  {
    SmartBuzzerPlayer b;
    CHECK(!b.update(0));
    b.trigger(SMART_ALERT_WRONG_PATH, 1000);                             // 150 on, 100 off, 150 on, 100 off, 150 on
    CHECK(b.update(1000) && b.update(1149) && !b.update(1150) && !b.update(1249) && b.update(1250));
    CHECK(b.update(1399) && !b.update(1400) && !b.update(1499) && b.update(1500) && b.update(1649));
    CHECK(!b.update(1650) && !b.active());
    b.trigger(SMART_ALERT_CORRECT_PATH, 5000); CHECK(b.update(5000));
    b.trigger(SMART_ALERT_TEETH, 5010);                                  // more important: takes over
    CHECK(b.update(5300) && !b.update(5611));
    b.trigger(SMART_ALERT_WRONG_PATH, 6000);
    b.trigger(SMART_ALERT_CORRECT_PATH, 6010);                           // less important: ignored
    CHECK(b.update(6140) && !b.update(6160));                            // still the wrong-path pattern (150 on / 100 off)
    b.trigger(SMART_ALERT_CORRECT_PATH | SMART_ALERT_OVER_DEPTH, 9000);  // mask: the most important one wins
    CHECK(b.update(9600));                                               // over-depth beep is 700 ms
    b.update(20000); CHECK(!b.active());
    // clock wrap-around
    SmartBuzzerPlayer w; unsigned long near = 0xFFFFFF00UL; w.trigger(SMART_ALERT_TEETH, near);
    CHECK(w.update(near + 100) && !w.update(near + 700));
  }

  // ---- Every alert maps to a name the backend accepts -----------------------------------------------
  { const char* ok[] = {"wrong_path","correct_path","teeth_contact","over_depth","end_point","process_complete","head_position"};
    for (int i = 0; i < SMART_ALERT_COUNT; i++) { const char* n = smartAlertName((uint8_t)(1u << i)); bool found = false;
      for (const char* o : ok) { if (!strcmp(n, o)) found = true; }
      CHECK(found);
      CHECK(smartAlertPattern((uint8_t)(1u << i)) != nullptr); } }

  printf(fails ? "%d FAILED\n" : "all firmware logic tests passed\n", fails);
  return fails != 0;
}
