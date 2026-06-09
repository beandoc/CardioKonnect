#!/usr/bin/env python3
"""
check_seed_status.py
--------------------
Checks the seeding / clearing status of the Cardio-Konnect HF Registry by:
  1. Testing if the dev server is alive on port 3001
  2. Calling GET /api/seed with a short timeout to see if it hangs or returns
  3. Calling GET /api/clear to check the clear endpoint availability
  4. Reporting the result with timing info
"""

import urllib.request
import urllib.error
import time
import json
import sys

BASE_URL = "http://localhost:3001"

TIMEOUT_QUICK = 5   # seconds – just to check if endpoint responds
TIMEOUT_SEED  = 90  # seconds – actual seeding can take up to ~60s

def check_server():
    print("=" * 60)
    print("🔍  Step 1 — Is the dev server alive on port 3001?")
    print("=" * 60)
    try:
        req = urllib.request.urlopen(BASE_URL, timeout=TIMEOUT_QUICK)
        code = req.getcode()
        print(f"  ✅  Server responded with HTTP {code}")
        return True
    except urllib.error.URLError as e:
        print(f"  ❌  Cannot reach server: {e.reason}")
        return False
    except Exception as e:
        print(f"  ❌  Unexpected error: {e}")
        return False


def call_api(path: str, label: str, timeout: int):
    url = BASE_URL + path
    print()
    print("=" * 60)
    print(f"🌐  {label}")
    print(f"    URL : {url}")
    print(f"    Timeout: {timeout}s")
    print("=" * 60)

    start = time.time()
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed = round(time.time() - start, 2)
            status = resp.getcode()
            raw = resp.read().decode("utf-8")
            print(f"  ✅  HTTP {status}  ({elapsed}s)")
            try:
                data = json.loads(raw)
                print(f"  📦  Response JSON:")
                print(json.dumps(data, indent=4))
                return data
            except Exception:
                print(f"  📝  Raw response (first 500 chars):")
                print(raw[:500])
                return None
    except urllib.error.HTTPError as e:
        elapsed = round(time.time() - start, 2)
        print(f"  ❌  HTTP {e.code} after {elapsed}s")
        try:
            body = e.read().decode("utf-8")
            print(f"  Error body: {body[:500]}")
        except Exception:
            pass
        return None
    except urllib.error.URLError as e:
        elapsed = round(time.time() - start, 2)
        reason = str(e.reason)
        if "timed out" in reason.lower():
            print(f"  ⏰  Request TIMED OUT after {timeout}s — API is hanging!")
        else:
            print(f"  ❌  URL Error after {elapsed}s: {reason}")
        return None
    except Exception as e:
        elapsed = round(time.time() - start, 2)
        print(f"  ❌  Unexpected error after {elapsed}s: {e}")
        return None


def summarize(seed_result, clear_result):
    print()
    print("=" * 60)
    print("📊  SUMMARY")
    print("=" * 60)

    if seed_result is None:
        print("  ⚠️   /api/seed → DID NOT RETURN (hung or errored)")
        print("        Likely causes:")
        print("        • Firestore auth/permission block on batch.commit()")
        print("        • clearAllPatients() hanging on getDocs() with no Firestore auth")
        print("        • Excel file not found at /Users/sachinsrivastava/Desktop/HF.xlsx")
    else:
        success = seed_result.get("success", False)
        if success:
            pc = seed_result.get("patientsCount", "?")
            vc = seed_result.get("visitsCount", "?")
            print(f"  ✅   /api/seed → SUCCESS")
            print(f"       Patients seeded : {pc}")
            print(f"       Visits seeded   : {vc}")
        else:
            err = seed_result.get("error", "Unknown error")
            print(f"  ❌   /api/seed → FAILED: {err}")

    print()
    if clear_result is None:
        print("  ⚠️   /api/clear → DID NOT RETURN (timed out or error)")
    else:
        if clear_result.get("success"):
            print("  ✅   /api/clear → SUCCESS (database cleared)")
        else:
            print(f"  ❌   /api/clear → FAILED: {clear_result.get('error')}")

    print()
    print("💡  Recommendation:")
    if seed_result is None:
        print("     The seeder API is hanging. This almost certainly means the")
        print("     Next.js API route is blocked on Firestore network operations")
        print("     because the Client SDK requires authentication that is absent")
        print("     on the server side. The fix is to make /api/seed skip Firestore")
        print("     writes in demo mode and return JSON-only.")
    else:
        print("     Seeding appears to be working. Check the dashboard for updated metrics.")


if __name__ == "__main__":
    alive = check_server()
    if not alive:
        print("\n⛔  Server not running. Start it with:  npm run dev")
        sys.exit(1)

    # Try clear first with short timeout to test connectivity
    print()
    print("⚠️   Skipping /api/clear call to avoid wiping data.")
    print("    (Pass --clear flag to enable it)")
    clear_result = None
    if "--clear" in sys.argv:
        clear_result = call_api("/api/clear", "Step 2 — Test /api/clear endpoint", TIMEOUT_QUICK)

    # Now test seed endpoint
    seed_result = call_api("/api/seed", "Step 3 — Trigger /api/seed (real seeding)", TIMEOUT_SEED)

    summarize(seed_result, clear_result)
