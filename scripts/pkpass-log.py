"""Formatiert pino-JSON-Logs und zeigt nur die pkpass-Requests (Zeit in Europe/Berlin)."""
import json
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Berlin")

entries = []
for line in sys.stdin:
    line = line.strip()
    if line.startswith("{"):
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            pass

pkpass_ids = {
    e["reqId"]
    for e in entries
    if "req" in e and ".pkpass" in e["req"].get("url", "")
}

if not pkpass_ids:
    print("Keine pkpass-Requests gefunden.")
    sys.exit(0)

print(f"{'Zeit':<20} {'Methode':<7} {'Status':<7} {'Dauer':>10}  {'Client':<16} URL")
for e in entries:
    if e.get("reqId") not in pkpass_ids:
        continue
    ts = datetime.fromtimestamp(e["time"] / 1000, TZ).strftime("%d.%m.%Y %H:%M:%S")
    if "req" in e:
        r = e["req"]
        print(f"{ts:<20} {r.get('method', ''):<7} {'':<7} {'':>10}  {r.get('remoteAddress', ''):<16} {r.get('url', '')}")
    elif "res" in e:
        dauer = f"{round(e.get('responseTime', 0), 1)} ms"
        print(f"{ts:<20} {'':<7} {e['res']['statusCode']:<7} {dauer:>10}  {'':<16} (Antwort)")
