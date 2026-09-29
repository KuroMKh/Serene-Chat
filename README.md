# Serene Chat

Serene Chat ialah aplikasi chat masa nyata menggunakan Firebase. Aplikasi ini
mempunyai login, bilik chat, penyulitan mesej dalam browser dan pengesan mesej
berisiko menggunakan TensorFlow.js.

## Cara AI dalam projek ini berfungsi

AI ini bukan chatbot. Tugasnya ialah membaca teks dan menganggarkan sama ada
teks itu mempunyai tanda risiko. Alirannya ialah:

```text
Mesej pengguna
  -> normalisasi Bahasa Melayu/Manglish
  -> Universal Sentence Encoder (TensorFlow.js)
  -> model classifier yang telah dilatih
  -> keputusan none / low / medium / high
```

Fail utama AI:

- `frontend/public/js/ai-detector.js` menjalankan pengesanan dalam browser.
- `frontend/public/models/risk-classifier.json` ialah model kecil hasil training.
- `tools/train-ai.mjs` digunakan untuk melatih model.
- `tools/test-ai-artifact.mjs` memeriksa sama ada fail model sah.
- `AI_TRAINING.md` mengandungi panduan training langkah demi langkah.

Model sekarang hanya dilatih menggunakan 100 baris sebagai ujian awal. Ia sesuai
untuk menguji sistem, tetapi belum cukup kuat untuk penggunaan sebenar.

## Untuk ahli kumpulan: selepas pull terus boleh guna

Versi mudahnya: **ya, bahagian AI sudah dipasang dalam website**. Selepas pull,
anda tidak perlu download dataset atau train model untuk menggunakan AI yang
sedia ada. Fail model kecil sudah disimpan bersama code.

Selepas clone atau pull repository:

```powershell
npm install
firebase.cmd emulators:start --only hosting
```

Jika arahan `firebase.cmd` tidak dijumpai, pasang Firebase CLI sekali sahaja:

```powershell
npm install -g firebase-tools
```

Buka URL localhost yang Firebase paparkan, login dan masuk ke bilik chat. AI akan
load sendiri. Tidak perlu run `ai:train` untuk penggunaan biasa.

Semak tulisan pada bahagian atas chat:

- `AI Active · Trained` bermaksud model yang telah dilatih berjaya digunakan.
- `AI Active · Anchors` bermaksud model JSON tidak dapat digunakan, tetapi sistem
  pengesanan lama masih berjalan sebagai backup.
- `AI Failed (Regex only)` bermaksud model TensorFlow gagal load dan hanya
  pemeriksaan perkataan/frasa jelas sedang berjalan.

### Status AI sekarang

```text
Setup training             Siap
Sambungan model ke website Siap
Model percubaan             Siap (100 rows total)
Fallback anchor/regex       Siap
Dataset besar dalam GitHub  Tidak, sengaja di-ignore
Sedia untuk demo/testing    Ya
Sedia dianggap model tepat Belum
```

100 rows tadi dibahagikan kepada 80 rows untuk model belajar dan 20 rows untuk
validation. Ia membuktikan sistem boleh train, export dan load model. Ia belum
membuktikan model cukup tepat untuk situasi sebenar.

### Bila perlu dataset Kaggle?

- Mahu guna atau demo model sekarang: **tidak perlu dataset**.
- Mahu train semula atau kuatkan model: **perlu download dataset**.
- Mahu edit UI atau fungsi chat sahaja: **tidak perlu dataset**.

### Bila perlu `npm run ai:train`?

Jalankan arahan itu hanya apabila mahu menghasilkan model baru. Training akan
menimpa `frontend/public/models/risk-classifier.json`, jadi periksa model baru
sebelum commit.

## Struktur projek

```text
frontend/public/          Fail website yang dihantar ke Firebase Hosting
backend/                  Dokumentasi dan ruang backend
tools/                    Script training dan pemeriksaan model
training-data/            Dataset tempatan (tidak masuk GitHub)
training-output/          Output eksperimen (tidak masuk GitHub)
AI_TRAINING.md            Panduan penuh training AI
firebase.json             Tetapan Firebase Hosting
```

## Setup pertama kali

Keperluan:

- Node.js 18 atau lebih baru
- Firebase CLI
- Dataset Kaggle untuk training semula

Pasang dependency:

```powershell
npm install
```

## Jalankan di localhost

Jangan buka fail HTML dengan klik dua kali. Jalankan Firebase Hosting Emulator
daripada folder utama projek:

```powershell
firebase.cmd emulators:start --only hosting
```

Buka alamat yang dipaparkan, biasanya `http://127.0.0.1:5000`. Jika port itu
sedang digunakan, Firebase mungkin memilih port lain seperti `5002`.

Masuk ke bilik chat dan lihat status AI:

- `AI Active · Trained`: model JSON berjaya digunakan.
- `AI Active · Anchors`: model JSON tiada atau rosak; sistem anchor digunakan.
- `AI Failed (Regex only)`: TensorFlow/USE gagal dimuatkan.

## Dataset besar tidak dimasukkan ke GitHub

Folder berikut telah dimasukkan dalam `.gitignore`:

```text
training-data/
training-output/
node_modules/
```

Oleh itu, fail `Suicide_Detection.csv` dan ZIP Kaggle tidak akan ikut semasa
`git add` atau `git push`. Setiap ahli kumpulan perlu download dataset sendiri
jika mahu train semula.

Fail `frontend/public/models/risk-classifier.json` pula sengaja dimasukkan ke
GitHub kerana ia kecil dan diperlukan oleh website untuk menjalankan model.

## Sebelum push

Periksa perubahan dan pastikan dataset tidak tersenarai:

```powershell
git status
git check-ignore -v training-data/Suicide_Detection.csv
npm run ai:test
```

Kemudian gunakan aliran Git biasa:

```powershell
git add .
git commit -m "Add trained AI risk classifier pipeline"
git push
```

Semak perubahan sebelum commit kerana repository ini turut mempunyai pemindahan
fail lama ke dalam folder `frontend/`.

## Deployment

```powershell
firebase.cmd deploy --only hosting
```

Firebase hanya menerbitkan `frontend/public`. Dataset training tidak akan
diterbitkan.

Untuk download dataset, train model dan menguji keputusan AI, baca
[AI_TRAINING.md](AI_TRAINING.md).

Panduan itu turut menerangkan jenis data yang boleh digunakan, cara membina test
set Melayu/Manglish, beza train/validation/test, cara mengesan false positive dan
false negative serta langkah menaikkan kekuatan model secara berperingkat.

> Pengesan ini hanyalah alat saringan awal, bukan diagnosis perubatan atau
> pengganti penilaian manusia. Keputusan berisiko perlu disemak dengan berhati-hati.
