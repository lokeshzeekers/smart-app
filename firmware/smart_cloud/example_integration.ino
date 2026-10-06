// Example: how your existing manikin sketch calls the SMArT cloud link.
// Keep all your own sensor code; only the lines marked  <-- SMArT  are new.
#include "smart_cloud.h"            // <-- SMArT  (copy smart_config.example.h -> smart_config.h first)

// ... your existing globals (names as in your current sketch):
//   toolDetected, teethSafe, currentDepthIndex, DESIGNATED_INDEX, depthPosition[],
//   wrongPathLatched, correctPathLatched, headAngle, HEAD_ANGLE_MIN/MAX,
//   imuCalibStatus, airFlow_slm
//
// teethSafe          = false while the teeth push-button is pressed
// wrongPathLatched   = food-path reed switch hit      correctPathLatched = lung-path reed switch hit
// currentDepthIndex  = depth reed-switch index (-1 = tube not inserted)
// DESIGNATED_INDEX   = index of 21 cm (female) or 23 cm (male)

void setup() {
  Serial.begin(115200);
  // ... your existing sensor setup (IMU, airflow, reed switches, teeth button) ...
  // REMOVE:  WiFi.mode(WIFI_AP); WiFi.softAP(...);   (smartCloudBegin joins your WiFi instead)
  smartCloudBegin();                // <-- SMArT  (WiFi + LDR + buzzer + background network task)
}

void loop() {
  // ... your existing readAllSensors(); runStateMachine(); ...

  SmartInputs in;                   // <-- SMArT  (copy your live values in)
  in.toolDetected     = toolDetected;
  in.teethSafe        = teethSafe;
  in.depthIndex       = currentDepthIndex;
  in.designatedIndex  = DESIGNATED_INDEX;
  in.depthCm          = currentDepthIndex >= 0 ? depthPosition[currentDepthIndex] : 0;
  in.wrongPath        = wrongPathLatched;       // food path
  in.correctPath      = correctPathLatched;     // lung path
  in.headAngle        = headAngle;
  in.headCorrect      = (headAngle >= HEAD_ANGLE_MIN && headAngle <= HEAD_ANGLE_MAX);
  in.imuCalib         = imuCalibStatus;
  in.airflow          = airFlow_slm;

  // Step 11 (remove stylet): the stylet reed-switch chain, read as a reverse count.
  //   >= 0 : index of the reed switch the stylet tip is at, while it is inside the tube
  //   -1   : the count has run all the way back out (stylet removed)
  // Hold the LAST reached index while between two switches. Leave this line out
  // until the stylet switch is wired - step 11 is then simply never credited.
  // in.styletIndex   = styletReedIndex;        // <-- SMArT  (YOUR variable)

  // in.liftForcePsi  = yourForceSensorPsi;     // only if a lift-force sensor is ever fitted (step 7)

  smartCloudLoop(in);               // <-- SMArT  (never blocks; also drives the buzzer)
}
