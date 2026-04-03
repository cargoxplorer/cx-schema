#!/usr/bin/env bash
# Test: cxtms-module-builder skill
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

echo "=== Test: cxtms-module-builder skill ==="
echo ""

# Test 1: Skill loading
echo "Test 1: Skill loading..."
output=$(run_claude "What is the cxtms-module-builder skill? Describe briefly." 30)
assert_contains "$output" "module\|Module" "Skill is recognized" || exit 1
assert_contains "$output" "YAML\|yaml\|UI\|form\|grid" "Mentions YAML or UI" || exit 1
echo ""

# Test 2: Scaffold-first workflow
echo "Test 2: Scaffold-first workflow..."
output=$(run_claude "Using cxtms-module-builder, how do you create a new module? What is the command?" 30)
assert_contains "$output" "create\|scaffold" "Mentions scaffolding" || exit 1
assert_contains "$output" "module" "Mentions module" || exit 1
echo ""

# Test 3: Component categories
echo "Test 3: Component category awareness..."
output=$(run_claude "What are the main component categories in CX modules according to cxtms-module-builder?" 30)
assert_contains "$output" "layout\|Layout" "Knows layout components" || exit 1
assert_contains "$output" "form\|Form" "Knows form components" || exit 1
assert_contains "$output" "dataGrid\|data.*grid\|Data.*Grid" "Knows data grid" || exit 1
echo ""

# Test 4: Validate after changes
echo "Test 4: Validate-after-changes loop..."
output=$(run_claude "In cxtms-module-builder, what should you do after modifying a module YAML file?" 30)
assert_contains "$output" "validate\|validation" "Mentions validation" || exit 1
echo ""

# Test 5: Templates
echo "Test 5: Template awareness..."
output=$(run_claude "What module templates are available in cxtms-module-builder?" 30)
assert_contains "$output" "grid\|form\|default" "Knows templates" || exit 1
echo ""

echo "=== All cxtms-module-builder tests passed ==="
