
import urllib.request
import urllib.error
import json

# Log in as Alex
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

headers = {
    "Authorization": "Bearer " + token,
    "Content-Type": "application/json"
}

# Existing guideline values for testing
guideline_data = json.dumps({
    "tone": "Professional, friendly and concise",
    "restricted_words": ["Cheapest", "Guaranteed"],
    "approved_terms": ["NovaBook Pro"],
    "approved_facts": {"battery_life": "Up to 12 hours"}
}).encode()

tests = [
    ("GET", "/api/guidelines/1"),
    ("GET", "/api/guidelines/2"),
    ("PUT", "/api/guidelines/1"),
    ("PUT", "/api/guidelines/2")
]

for method, path in tests:
    request = urllib.request.Request(
        "http://127.0.0.1:5000" + path,
        data=guideline_data if method == "PUT" else None,
        headers=headers,
        method=method
    )

    try:
        response = urllib.request.urlopen(request)
        print(method, path, "->", response.status)

    except urllib.error.HTTPError as error:
        print(method, path, "->", error.code, error.read().decode())
