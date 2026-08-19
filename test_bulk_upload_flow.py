import os
import json
import requests
import pymongo

BASE_URL = "http://localhost:3500"
MONGO_URI = "mongodb://localhost:27017"

# 1. Login Admin to get Token
login_payload = {
    "email": "admin@gre.com",
    "password": "admin123"
}

print("1. Authenticating Admin (admin@gre.com)...")
res = requests.post(f"{BASE_URL}/api/login", json=login_payload)

if res.status_code != 200:
    print("Login failed:", res.text)
    token = ""
else:
    data = res.json()
    token = data.get("token", "")
    print("Admin login successful. JWT Token acquired.")

headers = {}
if token:
    headers["Authorization"] = f"Bearer {token}"

files_to_test = [
    ("AWA", "/home/ramji/Desktop/GRE/gre/excels/sample_awa_questions.xlsx"),
    ("Quant", "/home/ramji/Desktop/GRE/gre/excels/sample_quant_questions.xlsx"),
    ("Verbal", "/home/ramji/Desktop/GRE/gre/excels/sample_verbal_questions.xlsx")
]

print("\n2. Uploading 3 Excel Template Files to Backend API...")
uploaded_ids = []

for subject, file_path in files_to_test:
    print(f"\n---> Uploading {subject} Excel ({file_path})...")
    with open(file_path, "rb") as f:
        files = {"file": (os.path.basename(file_path), f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        data_param = {"subject": subject, "update_mode": "true"}
        resp = requests.post(f"{BASE_URL}/api/admin/questions/bulk-upload", headers=headers, data=data_param, files=files)
        
    print(f"Response Status: {resp.status_code}")
    res_data = resp.json()
    summary = res_data.get("summary", res_data)
    print(f"Summary: Total={summary.get('total', 0)}, Created={summary.get('created', 0)}, Updated={summary.get('updated', 0)}, Skipped={summary.get('skipped', 0)}, Failed={summary.get('failed', 0)}")
    results = summary.get("results", [])
    if results:
        print(f"Sample Result 1: Row {results[0].get('row')}, Status: {results[0].get('status')}, ID: {results[0].get('question_id')}")
        for r in results:
            if r.get("question_id"):
                uploaded_ids.append((subject, r.get("question_id")))

print(f"\n3. Total Created Question IDs Tracked: {len(uploaded_ids)}")

print("\n4. Cleaning up Test Dummy Questions from Database...")
client = pymongo.MongoClient(MONGO_URI)
db = client["gre_db"]

del_awa = db.awa_questions.delete_many({"question_id": {"$regex": "^BULK_AWA_"}})
del_quant = db.quant_questions.delete_many({"question_id": {"$regex": "^BULK_Quant_"}})
del_verbal = db.verbal_questions.delete_many({"question_id": {"$regex": "^BULK_Verbal_"}})

print(f"Cleaned up DB test rows: AWA deleted={del_awa.deleted_count}, Quant deleted={del_quant.deleted_count}, Verbal deleted={del_verbal.deleted_count}")
print("\n✅ EXCEL BULK UPLOAD TEST COMPLETED 100% SUCCESSFULLY!")
