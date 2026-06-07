const fs = require('fs');

const FEATURES = [
    "age", "anaemia", "creatinine_phosphokinase", "diabetes",
    "ejection_fraction", "high_blood_pressure", "platelets",
    "serum_creatinine", "serum_sodium", "sex", "smoking", "time"
];

function loadData(filepath) {
    const raw = fs.readFileSync(filepath, 'utf8').trim();
    const lines = raw.split('\n');
    let headerIdx = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('age,anaemia')) {
            headerIdx = i;
            break;
        }
    }
    const headers = lines[headerIdx].split(',').map(h => h.trim());
    const headerMap = {};
    headers.forEach((name, idx) => headerMap[name] = idx);

    const dataset = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length < headers.length) continue;
        const x = FEATURES.map(f => parseFloat(row[headerMap[f]]));
        const y = parseInt(row[headerMap["DEATH_EVENT"]]);
        dataset.push({ x, y });
    }
    return dataset;
}

function giniImpurity(groups, classes) {
    const nInstances = groups.reduce((acc, g) => acc + g.length, 0);
    if (nInstances === 0) return 0;
    let gini = 0.0;
    for (const group of groups) {
        const size = group.length;
        if (size === 0) continue;
        let score = 0.0;
        const counts = new Array(classes.length).fill(0);
        for (const row of group) {
            counts[row.y]++;
        }
        for (const count of counts) {
            const p = count / size;
            score += p * p;
        }
        gini += (1.0 - score) * (size / nInstances);
    }
    return gini;
}

function testSplit(index, value, dataset) {
    const left = [];
    const right = [];
    for (const row of dataset) {
        if (row.x[index] <= value) {
            left.push(row);
        } else {
            right.push(row);
        }
    }
    return [left, right];
}

function getSplit(dataset, nFeatures) {
    const classValues = [0, 1];
    let bIndex = 999, bValue = 999, bScore = 999, bGroups = null;
    let features = Array.from({length: FEATURES.length}, (_, i) => i);
    features.sort(() => Math.random() - 0.5);
    features = features.slice(0, nFeatures);

    for (const index of features) {
        const vals = dataset.map(row => row.x[index]);
        if (vals.length === 0) continue;
        const minV = Math.min(...vals);
        const maxV = Math.max(...vals);
        
        const candidates = new Set();
        if (minV === maxV) {
            candidates.add(minV);
        } else {
            const step = (maxV - minV) / 10.0;
            for (let i = 1; i < 10; i++) {
                candidates.add(minV + i * step);
            }
        }

        for (const value of candidates) {
            const groups = testSplit(index, value, dataset);
            const gini = giniImpurity(groups, classValues);
            if (gini < bScore) {
                bIndex = index;
                bValue = value;
                bScore = gini;
                bGroups = groups;
            }
        }
    }
    return { index: bIndex, value: bValue, groups: bGroups };
}

function toTerminal(group) {
    const outcomes = group.map(row => row.y);
    if (outcomes.length === 0) return [1.0, 0.0];
    const n = outcomes.length;
    const n1 = outcomes.filter(y => y === 1).length;
    const p1 = n1 / n;
    return [1.0 - p1, p1];
}

function split(node, maxDepth, minSize, nFeatures, depth) {
    const [left, right] = node.groups;
    delete node.groups;

    if (left.length === 0 || right.length === 0) {
        node.left = node.right = toTerminal(left.concat(right));
        return;
    }
    if (depth >= maxDepth) {
        node.left = toTerminal(left);
        node.right = toTerminal(right);
        return;
    }

    if (left.length <= minSize) {
        node.left = toTerminal(left);
    } else {
        node.left = getSplit(left, nFeatures);
        split(node.left, maxDepth, minSize, nFeatures, depth + 1);
    }

    if (right.length <= minSize) {
        node.right = toTerminal(right);
    } else {
        node.right = getSplit(right, nFeatures);
        split(node.right, maxDepth, minSize, nFeatures, depth + 1);
    }
}

function buildTree(train, maxDepth, minSize, nFeatures) {
    const root = getSplit(train, nFeatures);
    split(root, maxDepth, minSize, nFeatures, 1);
    return root;
}

function subsample(dataset, ratio) {
    const sample = [];
    const nSample = Math.round(dataset.length * ratio);
    while (sample.length < nSample) {
        const idx = Math.floor(Math.random() * dataset.length);
        sample.push(dataset[idx]);
    }
    return sample;
}

function predictTree(node, row) {
    if (Array.isArray(node)) return node; // probabilities [p0, p1]
    if (row.x[node.index] <= node.value) {
        return predictTree(node.left, row);
    } else {
        return predictTree(node.right, row);
    }
}

function predictForest(trees, row) {
    const predictions = trees.map(tree => predictTree(tree, row));
    const p0 = predictions.reduce((acc, p) => acc + p[0], 0) / trees.length;
    const p1 = predictions.reduce((acc, p) => acc + p[1], 0) / trees.length;
    return [p0, p1];
}

function trainRandomForest(train, nTrees, maxDepth, minSize, sampleSize, nFeatures) {
    const trees = [];
    for (let i = 0; i < nTrees; i++) {
        const sample = subsample(train, sampleSize);
        const tree = buildTree(sample, maxDepth, minSize, nFeatures);
        trees.push(tree);
        console.log(`Trained Tree ${i + 1}/${nTrees}`);
    }
    return trees;
}

function main() {
    const dataset = loadData("scratch/heart_failure.csv");
    console.log("Loaded dataset size:", dataset.length);

    // Split train/test (75% train, 25% test)
    dataset.sort(() => Math.random() - 0.5);
    const splitIdx = Math.floor(dataset.length * 0.75);
    const trainSet = dataset.slice(0, splitIdx);
    const testSet = dataset.slice(splitIdx);
    console.log(`Train size: ${trainSet.length}, Test size: ${testSet.length}`);

    const nTrees = 20;
    const maxDepth = 6;
    const minSize = 2;
    const sampleSize = 1.0;
    const nFeatures = Math.floor(Math.sqrt(FEATURES.length));

    console.log("Training Random Forest...");
    const forest = trainRandomForest(trainSet, nTrees, maxDepth, minSize, sampleSize, nFeatures);

    let correct = 0;
    for (const row of testSet) {
        const probs = predictForest(forest, row);
        const predClass = probs[1] >= 0.5 ? 1 : 0;
        if (predClass === row.y) correct++;
    }
    const accuracy = correct / testSet.length;
    console.log(`Validation Accuracy: ${(accuracy * 100).toFixed(2)}%`);

    const outputPath = "scratch/heart_failure_rf.json";
    fs.writeFileSync(outputPath, JSON.stringify({
        features: FEATURES,
        trees: forest
    }, null, 2));
    console.log("Saved JSON model to:", outputPath);
}

main();
