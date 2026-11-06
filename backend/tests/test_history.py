
import urllib.request
import urllib.error
import json

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

headers = {"Authorization": "Bearer " + token}

for path in ["/api/history/1", "/api/history/2"]:
    req = urllib.request.Request(
        "http://127.0.0.1:5000" + path,
        headers=headers
    )

    try:
        response = urllib.request.urlopen(req)
        print(path, "->", response.status)
        print(response.read().decode())

    except urllib.error.HTTPError as error:
        print(path, "->", error.code, error.read().decode())

