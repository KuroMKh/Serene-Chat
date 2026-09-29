# Panduan Training AI Serene Chat

Panduan ini menerangkan cara download dataset, train model, melihat model dan
menguji model di localhost. Arahan ditulis untuk Windows PowerShell.

## Panduan paling ringkas untuk kawan yang baru pull

Terdapat dua perkara berbeza:

```text
Guna AI sedia ada       Tidak perlu CSV dan tidak perlu train
Train AI versi baru     Perlu CSV Kaggle dan jalankan script training
```

### Jika hanya mahu guna dan test AI sedia ada

1. Clone repository atau jalankan `git pull`.
2. Buka terminal dalam folder `firebase-chat`.
3. Pasang dependency projek:

```powershell
npm install
```

4. Hidupkan website:

```powershell
firebase.cmd emulators:start --only hosting
```

Jika komputer belum mempunyai Firebase CLI, pasang sekali dahulu:

```powershell
npm install -g firebase-tools
```

5. Buka URL yang dipaparkan dalam terminal.
6. Login, cipta atau masuk bilik chat.
7. Pastikan status menunjukkan `AI Active · Trained`.

Itu sahaja untuk penggunaan biasa. Model telah tersedia di:

```text
frontend/public/models/risk-classifier.json
```

Dataset Kaggle tidak diperlukan kerana dataset hanya digunakan untuk mengajar
model. Selepas belajar, website menggunakan hasil pembelajaran dalam fail JSON.
Bayangkan CSV seperti buku latihan dan model JSON seperti nota yang sudah dipelajari:
website hanya membawa nota, bukan keseluruhan buku.

### Status semasa yang perlu diketahui

Model JSON sekarang datang daripada 100 rows:

```text
50 contoh suicide + 50 contoh non-suicide = 100 rows
80 rows digunakan untuk training
20 rows digunakan untuk validation
```

Model ini sesuai untuk demo, memastikan integrasi berfungsi dan memulakan ujian.
Ia belum patut dianggap tepat kerana 100 contoh terlalu kecil dan kebanyakannya
English. Langkah seterusnya ialah test dengan ayat Melayu/Manglish, catat kesalahan
dan kemudian train semula menggunakan lebih banyak data.

### Cara berhentikan localhost

Pergi ke terminal yang menjalankan Firebase dan tekan:

```text
Ctrl+C
```

Bahagian selepas ini hanya diperlukan jika mahu memahami atau train semula AI.

## 1. Faham bahagian penting dahulu

Projek ini menggunakan:

- **TensorFlow.js** untuk menjalankan AI menggunakan JavaScript.
- **Universal Sentence Encoder (USE)** untuk menukar ayat kepada 512 nombor.
- **Logistic regression** untuk memberi skor risiko antara 0 hingga 1.
- **Regex dan kamus Manglish** sebagai perlindungan tambahan.

Dataset tidak dimasukkan terus ke dalam website. Dataset hanya digunakan semasa
training. Hasil training ialah satu fail kecil:

```text
frontend/public/models/risk-classifier.json
```

Website hanya memerlukan fail JSON tersebut, bukan fail CSV yang besar.

## 2. Download dataset Kaggle

Dataset yang digunakan:

```text
https://www.kaggle.com/datasets/nikhileswarkomati/suicide-watch
```

Cara paling mudah ialah download ZIP melalui browser, kemudian extract fail
`Suicide_Detection.csv` ke lokasi berikut:

```text
training-data/Suicide_Detection.csv
```

Struktur yang betul:

```text
firebase-chat/
  training-data/
    Suicide_Detection.csv
```

Pilihan lain, jika Kaggle CLI sudah dipasang dan login:

```powershell
New-Item -ItemType Directory -Force training-data
kaggle datasets download -d nikhileswarkomati/suicide-watch -p training-data --unzip
```

`training-data/` telah di-ignore oleh Git. Jangan pindahkan CSV ke
`frontend/public`, kerana folder itu akan diterbitkan ke website.

## 3. Pasang dependency

Pastikan Node.js 18 atau lebih baru telah dipasang. Dari folder utama projek:

```powershell
npm install
```

Arahan ini memasang TensorFlow.js, Universal Sentence Encoder dan pembaca CSV.
`node_modules/` tidak akan dimasukkan ke GitHub.

## 4. Train model kecil dahulu

Untuk ujian pertama, gunakan 100 baris keseluruhan:

```powershell
npm run ai:train -- --samples 50 --epochs 10
```

Perhatian: `--samples` ialah bilangan untuk **setiap class**. Jadi:

```text
--samples 50
= 50 suicide + 50 non-suicide
= 100 baris keseluruhan
```

Script akan:

