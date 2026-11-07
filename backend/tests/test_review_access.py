
import urllib.request
import urllib.error
import json

# Login as Alex
data = json.dumps({
    "email": "alex@brandtrace.test",
    "password": "TestPass123"
}).encode()

login = urllib.request.Request(
    "http://127.0.0.1:5000/api/auth/login",
    data=data,
    headers={"Content-Type": "application/json"}
)

token = json.loads(
    urllib.request.urlopen(login).read()
)["access_token"]

headers = {
    "Authorization": "Bearer " + token,
    "Content-Type": "application/json"
}

tests = [
    {"organisation_id": 1, "content": "Test content"},
    {"organisation_id": 2, "content": "Test content"}
]

for data in tests:
    body = json.dumps(data).encode()

    request = urllib.request.Request(
        "http://127.0.0.1:5000/api/analyze",
        data=body,
        headers=headers,
        method="POST"
    )

    try:
        response = urllib.request.urlopen(request)
        print("Organisation", data["organisation_id"], "->", response.status)
        print(response.read().decode())

    except urllib.error.HTTPError as error:
        print("Organisation", data["organisation_id"], "->", error.code)
        print(error.read().decode())
