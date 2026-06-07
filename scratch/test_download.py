import urllib.request
import pandas as pd
import os

url = "https://raw.githubusercontent.com/ShanaFarber/cuny-sps/master/DATA_622/data/heart_failure_clinical_records.csv"
output_path = "scratch/heart_failure.csv"

try:
    os.makedirs("scratch", exist_ok=True)
    urllib.request.urlretrieve(url, output_path)
    df = pd.read_csv(output_path)
    print("Shape:", df.shape)
    print("Columns:", list(df.columns))
except Exception as e:
    print("Error:", e)
