import os

search_dir = "/Users/sachinsrivastava"
target_file = "heart_failure_clinical_records.csv"

print("Searching...")
found = []
for root, dirs, files in os.walk(search_dir):
    # skip some common system/large directories to speed up
    if any(p in root for p in ["Library", ".npm", ".git", ".next", "node_modules", "Applications"]):
        continue
    if target_file in files:
        path = os.path.join(root, target_file)
        print("Found:", path)
        found.append(path)

if not found:
    print("Not found on system.")
