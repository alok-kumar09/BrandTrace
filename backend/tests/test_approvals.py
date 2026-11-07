
import urllib.request
import urllib.error
import json

# Login as Alex
login_data = json.dumps({
    "email": "alex@brandtrace.test",
    "password": "TestPass123"
}).encode()

login_request = urllib.request.Request(
    "http://127.0.0.1:5000/api/auth/login",
    data=login_data,
    headers={"Content-Type": "application/json"}
)

token = json.loads(
    urllib.request.urlopen(login_request).read()
)["access_token"]

headers = {
    "Authorization": "Bearer " + token,
    "Content-Type": "application/json"
}

# Test a review in Organisation 1 and Organisation 2
tests = [
    {"organisation_id": 1, "status": "Approved"},
    {"organisation_id": 2, "status": "Approved"}
]

for data in tests:
    body = json.dumps(data).encode()

    request = urllib.request.Request(
        "http://127.0.0.1:5000/api/approvals/1",
        data=body,
        headers=headers,
        method="PUT"
    )

    try:
        response = urllib.request.urlopen(request)
        print("Organisation", data["organisation_id"], "->", response.status)
        print(response.read().decode())

    except urllib.error.HTTPError as error:
        print("Organisation", data["organisation_id"], "->", error.code)
        print(error.read().decode())
