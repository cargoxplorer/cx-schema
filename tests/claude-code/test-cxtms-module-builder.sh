#!/usr/bin/env bash
# Test: cxtms-module-builder skill
# Usage: bash test-cxtms-module-builder.sh [test_num ...]
#   No args          -> run all tests
#   `bash ... 6`     -> run only Test 6
#   `bash ... 4 6`   -> run only Tests 4 and 6
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"
TESTS_TO_RUN=("$@")

echo "=== Test: cxtms-module-builder skill ==="
echo ""

if should_run 1; then
    echo "Test 1: Skill loading..."
    output=$(run_claude "What is the cxtms-module-builder skill? Describe briefly." 30)
    assert_contains "$output" "module\|Module" "Skill is recognized" || exit 1
    assert_contains "$output" "YAML\|yaml\|UI\|form\|grid" "Mentions YAML or UI" || exit 1
    echo ""
fi

if should_run 2; then
    echo "Test 2: Scaffold-first workflow..."
    output=$(run_claude "Using cxtms-module-builder, how do you create a new module? What is the command?" 30)
    assert_contains "$output" "create\|scaffold" "Mentions scaffolding" || exit 1
    assert_contains "$output" "module" "Mentions module" || exit 1
    echo ""
fi

if should_run 3; then
    echo "Test 3: Component category awareness..."
    output=$(run_claude "What are the main component categories in CX modules according to cxtms-module-builder?" 30)
    assert_contains "$output" "layout\|Layout" "Knows layout components" || exit 1
    assert_contains "$output" "form\|Form" "Knows form components" || exit 1
    assert_contains "$output" "dataGrid\|data.*grid\|Data.*Grid" "Knows data grid" || exit 1
    echo ""
fi

if should_run 4; then
    echo "Test 4: Validate-after-changes loop..."
    output=$(run_claude "In cxtms-module-builder, what should you do after modifying a module YAML file?" 30)
    assert_contains "$output" "validate\|validation" "Mentions validation" || exit 1
    echo ""
fi

if should_run 5; then
    echo "Test 5: Template awareness..."
    output=$(run_claude "What module templates are available in cxtms-module-builder?" 30)
    assert_contains "$output" "grid\|form\|default" "Knows templates" || exit 1
    echo ""
fi

if should_run 6; then
    # Trigger phrases (skill auto-activation on natural UI/module requests).
    # Run from repo root so Claude has project context (CLAUDE.md, modules/, skills/) —
    # without it, natural prompts get clarifying questions instead of skill-driven answers.
    echo "Test 6: Trigger phrases (UI/buttons/fields/screen)..."
    pushd "$SCRIPT_DIR/../.." > /dev/null

    echo "  6a: update UI for a screen..."
    output=$(run_claude "I need to update the UI for the Orders screen" 120)
    assert_contains "$output" "module" "6a mentions module" || exit 1
    assert_contains "$output" "YAML\|yaml" "6a mentions YAML" || exit 1

    echo "  6b: add a button..."
    output=$(run_claude "Add an Export button to the customer list page" 120)
    assert_contains "$output" "module" "6b mentions module" || exit 1
    assert_contains "$output" "toolbar\|action\|button" "6b mentions toolbar/action/button" || exit 1
    assert_contains "$output" "YAML\|yaml" "6b mentions YAML" || exit 1

    echo "  6c: add a field..."
    output=$(run_claude "Add a status field to the Order form" 120)
    assert_contains "$output" "form\|field" "6c mentions form/field" || exit 1
    assert_contains "$output" "module" "6c mentions module" || exit 1
    assert_contains "$output" "YAML\|yaml" "6c mentions YAML" || exit 1

    echo "  6d: find a screen..."
    output=$(run_claude "Where is the Order details screen defined?" 120)
    assert_contains "$output" "modules\|module" "6d mentions modules" || exit 1
    assert_contains "$output" "YAML\|yaml" "6d mentions YAML" || exit 1

    popd > /dev/null
    echo ""
fi

echo "=== cxtms-module-builder tests passed ==="
