import json

notebook_path = "/Users/sachinsrivastava/Downloads/heart-failure-prediction-99-2-accuracy.ipynb"

with open(notebook_path, "r", encoding="utf-8") as f:
    nb = json.load(f)

for idx, cell in enumerate(nb["cells"]):
    if cell["cell_type"] == "code":
        print(f"--- Code Cell {idx} ---")
        print("".join(cell["source"]))
        print("\n")
