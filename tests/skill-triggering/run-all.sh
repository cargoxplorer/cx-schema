#!/usr/bin/env bash
# Run all skill triggering tests
# Usage: ./run-all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTS_DIR="$SCRIPT_DIR/prompts"

# Each entry is "skill-name:prompt-file" (prompt-file without .txt extension)
TESTS=(
    "cxtms-workflow-builder:cxtms-workflow-builder"
    "cxtms-module-builder:cxtms-module-builder"
    "cxtms-developer:cxtms-developer"
    "cxtms-developer:cxtms-developer-logs"
    "cxtms-developer:cxtms-developer-order"
    "cxtms-developer:cxtms-developer-parcel"
    "cxtms-developer:cxtms-developer-commodity"
)

echo "=== Running CXTMS Skill Triggering Tests ==="
echo ""

PASSED=0
FAILED=0
RESULTS=()

for entry in "${TESTS[@]}"; do
    skill="${entry%%:*}"
    prompt_name="${entry##*:}"
    prompt_file="$PROMPTS_DIR/${prompt_name}.txt"

    if [ ! -f "$prompt_file" ]; then
        echo "⚠️  SKIP: No prompt file: $prompt_file"
        continue
    fi

    label="$skill (${prompt_name})"
    echo "Testing: $label"

    if "$SCRIPT_DIR/run-test.sh" "$skill" "$prompt_file" 3 2>&1 | tee "/tmp/cxtms-skill-test-${prompt_name}.log"; then
        PASSED=$((PASSED + 1))
        RESULTS+=("✅ $label")
    else
        FAILED=$((FAILED + 1))
        RESULTS+=("❌ $label")
    fi

    echo ""
    echo "---"
    echo ""
done

echo ""
echo "=== Summary ==="
for result in "${RESULTS[@]}"; do
    echo "  $result"
done
echo ""
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [ $FAILED -gt 0 ]; then
    exit 1
fi
