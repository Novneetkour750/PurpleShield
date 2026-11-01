import json
import getpass
import urllib.request
import urllib.error

BASE_URL = "https://purpleshield.onrender.com"

username = input("PurpleShield username: ")
password = getpass.getpass("PurpleShield password: ")

def post(url, data, headers=None):
    request = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            **(headers or {})
        },
        method="POST"
    )

    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))

try:
    print("\n1. Logging in...")

    login_data = post(
        BASE_URL + "/api/auth/login",
        {"username": username, "password": password}
    )

    access_token = login_data["access_token"]
    print("Login successful!")

    print("\n2. Connecting Local Agent...")

    result = post(
        BASE_URL + "/api/agent/connect",
        {},
        {"Authorization": "Bearer " + access_token}
    )

    print("\nSUCCESS! Local Agent connected.")
    print("Agent Token:")
    print(result["agent_token"])

    print("\nSave this Agent Token securely.")

except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print(e.read().decode("utf-8"))

except Exception as e:
    print("Error:", str(e))