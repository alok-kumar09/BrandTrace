
import urllib.request
import urllib.error
import json

# Log in and obtain the JWT token
data = json.dumps({
    "email": "alex@brandtrace.test",
    "password": "TestPass123"
}).encode()

login_request = urllib.request.Request(
    "http://127.0.0.1:5000/api/auth/login",
    data=data,
    headers={"Content-Type": "application/json"}
)

token = json.loads(
    urllib.request.urlopen(login_request).read()
)["access_token"]

headers = {"Authorization": "Bearer " + token}

paths = [
    "/api/organisations/1",
    "/api/organisations/2",
    "/api/organisations/1/dashboard",
    "/api/organisations/2/dashboard"
]

for path in paths:
    request = urllib.request.Request(
        "http://127.0.0.1:5000" + path,
        headers=headers
    )

    try:
        response = urllib.request.urlopen(request)
        print(path, "->", response.status)

    except urllib.error.HTTPError as error:
        print(path, "->", error.code, error.read().decode())
