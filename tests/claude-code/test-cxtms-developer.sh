#!/usr/bin/env bash
# Test: cxtms-developer skill
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

echo "=== Test: cxtms-developer skill ==="
echo ""

# Test 1: Skill loading
echo "Test 1: Skill loading..."
output=$(run_claude "What is the cxtms-developer skill? Describe briefly." 30)
assert_contains "$output" "entity\|Entity\|reference\|domain" "Skill is recognized" || exit 1
echo ""

# Test 2: Primary entities
echo "Test 2: Primary entity awareness..."
output=$(run_claude "What are the primary entities in CargoXplorer according to cxtms-developer?" 30)
assert_contains "$output" "Order" "Knows Order entity" || exit 1
assert_contains "$output" "Contact" "Knows Contact entity" || exit 1
assert_contains "$output" "Commodity" "Knows Commodity entity" || exit 1
echo ""

# Test 3: CustomValues pattern
echo "Test 3: CustomValues pattern..."
output=$(run_claude "What is the customValues pattern in CX entities? How is it used?" 30)
assert_contains "$output" "customValues\|custom.*values\|jsonb\|JSONB\|dictionary\|Dictionary" "Knows customValues" || exit 1
echo ""

# Test 4: GraphQL queries
echo "Test 4: GraphQL query awareness..."
output=$(run_claude "How do you query CX entities using GraphQL according to cxtms-developer? What filter syntax is used?" 30)
assert_contains "$output" "GraphQL\|graphql" "Knows GraphQL" || exit 1
assert_contains "$output" "Lucene\|lucene\|filter" "Knows Lucene filter syntax" || exit 1
echo ""

echo "=== All cxtms-developer tests passed ==="