1. Membaca CSV.
2. Memilih bilangan data yang seimbang.
3. Mengasingkan 80% untuk training dan 20% untuk validation.
4. Menukar teks kepada embedding USE.
5. Melatih classifier selama 10 epochs.
6. Memilih threshold berdasarkan validation set.
7. Menulis model ke `frontend/public/models/risk-classifier.json`.

Proses embedding mungkin mengambil masa beberapa minit pada CPU. Jangan tutup
terminal selagi mesej `Saved browser classifier` belum muncul.

## 5. Maksud samples dan epochs

`samples` menentukan jumlah data bagi setiap class. Lebih banyak data biasanya
memberi contoh yang lebih pelbagai, tetapi mengambil masa lebih lama.

`epochs` ialah berapa kali classifier belajar semula daripada data training.
Terlalu sedikit mungkin belum cukup belajar. Terlalu banyak pada dataset kecil
boleh menyebabkan model menghafal data.

Cadangan penggunaan:

```powershell
# Ujian fungsi: 100 baris total
npm run ai:train -- --samples 50 --epochs 10

# Eksperimen kecil: 2,000 baris total
npm run ai:train -- --samples 1000 --epochs 15

# Eksperimen lebih baik: 10,000 baris total
npm run ai:train -- --samples 5000 --epochs 20

# Training besar: 40,000 baris total
npm run ai:train -- --samples 20000 --epochs 20
```

Naikkan jumlah secara perlahan. Pastikan model kecil berfungsi sebelum menjalankan
training yang mengambil masa lama.

## 6. Periksa model selepas training

Jalankan:

```powershell
npm run ai:test
```

Jika berjaya, terminal akan memaparkan mesej seperti:

```text
Classifier artifact is valid (80 training samples).
```

Untuk training 100 baris, 80 digunakan untuk training dan 20 untuk validation.
Sebab itu nombor yang dipaparkan ialah 80.

Model boleh dibuka di:

```text
frontend/public/models/risk-classifier.json
```

Bahagian yang mudah difahami:

- `createdAt`: masa model dihasilkan.
- `trainingSamples`: bilangan data training.
- `validationSamples`: bilangan data validation.
- `epochs`: bilangan pusingan pembelajaran.
- `thresholds`: sempadan untuk low, medium dan high.
- `validation`: precision, recall dan F2 pada validation set.
- `weights`: 512 nombor yang dipelajari oleh model.
- `bias`: nombor tambahan dalam pengiraan classifier.

Jangan edit `weights` atau `bias` secara manual. Untuk mengubahnya, train semula.

Skor validation yang tinggi daripada 20 contoh belum membuktikan model betul-betul
bagus. Gunakan validation set yang lebih besar sebelum membuat kesimpulan.

## 7. Jalankan dan test di localhost

Hidupkan Firebase Hosting Emulator:

```powershell
firebase.cmd emulators:start --only hosting
```

Buka URL yang diberikan oleh Firebase dan masuk ke bilik chat. Pastikan status
menunjukkan:

```text
AI Active · Trained
```

Untuk menguji tanpa menyimpan mesej ke Firestore:

1. Tekan `F12` dalam browser.
2. Buka tab **Console**.
3. Jalankan contoh berikut:

```javascript
await analyzeRisk("I feel happy today")
await analyzeRisk("aku rasa kosong dan dah putus asa")
```

Contoh keputusan:

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

Maksud medan keputusan:

- `finalScore`: skor model antara 0 hingga 1.
- `riskLevel`: keputusan `none`, `low`, `medium` atau `high`.
- `isRisk`: `true` jika mesej ditanda berisiko.
- `isRegexMatch`: regex menjumpai frasa risiko yang jelas.
- `distressFloor`: peraturan tekanan Melayu/Manglish telah digunakan.
- `modelSource`: `trained` bermaksud model JSON sedang digunakan.

Tekan `Ctrl+C` dalam terminal untuk mematikan localhost.

## 8. Bagaimana tahu model semakin baik

Jangan nilai model menggunakan accuracy sahaja. Periksa perkara berikut:

- **False negative**: mesej berisiko tetapi model kata selamat. Ini paling penting
  untuk dikurangkan.
- **False positive**: mesej biasa tetapi model memberi amaran.
- **Recall**: berapa banyak mesej risiko berjaya dikesan.
- **Precision**: berapa banyak amaran yang benar-benar berkaitan risiko.

Dataset Kaggle menggunakan teks English daripada Reddit dan hanya mempunyai dua
label: `suicide` serta `non-suicide`. Aplikasi pula menggunakan empat tahap dan
juga menerima Bahasa Melayu/Manglish. Oleh itu, langkah seterusnya ialah membina
set ujian Melayu/Manglish yang disemak manusia.

Jangan gunakan mesej peribadi pengguna tanpa izin. Buang nama, nombor telefon,
alamat dan maklumat yang boleh mengenal pasti seseorang.

## 9. Dataset apa yang boleh digunakan

