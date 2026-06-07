import csv
import random
import json
import math

FEATURES = [
    "age", "anaemia", "creatinine_phosphokinase", "diabetes",
    "ejection_fraction", "high_blood_pressure", "platelets",
    "serum_creatinine", "serum_sodium", "sex", "smoking"
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
        counts = {c: 0 for c in classes}
        for _, y in group:
            if y in counts:
                counts[y] += 1
        for count in counts.values():
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
            # 10 bin split points
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

def balance_dataset(dataset):
    pos = [row for row in dataset if row[1] == 1]
    neg = [row for row in dataset if row[1] == 0]
    if len(pos) == 0 or len(neg) == 0:
        return dataset
    oversampled_pos = []
    while len(oversampled_pos) < len(neg):
        oversampled_pos.append(random.choice(pos))
    return neg + oversampled_pos

def train_random_forest(train, n_trees, max_depth, min_size, sample_size, n_features):
    trees = []
    balanced_train = balance_dataset(train)
    for i in range(n_trees):
        sample = subsample(balanced_train, sample_size)
        tree = build_tree(sample, max_depth, min_size, n_features)
        trees.append(tree)
    return trees

def calculate_auc(y_true, y_scores):
    paired = sorted(zip(y_scores, y_true), key=lambda x: x[0])
    n = len(paired)
    n1 = sum(y_true)
    n0 = n - n1
    if n0 == 0 or n1 == 0:
        return 0.5
    ranks = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j < n and paired[j][0] == paired[i][0]:
            j += 1
        rank = (i + 1 + j) / 2.0
        for k in range(i, j):
            ranks[k] = rank
        i = j
    sum_ranks_pos = sum(ranks[idx] for idx, (_, label) in enumerate(paired) if label == 1)
    u_statistic = sum_ranks_pos - (n1 * (n1 + 1)) / 2.0
    return u_statistic / (n0 * n1)

def calculate_metrics(y_true, y_scores):
    auc = calculate_auc(y_true, y_scores)
    tp, fp, tn, fn = 0, 0, 0, 0
    for score, label in zip(y_scores, y_true):
        pred = 1 if score >= 0.5 else 0
        if label == 1 and pred == 1:
            tp += 1
        elif label == 0 and pred == 1:
            fp += 1
        elif label == 0 and pred == 0:
            tn += 1
        elif label == 1 and pred == 0:
            fn += 1
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    brier = sum((p - y)**2 for p, y in zip(y_scores, y_true)) / len(y_true)
    return auc, sensitivity, specificity, brier

def cross_validation(dataset, k, n_trees, max_depth, min_size, n_features):
    fold_size = len(dataset) // k
    metrics_list = []
    for i in range(k):
        val_set = dataset[i*fold_size : (i+1)*fold_size]
        train_set = dataset[:i*fold_size] + dataset[(i+1)*fold_size:]
        forest = train_random_forest(train_set, n_trees, max_depth, min_size, 1.0, n_features)
        y_true = []
        y_scores = []
        for row in val_set:
            pred_probs = predict_forest(forest, row[0])
            y_true.append(row[1])
            y_scores.append(pred_probs[1])
        auc, sens, spec, brier = calculate_metrics(y_true, y_scores)
        metrics_list.append((auc, sens, spec, brier))
        print(f"Fold {i+1} Validation - AUC: {auc:.4f}, Sens: {sens:.4f}, Spec: {spec:.4f}, Brier: {brier:.4f}")
    
    mean_auc = sum(m[0] for m in metrics_list) / len(metrics_list)
    mean_sens = sum(m[1] for m in metrics_list) / len(metrics_list)
    mean_spec = sum(m[2] for m in metrics_list) / len(metrics_list)
    mean_brier = sum(m[3] for m in metrics_list) / len(metrics_list)
    print("Mean 5-Fold Cross-Validation Metrics:")
    print(f"  AUC:         {mean_auc:.4f}")
    print(f"  Sensitivity: {mean_sens:.4f}")
    print(f"  Specificity: {mean_spec:.4f}")
    print(f"  Brier Score: {mean_brier:.4f}")
    return mean_auc

def main():
    dataset = load_data("scratch/heart_failure.csv")
    print("Loaded data size:", len(dataset))
    
    random.seed(42)
    random.shuffle(dataset)
    
    n_trees = 100
    max_depth = 4
    min_size = 5
    n_features = int(math.sqrt(len(FEATURES)))
    
    print("Running 5-Fold Cross Validation...")
    cross_validation(dataset, 5, n_trees, max_depth, min_size, n_features)
    
    print("Training final model on entire dataset...")
    forest = train_random_forest(dataset, n_trees, max_depth, min_size, 1.0, n_features)
    
    output_path = "scratch/heart_failure_rf.json"
    with open(output_path, "w") as f:
        json.dump({
            "features": FEATURES,
            "trees": forest
        }, f, indent=2)
    print("Successfully saved JSON model to:", output_path)

if __name__ == "__main__":
    main()
