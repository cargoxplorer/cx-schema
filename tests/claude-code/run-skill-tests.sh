#!/usr/bin/env bash
# Test runner for CXTMS skill tests
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo " CXTMS Skills Test Suite"
echo "========================================"
echo ""
echo "Repository: $(cd ../.. && pwd)"
echo "Test time: $(date)"
echo "Claude version: $(claude --version 2>/dev/null || echo 'not found')"
echo ""

if ! command -v claude &> /dev/null; then
    echo "ERROR: Claude Code CLI not found"
    exit 1
fi

VERBOSE=false
SPECIFIC_TEST=""
TIMEOUT=300

while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v) VERBOSE=true; shift ;;
        --test|-t) SPECIFIC_TEST="$2"; shift 2 ;;
        --timeout) TIMEOUT="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo "  --verbose, -v        Show verbose output"
            echo "  --test, -t NAME      Run only the specified test"
            echo "  --timeout SECONDS    Set timeout per test (default: 300)"
            exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

tests=(
    "test-cxtms-developer.sh"
    "test-cxtms-module-builder.sh"
    "test-cxtms-workflow-builder.sh"
)

if [ -n "$SPECIFIC_TEST" ]; then
    tests=("$SPECIFIC_TEST")
fi

passed=0
failed=0
skipped=0

for test in "${tests[@]}"; do
    echo "----------------------------------------"
    echo "Running: $test"
    echo "----------------------------------------"

    test_path="$SCRIPT_DIR/$test"
    if [ ! -f "$test_path" ]; then
        echo "  [SKIP] Test file not found: $test"
        skipped=$((skipped + 1))
        continue
    fi

    start_time=$(date +%s)

    if [ "$VERBOSE" = true ]; then
        if timeout "$TIMEOUT" bash "$test_path"; then
            duration=$(( $(date +%s) - start_time ))
            echo "  [PASS] $test (${duration}s)"
            passed=$((passed + 1))
        else
            duration=$(( $(date +%s) - start_time ))
            echo "  [FAIL] $test (${duration}s)"
            failed=$((failed + 1))
        fi
    else
        if output=$(timeout "$TIMEOUT" bash "$test_path" 2>&1); then
            duration=$(( $(date +%s) - start_time ))
            echo "  [PASS] (${duration}s)"
            passed=$((passed + 1))
        else
            duration=$(( $(date +%s) - start_time ))
            echo "  [FAIL] (${duration}s)"
            echo "$output" | sed 's/^/    /'
            failed=$((failed + 1))
        fi
    fi
    echo ""
done

echo "========================================"
echo " Results: $passed passed, $failed failed, $skipped skipped"
echo "========================================"

[ $failed -gt 0 ] && exit 1 || exit 0