Model boleh diperbaiki menggunakan beberapa jenis data. Jangan campurkan semua
data tanpa mengetahui label dan tujuan asalnya.

### A. Dataset Kaggle suicide-watch

Dataset yang digunakan sekarang sesuai untuk belajar perbezaan asas:

```text
suicide
non-suicide
```

Kelebihannya ialah jumlah data besar dan dua class hampir seimbang. Kekurangannya:

- Kebanyakan teks ialah English.
- Teks berasal daripada Reddit, bukan perbualan chat Malaysia.
- Label hanya binary, bukan `low`, `medium` dan `high`.
- Label berdasarkan sumber komuniti boleh mengandungi kesilapan.

Dataset ini sesuai sebagai asas classifier, bukan satu-satunya bukti bahawa model
selamat digunakan.

### B. Dataset Melayu/Manglish buatan kumpulan

Ini data paling penting untuk aplikasi Serene Chat. Bina fail berasingan seperti:

```text
training-data/malay-evaluation.csv
```

Contoh struktur:

```csv
text,expected_level,category,notes
"hari ini aku keluar makan dengan kawan",none,normal,ayat biasa
"assignment ni membunuh aku",none,figurative,gurauan atau metafora
"aku penat sangat dan perlukan seseorang untuk dengar",low,distress,perlukan sokongan
"aku rasa dah tak ada harapan",medium,hopelessness,perlu disemak manusia
```

Contoh di atas hanya menunjukkan format. Label sebenar untuk data sensitif perlu
disemak oleh orang yang memahami konteks kesihatan mental. Elakkan seorang sahaja
menentukan semua label jika dataset akan digunakan dalam situasi sebenar.

Masukkan variasi bahasa yang pengguna sebenar mungkin taip:

- Bahasa Melayu formal dan tidak formal.
- Manglish dan campuran English.
- Singkatan seperti `tak`, `tk`, `dah`, `dh`, `nak` dan `nk`.
- Typo, perkataan berulang dan emoji.
- Ayat pendek serta ayat panjang.
- Ayat kiasan seperti `exam ni membunuh aku`.
- Ayat yang memetik atau membincangkan topik risiko tanpa menyatakan niat sendiri.
- Ayat normal tentang sekolah, keluarga, makanan, permainan dan aktiviti harian.

### C. Data simulasi

Ahli kumpulan boleh menulis ayat rekaan untuk menambah variasi awal. Tandakan
sumbernya sebagai `synthetic` supaya ia tidak bercampur tanpa rekod dengan data
sebenar. Data simulasi membantu menguji sistem tetapi tidak boleh menggantikan
data bahasa sebenar sepenuhnya.

### D. Data aplikasi sebenar

Jangan terus mengambil mesej chat pengguna untuk training. Data sebenar hanya
boleh digunakan jika terdapat izin yang jelas, proses membuang identiti dan
kaedah penyimpanan yang selamat. Padam nama, username, nombor telefon, alamat,
e-mel dan maklumat lain yang boleh mengenal pasti seseorang.

## 10. Asingkan train, validation dan test

Tiga kumpulan ini mempunyai tugas berbeza:

```text
Train       Model belajar daripada data ini
Validation  Digunakan untuk memilih threshold dan tetapan
Test        Digunakan sekali untuk mengukur keputusan akhir
```

Pembahagian mudah:

```text
70% train
15% validation
15% test
```

Script sekarang menggunakan 80% train dan 20% validation untuk eksperimen awal.
Untuk penilaian yang lebih dipercayai, sediakan satu fail test Melayu/Manglish
yang tidak pernah digunakan semasa training atau memilih threshold.

Peraturan penting:

- Jangan letakkan ayat yang sama dalam train dan test.
- Jangan ubah threshold berulang kali berdasarkan final test set.
- Simpan bilangan label secara seimbang jika boleh.
- Simpan versi dataset dan `seed` supaya eksperimen boleh diulang.
- Jangan uji model hanya menggunakan ayat yang digunakan semasa training.

## 11. Cara menguji dan meningkatkan kekuatan AI

### Langkah 1: Sahkan pipeline

Train 100 rows dan pastikan website memaparkan `AI Active · Trained`. Ini hanya
mengesahkan bahawa semua komponen bersambung dengan betul.

### Langkah 2: Bina test set sendiri

Mulakan dengan sekurang-kurangnya 100 hingga 300 ayat Melayu/Manglish yang tidak
berada dalam dataset training. Pastikan ada banyak contoh `none`, termasuk ayat
kiasan yang mudah menghasilkan false positive.

### Langkah 3: Catat expected dan predicted

Untuk setiap ayat, simpan:

```text
text
expected_level
predicted_level
finalScore
isRegexMatch
distressFloor
modelSource
```

Kemudian kumpulkan kesalahan kepada dua kumpulan utama:

