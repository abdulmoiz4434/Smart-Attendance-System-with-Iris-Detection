import firebase_admin
from firebase_admin import credentials, firestore, auth

cred = credentials.Certificate("smart-attendance-system-a3b97-firebase-adminsdk-fbsvc-157c5ab1f3.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Step 1: Delete non-admin users from Firestore AND Firebase Auth
print("=== Deleting non-admin users ===")
users_docs = db.collection("users").stream()
auth_uids_to_delete = []

for u in users_docs:
    data = u.to_dict()
    if data.get("role") != "admin":
        uid = u.id
        auth_uids_to_delete.append(uid)
        u.reference.delete()
        print(f"  Firestore deleted: {data.get('email', uid)}")

# Delete from Firebase Auth in batches of 1000
if auth_uids_to_delete:
    result = auth.delete_users(auth_uids_to_delete)
    print(f"  Firebase Auth deleted: {result.success_count} user(s)")
    if result.failure_count > 0:
        for err in result.errors:
            print(f"  Auth delete failed for index {err.index}: {err.reason}")
else:
    print("  No non-admin users found.")

# Step 2: Delete all lectures, subjects, attendance, notifications
def delete_collection(col_name):
    docs = db.collection(col_name).stream()
    count = 0
    for doc in docs:
        doc.reference.delete()
        count += 1
    print(f"  Deleted {count} doc(s) from '{col_name}'")

print("\n=== Deleting collections ===")
for col in ["lectures", "subjects", "attendance", "notifications"]:
    delete_collection(col)

print("\nDone! You can now create fresh users and subjects.")