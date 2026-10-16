#!/usr/bin/env bash
# Firmware checks that need no hardware. Run from anywhere:  firmware/smart_cloud/test/run_tests.sh
#   1. unit tests of the step / alert / buzzer logic
#   2. does the REAL firmware code compile for every board-core / buzzer / LDR variant?
#   3. end to end: the real firmware code (PC build) drives the real backend routes
# Needs g++ and Node; step 3 also needs `npm ci` in backend/.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
FW="$HERE/.."
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "== 1. logic unit tests"
g++ -std=c++11 -Wall -Wextra "$FW/test_steps.cpp" -o "$TMP/test_steps"
"$TMP/test_steps"

echo "== 2. compile checks"
check() {
  local label="$1"; shift
  g++ -std=c++11 -fsyntax-only -Wall -Wextra -Wno-unused-parameter "$@" -I"$HERE/host" -I"$FW" "$HERE/host/syntax.cpp"
  echo "   ok: $label"
}
check "ESP32 core 3.x, active buzzer, analog LDR"  -DESP_ARDUINO_VERSION_MAJOR=3
check "ESP32 core 2.x, active buzzer, analog LDR"  -DESP_ARDUINO_VERSION_MAJOR=2
check "ESP32 core 3.x, passive buzzer"             -DESP_ARDUINO_VERSION_MAJOR=3 -DSMART_BUZZER_ACTIVE=0
check "ESP32 core 2.x, passive buzzer"             -DESP_ARDUINO_VERSION_MAJOR=2 -DSMART_BUZZER_ACTIVE=0
check "digital LDR, no buzzer"                     -DSMART_LDR_ANALOG=0 -DSMART_BUZZER_PIN=-1

echo "== 3. end to end (real firmware code -> real backend routes)"
g++ -std=c++11 -pthread -Wall -I"$HERE/host" -I"$FW" "$HERE/host/driver.cpp" "$HERE/host/host_impl.cpp" -o "$TMP/driver"
node "$HERE/e2e.js" "$TMP/driver" | tail -12
