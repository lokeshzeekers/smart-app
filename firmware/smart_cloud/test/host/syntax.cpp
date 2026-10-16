// Compile-only check: does the real firmware header build for this board-core / config?
#include "smart_cloud.h"
void setup() { smartCloudBegin(); }
void loop() { SmartInputs in; in.depthIndex = 1; in.styletIndex = 2; smartCloudLoop(in); }
