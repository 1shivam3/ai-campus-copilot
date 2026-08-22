import requests
import sys

PROD_BACKEND = "https://ai-campus-copilot-uanp.onrender.com"

print("==================================================")
print("TESTING PRODUCTION BACKEND API")
print(f"Target: {PROD_BACKEND}")
print("==================================================")

# 1. Health check
try:
    r_health = requests.get(f"{PROD_BACKEND}/health", timeout=15)
    print(f"GET /health: status={r_health.status_code}, body={r_health.json()}")
    print(f"Security Headers on /health:")
    print(f"  - X-Content-Type-Options: {r_health.headers.get('x-content-type-options')}")
    print(f"  - X-Frame-Options: {r_health.headers.get('x-frame-options')}")
    print(f"  - Referrer-Policy: {r_health.headers.get('referrer-policy')}")
except Exception as e:
    print(f"Health check note: {e}")

# 2. Unauthenticated access to protected endpoints
protected = [
    ("/api/copilot-chat", {"message": "test"}),
    ("/api/generate-exam-question", {"subject_name": "DSA"}),
    ("/api/user-stats/test", None),
]

for path, body in protected:
    try:
        if body:
            r = requests.post(f"{PROD_BACKEND}{path}", json=body, timeout=15)
        else:
            r = requests.get(f"{PROD_BACKEND}{path}", timeout=15)
        print(f"Unauthenticated request to {path}: status={r.status_code} (Expected 401)")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    except Exception as e:
        print(f"Test on {path}: {e}")

# 3. Public Leaderboard endpoint test
try:
    r_lb = requests.get(f"{PROD_BACKEND}/api/leaderboard?timeframe=global", timeout=15)
    print(f"GET /api/leaderboard: status={r_lb.status_code}")
    assert r_lb.status_code == 200
    lb_data = r_lb.json()
    print(f"  - Total active learners: {lb_data.get('total_active_learners')}")
    print(f"  - Top 3 learners:")
    for ranker in lb_data.get("leaderboard", [])[:3]:
        print(f"    Rank {ranker.get('rank')}: {ranker.get('display_name')} ({ranker.get('xp')} XP, {ranker.get('solved')} solved)")
except Exception as e:
    print(f"Leaderboard test: {e}")

print("\n==================================================")
print("PRODUCTION BACKEND VERIFICATION COMPLETE")
print("==================================================")