- **False negative**: sepatutnya risiko tetapi model kata selamat.
- **False positive**: sepatutnya selamat tetapi model memberi amaran.

Untuk ujian kecil dalam browser Console, gunakan format ini:

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

Label contoh perlu disemak semula oleh kumpulan; tujuan kod ini ialah menunjukkan
cara membandingkan expected dan predicted secara tersusun.

### Langkah 4: Perbaiki mengikut jenis kesalahan

Jika banyak false negative English:

- Tambah jumlah sample Kaggle secara perlahan.
- Gunakan lebih banyak variasi ayat risiko dalam train set.
- Semak sama ada threshold terlalu tinggi.

Jika banyak false negative Melayu/Manglish:

- Tambah data Melayu/Manglish yang telah dilabel dengan baik.
- Tambah variasi ejaan kepada `SLANG_MAP` jika maksudnya benar-benar sama.
- Tambah regex hanya untuk frasa yang sangat jelas.

Jika banyak false positive:

- Tambah lebih banyak contoh selamat dan ayat kiasan.
- Semak `SAFE_ANCHORS` dan ayat normal yang hampir sama dengan ayat risiko.
- Semak threshold menggunakan validation set, bukan berdasarkan tekaan sahaja.

Jika model keliru antara `low`, `medium` dan `high`:

- Ingat bahawa dataset Kaggle hanya mempunyai dua label.
- Bina dataset severity yang mempunyai label `none/low/medium/high`.
- Tulis panduan label yang jelas sebelum beberapa orang melabel data.
- Ukur persetujuan antara pelabel sebelum menggunakan label tersebut.

### Langkah 5: Naikkan data secara berperingkat

Cadangan urutan eksperimen:

```text
100 rows     Semak sambungan sistem
2,000 rows   Semak masa training dan kesalahan jelas
10,000 rows  Bandingkan precision/recall
40,000 rows  Model eksperimen yang lebih pelbagai
dataset penuh hanya jika hasil sebelumnya masih bertambah baik
```

Lebih banyak data tidak semestinya lebih baik jika labelnya salah, duplicate atau
tidak sama dengan bahasa pengguna aplikasi.

### Langkah 6: Bandingkan setiap versi model

Untuk setiap eksperimen, rekodkan:

```text
Nama/versi model
Tarikh training
Bilangan sample
Seed dan epochs
Precision
Recall
F2
Bilangan false negative
Bilangan false positive
Keputusan test Melayu/Manglish
```

Jangan pilih model hanya kerana accuracy paling tinggi. Untuk alat saringan,
recall dan jumlah false negative sangat penting, tetapi terlalu banyak false
positive juga boleh menyebabkan pengguna mengabaikan amaran.

### Langkah 7: Ujian sebelum deploy

Sebelum menggantikan model lama:

1. Simpan salinan model lama.
2. Jalankan `npm run ai:test`.
3. Uji set English dan Melayu/Manglish yang sama pada kedua-dua model.
4. Bandingkan kesalahan, bukan hanya satu skor keseluruhan.
5. Uji `AI Active · Trained` di localhost.
6. Pastikan fallback `AI Active · Anchors` masih berfungsi jika JSON dibuang.
7. Minta ahli kumpulan semak keputusan sebelum deploy.

Model boleh dikatakan semakin kuat apabila keputusan pada **test set yang tidak
pernah dilihat** bertambah baik secara konsisten, terutama apabila false negative
berkurang tanpa menyebabkan false positive meningkat terlalu banyak.

## 12. Jika berlaku masalah

### `CSV needs text/class columns`

Pastikan fail yang betul berada di:

```text
training-data/Suicide_Detection.csv
```

### `AI Active · Anchors`

Model JSON mungkin tiada atau tidak sah. Jalankan:

```powershell
npm run ai:test
```

Kemudian train semula jika perlu.

### PowerShell tidak membenarkan `firebase.ps1`

Gunakan `firebase.cmd`:

```powershell
firebase.cmd emulators:start --only hosting
```

### Port 5000 sedang digunakan

Lihat URL sebenar dalam terminal. Firebase mungkin menggunakan port `5002` atau
port lain secara automatik.

## 13. Fail yang perlu dipush

Push fail berikut:

```text
frontend/public/js/ai-detector.js
frontend/public/models/risk-classifier.json
tools/train-ai.mjs
tools/test-ai-artifact.mjs
package.json
package-lock.json
README.md
AI_TRAINING.md
.gitignore
```

Jangan push:

```text
training-data/
training-output/
node_modules/
*.log
```

Sebelum push, gunakan `git status` dan pastikan CSV/ZIP Kaggle tidak kelihatan.

> Model ini ialah alat bantuan saringan, bukan diagnosis perubatan. Keputusan AI
> masih perlu dinilai oleh manusia yang sesuai.
