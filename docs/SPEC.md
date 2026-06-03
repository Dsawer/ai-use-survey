# UTAUT Anketi — Spesifikasyon

## Amaç
`source/UTAUT_Group_Matrices_2.xlsx` dosyasındaki UTAUT matris anketini, GitHub Pages'te
yayınlanabilen statik bir web sitesine dönüştürmek.

## Karar verilen gereksinimler (kullanıcı onaylı)
1. **Klasör yapısı:** Gerçek bir web sitesi gibi — `index.html` kökte, stiller `assets/css/`,
   betikler `assets/js/`, kaynak veriler `source/`, araçlar `tools/`, belgeler `docs/`.
2. **Tasarım:** Modern Akademik (açık) — beyaz/ferah zemin, indigo + teal vurgular, kaliteli
   tipografi, bol boşluk.
3. **Cevap ölçeği:** Her hücredeki 1–5 kutucukları **yatay** dizilir.
4. **Yerleşim (otomatik / responsive):**
   - **Masaüstü (≥ 880px):** Matris. Solda sorular (sabit/float sütun), üstte alt-alanlar
     (sabit başlık), her hücrede yatay 1–5. Gerekirse yatay kaydırma, soru sütunu sabit.
   - **Mobil (< 880px):** Otomatik **kart düzenine** geçer. Her soru bir kart; kart içinde her
     alt-alan bir satır ve yanında **yatay 1–5**. Telefonda rahat, büyük dokunma alanları.
5. **Dil:** Her şey Türkçe (sorular, yapı adları, alt-alanlar, ölçek etiketleri). Orijinal
   İngilizce metin denetim için `en` alanında saklanır.

## İçerik (Excel'den)
- 5 görev grubu (bölüm): GENEL · ÖĞRENME & BEYİN FIRTINASI · PROBLEM ÇÖZME ·
  RAPORLAMA, SUNUM & ORGANİZASYON · VERİ İŞLEME & KODLAMA
- Her bölümde 8 yapı bloğu / 25 ifade (PE, EE, Tutum, Sosyal Etki, Kolaylaştırıcı Koşullar,
  Öz-yeterlik, Kaygı [ters], Davranışsal Niyet).
- Alt-alan sayıları: 2, 3, 2, 5, 4 → toplam 16 alt-alan, 400 değerlendirme hücresi.
- Ölçek: 1 = Kesinlikle katılmıyorum … 5 = Kesinlikle katılıyorum.

## Özellikler
İlerleme çubuğu (X/400), Likert açıklaması, eksik alan doğrulaması (ilk eksiğe kaydırır),
otomatik kayıt (localStorage), JSON + CSV indirme, tamamlanma ekranı, ham Excel önizleme.

## Teknik
Vanilla HTML/CSS/JS; veri `assets/js/data.js` içine `window.SURVEY` olarak gömülü (file:// ve
Pages'te CORS sorunsuz). `tools/parse_excel.py` Excel→data.js üretir; `tools/verify_data.py`
yapı kontrolü yapar.

## Dosya planı
```
index.html
assets/css/styles.css
assets/js/data.js        (üretilen)
assets/js/app.js
source/  UTAUT_Group_Matrices_2.xlsx, Karya...xlsx, survey_data.json
tools/   parse_excel.py, verify_data.py
docs/    SPEC.md, excel_report.md, parse_report.md
README.md, .gitignore
```
