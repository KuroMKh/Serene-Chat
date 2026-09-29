# Serene Chat AI Training Guide

This guide explains how to download the dataset, train the model, view the model, and test it on localhost. The instructions are written for Windows PowerShell.

## Quickest guide for friends who just pulled

There are two different scenarios:

```text
Use existing AI        No CSV needed and no training needed
Train new AI version   Needs Kaggle CSV and run training script
```

### If you just want to use and test the existing AI

1. Clone the repository or run `git pull`.
2. Open your terminal in the `firebase-chat` folder.
3. Install project dependencies:

```powershell
npm install
```

4. Start the website:

```powershell
firebase.cmd emulators:start --only hosting
```

If your computer doesn't have the Firebase CLI yet, install it first:

```powershell
npm install -g firebase-tools
```

5. Open the URL displayed in the terminal.
6. Login, create, or enter a chat room.
7. Ensure the status shows `AI Active · Trained`.

That is all for normal usage. The model is already available at:

```text
frontend/static/models/risk-classifier.json
```

The Kaggle dataset is not required because the dataset is only used for teaching the model. After learning, the website uses the learning results stored in the JSON file. Think of the CSV as an exercise book and the JSON model as the studied notes: the website only brings the notes, not the entire book.

### Current status you need to know

The current JSON model comes from 100 rows:

```text
50 suicide examples + 50 non-suicide examples = 100 rows
80 rows used for training
20 rows used for validation
```

This model is suitable for a demo, verifying that the integration works, and initiating testing. It shouldn't be considered accurate yet because 100 examples is far too small, and they are mostly in English. The next step is to test it with Malay/Manglish sentences, record the errors, and then retrain it using more data.

### How to stop localhost

Go to the terminal running Firebase and press:

```text
Ctrl+C
```

The sections after this are only needed if you want to understand or retrain the AI.

## 1. Understand the important parts first

This project uses:

- **TensorFlow.js** to run the AI using JavaScript.
- **Universal Sentence Encoder (USE)** to convert sentences into 512 numbers.
- **Logistic regression** to give a risk score between 0 and 1.
- **Regex and Manglish dictionary** as an additional safeguard.

The dataset is not embedded directly into the website. The dataset is only used during training. The output of the training is a small file:

```text
frontend/static/models/risk-classifier.json
```

The website only requires that JSON file, not the large CSV file.

## 2. Download the Kaggle dataset

The dataset used is:

```text
https://www.kaggle.com/datasets/nikhileswarkomati/suicide-watch
```

The easiest way is to download the ZIP via browser, then extract the `Suicide_Detection.csv` file to the following location:

```text
training-data/Suicide_Detection.csv
```

The correct structure:

```text
firebase-chat/
  training-data/
    Suicide_Detection.csv
```

Alternatively, if the Kaggle CLI is already installed and logged in:

```powershell
New-Item -ItemType Directory -Force training-data
kaggle datasets download -d nikhileswarkomati/suicide-watch -p training-data --unzip
```

`training-data/` has been ignored by Git. Do not move the CSV to `frontend/static`, because that folder will be published to the website.

## 3. Install dependencies

Ensure Node.js 18 or newer is installed. From the main project folder:

```powershell
npm install
```

This command installs TensorFlow.js, Universal Sentence Encoder, and the CSV reader. `node_modules/` will not be pushed to GitHub.

## 4. Train a small model first

For the first test, use 100 rows in total:

```powershell
npm run ai:train -- --samples 50 --epochs 10
```

Note: `--samples` is the amount for **each class**. So:

```text
--samples 50
= 50 suicide + 50 non-suicide
= 100 total rows
```

The script will:

1. Read the CSV.
2. Select a balanced amount of data.
3. Split 80% for training and 20% for validation.
4. Convert text to USE embeddings.
5. Train the classifier for 10 epochs.
6. Select thresholds based on the validation set.
7. Write the model to `frontend/static/models/risk-classifier.json`.

The embedding process may take a few minutes on the CPU. Do not close the terminal until the `Saved browser classifier` message appears.

## 5. Meaning of samples and epochs

`samples` determines the amount of data for each class. More data usually provides more diverse examples but takes a longer time.

`epochs` is how many times the classifier relearns from the training data. Too few might mean it hasn't learned enough. Too many on a small dataset can cause the model to memorize the data (overfitting).

Usage suggestions:

```powershell
# Function test: 100 total rows
npm run ai:train -- --samples 50 --epochs 10

# Small experiment: 2,000 total rows
npm run ai:train -- --samples 1000 --epochs 15

# Better experiment: 10,000 total rows
npm run ai:train -- --samples 5000 --epochs 20

# Large training: 40,000 total rows
npm run ai:train -- --samples 20000 --epochs 20
```

Increase the amount gradually. Ensure the small model works before running training that takes a long time.

## 6. Check the model after training

Run:

```powershell
npm run ai:test
```

If successful, the terminal will display a message like:

```text
Classifier artifact is valid (80 training samples).
```

