#!/usr/bin/env bash
# Test: cxtms-workflow-builder skill
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

echo "=== Test: cxtms-workflow-builder skill ==="
echo ""

# Test 1: Skill loading
echo "Test 1: Skill loading..."
output=$(run_claude "What is the cxtms-workflow-builder skill? Describe briefly." 30)
assert_contains "$output" "workflow" "Skill is recognized" || exit 1
assert_contains "$output" "YAML\|yaml" "Mentions YAML" || exit 1
echo ""

# Test 2: Scaffold-first workflow
echo "Test 2: Scaffold-first workflow..."
output=$(run_claude "Using cxtms-workflow-builder, what is the first step when creating a new workflow? Be specific about the command." 30)
assert_contains "$output" "create\|scaffold" "Mentions scaffolding" || exit 1
assert_contains "$output" "cxtms\|cx-cli\|npx" "Mentions CLI tool" || exit 1
echo ""

# Test 3: Validate after changes
echo "Test 3: Validate-after-changes loop..."
output=$(run_claude "In cxtms-workflow-builder, what should you always do after modifying a workflow YAML file?" 30)
assert_contains "$output" "validate\|validation" "Mentions validation" || exit 1
echo ""

# Test 4: Task categories
echo "Test 4: Task category awareness..."
output=$(run_claude "List the main task categories available in CX workflows according to cxtms-workflow-builder." 30)
assert_contains "$output" "Utilities\|utilities" "Knows Utilities tasks" || exit 1
assert_contains "$output" "Entity\|entity\|Order\|Contact" "Knows Entity tasks" || exit 1
assert_contains "$output" "Communication\|Email\|email" "Knows Communication tasks" || exit 1
echo ""

# Test 5: Expression syntax distinction
echo "Test 5: Expression syntax distinction..."
output=$(run_claude "In CX workflows, what is the difference between {{ }} and [ ] expression syntax? When is each used?" 30)
assert_contains "$output" "template\|input" "Knows {{ }} is for inputs" || exit 1
assert_contains "$output" "condition\|NCalc\|ncalc" "Knows [ ] is for conditions" || exit 1
echo ""

# Test 6: Null-safe operator
echo "Test 6: Null-safe operator awareness..."
output=$(run_claude "In cxtms-workflow-builder, what is the ? operator and when should it be used on variable paths?" 30)
assert_contains "$output" "null\|Null" "Mentions null safety" || exit 1
echo ""

# Test 7: Flow workflow type
echo "Test 7: Flow workflow type..."
output=$(run_claude "What is a Flow workflow in CX? How does it differ from a standard workflow?" 30)
assert_contains "$output" "state\|State" "Mentions states" || exit 1
assert_contains "$output" "transition\|Transition" "Mentions transitions" || exit 1
assert_contains "$output" "entity\|Entity" "Mentions entity" || exit 1
echo ""

echo "=== All cxtms-workflow-builder tests passed ==="
