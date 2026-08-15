# Python Diagnostic Test Suite for Google Calendar OAuth Flow in FastAPI Backend

import urllib.parse
from fastapi.testclient import TestClient
from main import app, get_calendar_auth_url

client = TestClient(app)

print("\n=======================================================")
print("CoursePilot Google Calendar OAuth Diagnostic Test Suite")
print("=======================================================\n")

# Test 1: Unconfigured OAuth credentials state
r1 = client.get("/api/calendar/auth-url?user_id=usr_test_abc")
assert r1.status_code == 200, f"Expected 200 but got {r1.status_code}"
data1 = r1.json()
print("[PASS] Test 1: Handled unconfigured OAuth credentials gracefully:")
print(f"       configured: {data1.get('configured')}")
print(f"       message: {data1.get('message')}\n")

# Test 2: URL generation with configured client credentials
mock_client_id = "1234567890-testsample.apps.googleusercontent.com"
mock_redirect_uri = "https://ai-campus-copilot-one.vercel.app"

# Temporarily test URL generation logic directly
import main
main.google_client_id = mock_client_id

r2 = client.get(f"/api/calendar/auth-url?user_id=usr_test_abc&redirect_uri={mock_redirect_uri}")
assert r2.status_code == 200
data2 = r2.json()

assert data2["configured"] is True, "Expected configured: True"
assert "accounts.google.com/o/oauth2/v2/auth" in data2["auth_url"], "Invalid Google OAuth base URL"

parsed_url = urllib.parse.urlparse(data2["auth_url"])
query_params = urllib.parse.parse_qs(parsed_url.query)

assert query_params["client_id"][0] == mock_client_id, "Mismatch client_id"
assert query_params["redirect_uri"][0] == mock_redirect_uri, "Mismatch redirect_uri"
assert query_params["response_type"][0] == "code", "Mismatch response_type"
assert query_params["scope"][0] == "https://www.googleapis.com/auth/calendar.events.readonly", "Mismatch scope"
assert query_params["access_type"][0] == "offline", "Mismatch access_type"
assert query_params["prompt"][0] == "consent", "Mismatch prompt"
assert query_params["state"][0] == "usr_test_abc", "Mismatch state (user_id)"

print("[PASS] Test 2: Constructed Google OAuth 2.0 Authorization URL correctly:")
print(f"       Base: {parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}")
print(f"       Scope: {query_params['scope'][0]}")
print(f"       Redirect URI: {query_params['redirect_uri'][0]}")
print(f"       Response Type: {query_params['response_type'][0]}")
print(f"       Access Type: {query_params['access_type'][0]}\n")

# Test 3: Status check endpoint
r3 = client.get("/api/calendar/status?user_id=usr_test_abc")
assert r3.status_code == 200
data3 = r3.json()
print("[PASS] Test 3: Calendar status endpoint returns disconnected status safely:")
print(f"       connected: {data3.get('connected')}\n")

# Test 4: OAuth callback error handling when invalid/expired code is passed
main.google_client_secret = "test_secret_sample"
r4 = client.post("/api/calendar/oauth-callback", json={
    "code": "invalid_fake_code_12345",
    "user_id": "usr_test_abc",
    "redirect_uri": mock_redirect_uri
})
# Expected 400 with descriptive error
assert r4.status_code == 400, f"Expected 400 on fake code, got {r4.status_code}"
data4 = r4.json()
print("[PASS] Test 4: Handled invalid OAuth authorization code defensively:")
print(f"       status: {r4.status_code}")
print(f"       detail: {data4.get('detail')}\n")

# Reset
main.google_client_id = ""
main.google_client_secret = ""

print("All 4 OAuth diagnostic tests passed successfully (100%).\n")