For 100 rows of training, 80 are used for training and 20 for validation. That is why the number displayed is 80.

The model can be opened at:

```text
frontend/static/models/risk-classifier.json
```

Parts that are easy to understand:

- `createdAt`: the time the model was generated.
- `trainingSamples`: number of training data rows.
- `validationSamples`: number of validation data rows.
- `epochs`: number of learning rounds.
- `thresholds`: boundaries for low, medium, and high.
- `validation`: precision, recall, and F2 scores on the validation set.
- `weights`: 512 numbers learned by the model.
- `bias`: an additional number in the classifier calculation.

Do not edit `weights` or `bias` manually. To change them, retrain the model.

A high validation score from 20 examples does not prove the model is truly good. Use a larger validation set before drawing conclusions.

## 7. Run and test on localhost

Start the Firebase Hosting Emulator:

```powershell
firebase.cmd emulators:start --only hosting
```

Open the URL provided by Firebase and enter the chat room. Ensure the status shows:

```text
AI Active · Trained
```

To test without saving messages to Firestore:

1. Press `F12` in the browser.
2. Open the **Console** tab.
3. Run the following examples:

```javascript
await analyzeRisk("I feel happy today")
await analyzeRisk("aku rasa kosong dan dah putus asa")
```

Example result:

```javascript
{
  finalScore: 0.72,
  riskLevel: "medium",
  isRisk: true,
  isRegexMatch: false,
  distressFloor: false,
  modelSource: "trained"
}
```

Meaning of the result fields:

- `finalScore`: the model's score between 0 and 1.
- `riskLevel`: the result, either `none`, `low`, `medium`, or `high`.
- `isRisk`: `true` if the message is flagged as a risk.
- `isRegexMatch`: regex found a clear risk phrase.
- `distressFloor`: Malay/Manglish distress rules were applied.
- `modelSource`: `trained` means the JSON model is being used.

Press `Ctrl+C` in the terminal to turn off localhost.

## 8. How to know if the model is getting better

Do not evaluate the model using accuracy alone. Check the following:

- **False negative**: a risky message but the model says it's safe. This is the most crucial to reduce.
- **False positive**: a normal message but the model gives a warning.
- **Recall**: how many risk messages are successfully detected.
- **Precision**: how many warnings are genuinely related to risk.

The Kaggle dataset uses English text from Reddit and only has two labels: `suicide` and `non-suicide`. The application, however, uses four levels and also accepts Malay/Manglish. Therefore, the next step is to build a human-reviewed Malay/Manglish test set.

Do not use users' personal messages without permission. Remove names, phone numbers, addresses, and any information that can identify a person.

## 9. What datasets can be used

The model can be improved using several types of data. Do not mix all data without knowing its labels and original purpose.

### A. Kaggle suicide-watch dataset

The dataset currently used is suitable for learning the basic differences:

```text
suicide
non-suicide
```

Its advantage is a large amount of data and the two classes are almost balanced. Its disadvantages:

- Most of the text is English.
- The text comes from Reddit, not Malaysian chat conversations.
- Labels are only binary, not `low`, `medium`, and `high`.
- Community-sourced labels can contain errors.

This dataset is suitable as a baseline classifier, not as the only proof that the model is safe to use.

### B. Team-made Malay/Manglish dataset

This is the most important data for the Serene Chat application. Build a separate file like:

```text
training-data/malay-evaluation.csv
```

Example structure:

```csv
text,expected_level,category,notes
"hari ini aku keluar makan dengan kawan",none,normal,normal sentence
"assignment ni membunuh aku",none,figurative,joke or metaphor
"aku penat sangat dan perlukan seseorang untuk dengar",low,distress,needs support
"aku rasa dah tak ada harapan",medium,hopelessness,needs human review
```

The example above only shows the format. Actual labels for sensitive data need to be reviewed by people who understand mental health contexts. Avoid having just one person determine all the labels if the dataset will be used in real-world situations.

Include language variations that real users might type:

- Formal and informal Malay.
- Manglish and a mix of English.
- Abbreviations like `tak`, `tk`, `dah`, `dh`, `nak`, and `nk`.
- Typos, repeated words, and emojis.
- Short sentences and long sentences.
- Figurative sentences like `exam ni membunuh aku` (this exam is killing me).
- Sentences quoting or discussing risk topics without stating personal intent.
- Normal sentences about school, family, food, games, and daily activities.

### C. Simulated data

Team members can write fabricated sentences to add initial variation. Mark the source as `synthetic` so it doesn't mix untracked with real data. Simulated data helps test the system but cannot fully replace real language data.

### D. Real application data

Do not directly take user chat messages for training. Real data can only be used if there is clear permission, an anonymization process, and secure storage methods. Delete names, usernames, phone numbers, addresses, emails, and any other identifying information.

## 10. Separate train, validation, and test

These three groups have different tasks:

```text
Train       The model learns from this data
Validation  Used to select thresholds and settings
Test        Used once to measure final results
```

Simple split:

```text
70% train
15% validation
15% test
```

