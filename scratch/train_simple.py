import csv
import random
import json
import math

FEATURES = [
    "age", "anaemia", "creatinine_phosphokinase", "diabetes",
    "ejection_fraction", "high_blood_pressure", "platelets",
    "serum_creatinine", "serum_sodium", "sex", "smoking", "time"
]

def load_data(filepath):
    data = []
    with open(filepath, "r") as f:
        lines = f.readlines()
        csv_start = 0
        for i, line in enumerate(lines):
            if "age,anaemia" in line:
                csv_start = i
                break
        reader = csv.reader(lines[csv_start:])
        header = next(reader)
        header_map = {name.strip(): idx for idx, name in enumerate(header)}
        for row in reader:
            if not row: continue
            x = [float(row[header_map[f]]) for f in FEATURES]
            y = int(row[header_map["DEATH_EVENT"]])
            data.append((x, y))
    return data

def gini_impurity(groups, classes):
    n_instances = float(sum([len(group) for group in groups]))
    gini = 0.0
    for group in groups:
        size = float(len(group))
        if size == 0: continue
        score = 0.0
        counts = [0] * len(classes)
        for _, y in group:
            counts[y] += 1
        for count in counts:
            p = count / size
            score += p * p
        gini += (1.0 - score) * (size / n_instances)
    return gini

def test_split(index, value, dataset):
    left, right = [], []
    for x, y in dataset:
        if x[index] <= value:
            left.append((x, y))
        else:
            right.append((x, y))
    return left, right

def get_split(dataset, n_features):
    class_values = list(set(row[1] for row in dataset))
    b_index, b_value, b_score, b_groups = 999, 999, 999, None
    features = list(range(len(FEATURES)))
    if n_features < len(features):
        random.shuffle(features)
        features = features[:n_features]
    
    for index in features:
        vals = [row[0][index] for row in dataset]
        if not vals: continue
        min_v, max_v = min(vals), max(vals)
        if min_v == max_v:
            candidates = {min_v}
        else:
            step = (max_v - min_v) / 10.0
            candidates = {min_v + i * step for i in range(1, 10)}
        
        for value in candidates:
            groups = test_split(index, value, dataset)
            gini = gini_impurity(groups, class_values)
            if gini < b_score:
                b_index, b_value, b_score, b_groups = index, value, gini, groups
    return {'index': b_index, 'value': b_value, 'groups': b_groups}

def to_terminal(group):
    outcomes = [row[1] for row in group]
    if not outcomes: return [1.0, 0.0]
    n = float(len(outcomes))
    p1 = outcomes.count(1) / n
    return [1.0 - p1, p1]

def split(node, max_depth, min_size, n_features, depth):
    left, right = node['groups']
    del(node['groups'])
    if not left or not right:
        node['left'] = node['right'] = to_terminal(left + right)
        return
    if depth >= max_depth:
        node['left'], node['right'] = to_terminal(left), to_terminal(right)
        return
    
    if len(left) <= min_size:
        node['left'] = to_terminal(left)
    else:
        node['left'] = get_split(left, n_features)
        split(node['left'], max_depth, min_size, n_features, depth + 1)
        
    if len(right) <= min_size:
        node['right'] = to_terminal(right)
    else:
        node['right'] = get_split(right, n_features)
        split(node['right'], max_depth, min_size, n_features, depth + 1)

def build_tree(train, max_depth, min_size, n_features):
    root = get_split(train, n_features)
    split(root, max_depth, min_size, n_features, 1)
    return root

def subsample(dataset, ratio):
    sample = []
    n_sample = round(len(dataset) * ratio)
    while len(sample) < n_sample:
        index = random.randrange(len(dataset))
        sample.append(dataset[index])
    return sample

def predict_tree(node, row):
    if isinstance(node, list): return node
    if row[node['index']] <= node['value']:
        return predict_tree(node['left'], row)
    else:
        return predict_tree(node['right'], row)

def predict_forest(trees, row):
    predictions = [predict_tree(tree, row) for tree in trees]
    p0 = sum(p[0] for p in predictions) / len(predictions)
    p1 = sum(p[1] for p in predictions) / len(predictions)
    return [p0, p1]

def train_random_forest(train, n_trees, max_depth, min_size, sample_size, n_features):
    trees = []
    for i in range(n_trees):
        sample = subsample(train, sample_size)
        tree = build_tree(sample, max_depth, min_size, n_features)
        trees.append(tree)
    return trees

def main():
    dataset = load_data("scratch/heart_failure.csv")
    print("Loaded data size:", len(dataset))
    
    random.seed(42)
    random.shuffle(dataset)
    split_idx = int(len(dataset) * 0.75)
    train_set = dataset[:split_idx]
    test_set = dataset[split_idx:]
    print("Train size:", len(train_set), "Test size:", len(test_set))
    
    n_trees = 10
    max_depth = 4
    min_size = 5
    sample_size = 1.0
    n_features = int(math.sqrt(len(FEATURES)))
    
    print("Training Random Forest...")
    forest = train_random_forest(train_set, n_trees, max_depth, min_size, sample_size, n_features)
    
    correct = 0
    for row in test_set:
        pred_probs = predict_forest(forest, row[0])
        pred_class = 1 if pred_probs[1] >= 0.5 else 0
        if pred_class == row[1]: correct += 1
    accuracy = correct / len(test_set)
    print(f"Validation Accuracy: {accuracy * 100:.2f}%")
    
    output_path = "scratch/heart_failure_rf.json"
    with open(output_path, "w") as f:
        json.dump({
            "features": FEATURES,
            "trees": forest
        }, f, indent=2)
    print("Successfully saved JSON model to:", output_path)

if __name__ == "__main__":
    main()
