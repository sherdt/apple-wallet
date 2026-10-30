#!/usr/bin/env bash
# Zeigt alle Requests auf die .pkpass-Dateien aus den Wallet-Pod-Logs
# mit Zeitstempel (Europe/Berlin), Status, Antwortzeit und Client-IP.
#
# Verwendung: scripts/pkpass-log.sh [--since 24h] [--deployment wallet]
set -euo pipefail

SINCE="24h"
DEPLOYMENT="wallet"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --since) SINCE="$2"; shift 2 ;;
    --deployment) DEPLOYMENT="$2"; shift 2 ;;
    -h|--help) sed -n '2,4p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $1" >&2; exit 1 ;;
  esac
done

kubectl logs "deploy/$DEPLOYMENT" --since="$SINCE" | python3 "$(dirname "$0")/pkpass-log.py"
