
import argparse
import getpass
import json
import platform
import socket
import ssl
import urllib.error
import urllib.request
from datetime import datetime


API_URL = "https://purpleshield-api-2026.onrender.com/api/agent/results"


def scan_local_ports(ports):
    results = []

    for port in ports:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=2):
                state = "open"
                reason = "TCP connection successfully established."

        except ConnectionRefusedError:
            state = "closed"
            reason = "Connection refused; no service is listening."

        except (socket.timeout, TimeoutError):
            state = "filtered"
            reason = "Connection timed out; filtering may be present."

        except OSError as error:
            state = "unknown"
            reason = f"Connection error: {error}"

        results.append({
            "port": port,
            "state": state,
            "reason": reason
        })

    return results


def send_results(token, device, results):
    payload = {
        "device": device,
        "target": "127.0.0.1",
        "results": results
    }

    data = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(
        API_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "X-Agent-Token": token
        },
        method="POST"
    )

    context = ssl.create_default_context()

    with urllib.request.urlopen(
        request, context=context, timeout=30
    ) as response:
        return json.loads(response.read().decode("utf-8"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="PurpleShield Local Agent"
    )
    parser.add_argument("--ports", default="80,22,5000,8000")
    args = parser.parse_args()

    try:
        ports = sorted(set(int(p.strip()) for p in args.ports.split(",")))
        if not ports or any(p < 1 or p > 65535 for p in ports):
            raise ValueError("Ports must be between 1 and 65535.")
    except ValueError as error:
        parser.error(str(error))

    print("PurpleShield Local Agent")
    print("This will scan only your own laptop's localhost ports.")
    consent = input("Do you authorize this scan? (yes/no): ").strip().lower()

    if consent != "yes":
        print("Scan cancelled.")
        raise SystemExit(0)

    token = getpass.getpass("Enter your PurpleShield Agent Token: ").strip()

    if not token:
        print("Agent token is required.")
        raise SystemExit(1)

    results = scan_local_ports(ports)

    print("\nLocal scan completed:")
    print(json.dumps(results, indent=2))

    try:
        response = send_results(token, platform.node(), results)
        print("\nRender response:")
        print(json.dumps(response, indent=2))
        print("\nYour scan results have been sent to PurpleShield.")
    except urllib.error.HTTPError as error:
        print(f"\nServer rejected the request: HTTP {error.code}")
        print(error.read().decode("utf-8", errors="replace"))
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        print(f"\nCould not connect to PurpleShield: {error}")
