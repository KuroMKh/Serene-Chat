# Serene Chat

Serene Chat is a real-time chat application using Firebase. This application features login, chat rooms, in-browser message encryption, and a risky message detector using TensorFlow.js.

## How the AI in this project works

This AI is not a chatbot. Its task is to read text and estimate whether the text contains signs of risk. The flow is:

```text
User message
  -> Malay/Manglish normalization
  -> Universal Sentence Encoder (TensorFlow.js)
  -> trained classifier model
  -> none / low / medium / high result
```

Main AI files:

- `frontend/static/js/ai-detector.js` runs the detection in the browser.
- `frontend/static/models/risk-classifier.json` is the small model resulting from training.
- `tools/train-ai.mjs` is used to train the model.
- `tools/test-ai-artifact.mjs` checks whether the model file is valid.
- `AI_TRAINING.md` contains the step-by-step training guide.

The current model is only trained using 100 rows as an initial test. It is suitable for testing the system, but not yet strong enough for actual usage.

## For team members: ready to use right after pull

The simple version: **yes, the AI part is already installed on the website**. After pulling, you do not need to download the dataset or train the model to use the existing AI. The small model file is already saved alongside the code.

After cloning or pulling the repository:

```powershell
npm install
firebase.cmd emulators:start --only hosting
```

If the `firebase.cmd` command is not found, install the Firebase CLI once:

```powershell
npm install -g firebase-tools
```

Open the localhost URL displayed by Firebase, log in, and enter a chat room. The AI will load on its own. No need to run `ai:train` for normal usage.

Check the text at the top of the chat:

- `AI Active · Trained` means the trained model is successfully used.
- `AI Active · Anchors` means the JSON model cannot be used, but the old detection system is still running as a backup.
- `AI Failed (Regex only)` means the TensorFlow model failed to load and only clear word/phrase checking is running.

### Current AI status

```text
Setup training              Done
Model connection to website Done
Trial model                 Done (100 rows total)
Fallback anchor/regex       Done
Large dataset in GitHub     No, intentionally ignored
Ready for demo/testing      Yes
Ready to be deemed accurate No
```

The 100 rows were divided into 80 rows for the model to learn and 20 rows for validation. It proves the system can train, export, and load the model. It does not yet prove the model is accurate enough for real-world situations.

### When is the Kaggle dataset needed?

- Want to use or demo the model now: **no dataset needed**.
- Want to retrain or strengthen the model: **need to download dataset**.
- Want to edit UI or chat functions only: **no dataset needed**.

### When to use `npm run ai:train`?

Run that command only when you want to generate a new model. Training will overwrite `frontend/static/models/risk-classifier.json`, so check the new model before committing.

## Project structure

```text
frontend/src/             Vue components and application code
frontend/static/          Static assets copied into the production build
frontend/dist/            Generated Firebase Hosting output
backend/                  Documentation and backend space
tools/                    Training and model checking scripts
training-data/            Local dataset (not pushed to GitHub)
training-output/          Experiment output (not pushed to GitHub)
AI_TRAINING.md            Full AI training guide
firebase.json             Firebase Hosting settings
```

## First-time setup

Requirements:

- Node.js 18 or newer
- Firebase CLI
- Kaggle dataset for retraining

Install dependencies:

```powershell
npm install
```

## Run on localhost

Do not open the HTML file by double-clicking it. Run the Firebase Hosting Emulator from the main project folder:

```powershell
firebase.cmd emulators:start --only hosting
```

Open the displayed address, usually `http://127.0.0.1:5000`. If that port is in use, Firebase might choose another port like `5002`.

Enter the chat room and check the AI status:

- `AI Active · Trained`: JSON model is successfully used.
- `AI Active · Anchors`: JSON model is missing or corrupted; anchor system is used.
- `AI Failed (Regex only)`: TensorFlow/USE failed to load.

## Large dataset not included in GitHub

The following folders have been added to `.gitignore`:

```text
training-data/
training-output/
node_modules/
```

Therefore, the `Suicide_Detection.csv` file and Kaggle ZIP will not be included during `git add` or `git push`. Each team member needs to download the dataset themselves if they want to retrain.

The `frontend/static/models/risk-classifier.json` file, however, is intentionally pushed to GitHub because it is small and required by the website to run the model.

## Before pushing

Check the changes and ensure the dataset is not listed:

```powershell
git status
git check-ignore -v training-data/Suicide_Detection.csv
npm run ai:test
```

Then use the normal Git workflow:

```powershell
git add .
git commit -m "Add trained AI risk classifier pipeline"
git push
```

Check the changes before committing because this repository also includes the migration of old files into the `frontend/` folder.

## Deployment

```powershell
firebase.cmd deploy --only hosting
```

Run `npm run build` before deployment. Firebase publishes only `frontend/dist`; the training dataset is not included.

To download the dataset, train the model, and test the AI results, read [AI_TRAINING.md](AI_TRAINING.md).

The guide also explains the types of data that can be used, how to build a Malay/Manglish test set, the differences between train/validation/test, how to detect false positives and false negatives, and the steps to gradually increase the model's strength.

> This detector is merely an initial screening tool, not a medical diagnosis or a substitute for human evaluation. Risky results must be reviewed carefully.
