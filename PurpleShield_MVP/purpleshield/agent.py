
import socket
import argparse
import json
import platform
from datetime import datetime


def scan_local_ports(ports):
    results = []

    for port in ports:
        try:
            with socket.create_connection(
                ("127.0.0.1", port),
                timeout=3
            ):
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


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="PurpleShield Local Port Scanner"
    )

    parser.add_argument(
        "--ports",
        default="80,22,5000,8000"
    )

    args = parser.parse_args()

    try:
        ports = sorted(set(
            int(p.strip()) for p in args.ports.split(",")
        ))

        if not ports or any(p < 1 or p > 65535 for p in ports):
            raise ValueError("Ports must be between 1 and 65535.")

    except ValueError as error:
        parser.error(str(error))

    output = {
        "device": platform.node(),
        "platform": platform.system(),
        "target": "127.0.0.1",
        "timestamp": datetime.now().astimezone().isoformat(),
        "results": scan_local_ports(ports)
    }

    print(json.dumps(output, indent=2))
