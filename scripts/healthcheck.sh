#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3001}"

curl -fsS "$API_BASE/status" | jq .