The script currently uses 80% train and 20% validation for early experiments. For a more reliable evaluation, prepare a Malay/Manglish test file that is never used during training or threshold selection.

Important rules:

- Do not put the same sentence in both train and test.
- Do not repeatedly change the threshold based on the final test set.
- Keep the number of labels balanced if possible.
- Save the dataset version and `seed` so experiments can be repeated.
- Do not test the model using only the sentences that were used during training.

## 11. How to test and improve AI strength

### Step 1: Validate the pipeline

Train 100 rows and ensure the website displays `AI Active · Trained`. This simply confirms that all components are connected properly.

### Step 2: Build your own test set

Start with at least 100 to 300 Malay/Manglish sentences that are not in the training dataset. Ensure there are many `none` examples, including figurative sentences that easily produce false positives.

### Step 3: Record expected and predicted

For each sentence, save:

```text
text
expected_level
predicted_level
finalScore
isRegexMatch
distressFloor
modelSource
```

Then group the errors into two main categories:

- **False negative**: supposed to be a risk but the model says it's safe.
- **False positive**: supposed to be safe but the model gives a warning.

For small tests in the browser Console, use this format:

```javascript
const testData = [
  { text: "hari ini aku keluar makan", expected: "none" },
  { text: "assignment ni membunuh aku", expected: "none" },
  { text: "aku rasa kosong dan dah putus asa", expected: "low" }
];

for (const item of testData) {
  const result = await analyzeRisk(item.text);
  console.table({
    text: item.text,
    expected: item.expected,
    predicted: result.riskLevel,
    score: result.finalScore.toFixed(3),
    correct: item.expected === result.riskLevel
  });
}
```

The example labels need to be re-reviewed by the team; the purpose of this code is to show how to structure the comparison between expected and predicted.

### Step 4: Improve according to error types

If there are many English false negatives:

- Slowly increase the Kaggle sample amount.
- Use more variations of risk sentences in the train set.
- Check if the threshold is too high.

If there are many Malay/Manglish false negatives:

- Add well-labeled Malay/Manglish data.
- Add spelling variations to `SLANG_MAP` if the meaning is truly the same.
- Add regex only for very clear phrases.

If there are many false positives:

- Add more safe examples and figurative sentences.
- Check `SAFE_ANCHORS` and normal sentences that are very similar to risk sentences.
- Check thresholds using the validation set, not just based on guessing.

If the model is confused between `low`, `medium`, and `high`:

- Remember that the Kaggle dataset only has two labels.
- Build a severity dataset that has `none/low/medium/high` labels.
- Write a clear labeling guide before multiple people label the data.
- Measure agreement between labelers before using those labels.

### Step 5: Increase data in stages

Suggested experiment sequence:

```text
100 rows     Check system connections
2,000 rows   Check training time and obvious errors
10,000 rows  Compare precision/recall
40,000 rows  More diverse experimental model
full dataset only if previous results are still improving
```

More data is not necessarily better if the labels are wrong, duplicated, or do not match the language of the application users.

### Step 6: Compare each model version

For each experiment, record:

```text
Model name/version
Training date
Number of samples
Seed and epochs
Precision
Recall
F2
Number of false negatives
Number of false positives
Malay/Manglish test results
```

Do not choose a model just because the accuracy is the highest. For a screening tool, recall and the number of false negatives are very important, but too many false positives can also cause users to ignore warnings.

### Step 7: Testing before deployment

Before replacing the old model:

1. Save a copy of the old model.
2. Run `npm run ai:test`.
3. Test the same English and Malay/Manglish set on both models.
4. Compare errors, not just one overall score.
5. Test `AI Active · Trained` on localhost.
6. Ensure the `AI Active · Anchors` fallback still works if the JSON is removed.
7. Ask team members to review the results before deploying.

The model can be said to be getting stronger when the results on an **unseen test set** consistently improve, especially when false negatives decrease without causing a significant increase in false positives.

## 12. If problems occur

### `CSV needs text/class columns`

Ensure the correct file is located at:

```text
training-data/Suicide_Detection.csv
```

### `AI Active · Anchors`

The JSON model might be missing or invalid. Run:

```powershell
npm run ai:test
```

Then retrain if necessary.

### PowerShell does not allow `firebase.ps1`

Use `firebase.cmd`:

```powershell
firebase.cmd emulators:start --only hosting
```

### Port 5000 is in use

Look at the actual URL in the terminal. Firebase might automatically use port `5002` or another port.

## 13. Files to push

Push the following files:

```text
frontend/static/js/ai-detector.js
frontend/static/models/risk-classifier.json
tools/train-ai.mjs
tools/test-ai-artifact.mjs
package.json
package-lock.json
README.md
AI_TRAINING.md
.gitignore
```

Do not push:

```text
training-data/
training-output/
node_modules/
*.log
```

Before pushing, use `git status` and ensure the Kaggle CSV/ZIP is not visible.

> This model is a screening aid, not a medical diagnosis. AI results still need to be evaluated by appropriate human personnel.
