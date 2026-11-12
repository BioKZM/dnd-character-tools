# Codex of Echoes (dnd-character-tools)

Ev kampanyasi icin DnD Beyond tarzi karakter olusturucu. Next.js (App Router) + TypeScript,
statik export olarak GitHub Pages'e deploy edilir.

Canli kullanilan sayfalar: **Creator** (`/campaign/creator`) ve **Sheet** (`/campaign/sheet`).

## Klasorler

| Klasor | Ne icin |
| --- | --- |
| `src/` | Sitenin kodu (sayfalar, componentler, lib) |
| `data/` | Sitenin canli okudugu veri (ornegin `data/classes/`) |
| `content/` | Islenmis/kuratorlu icerik (henuz tasinmamis siniflar burada) |
| `assets/` | Gorseller |
| `docs/` | Veri hazirlama notlari |
| `_archive/` | Kullanilmayan eski kod (scenes, travel planner, eski yedekler). **Build'e girmez.** |
| `scripts/` | Python veri scriptleri, sadece lokalde (git'e girmez) |

## Komutlar

```bash
npm run dev        # lokal gelistirme (http://localhost:3000)
npm run check      # typecheck + data denetimi + production build (push'tan once bunu calistir)
npm run audit:data # sadece data denetimi (grant handler'lari, feat/spell referanslari)
npm run lint       # eslint
```

## Update cikma akisi

1. `npm run dev` ile degisikligi yap, tarayicida kontrol et.
2. `npm run check` - yesil ise GitHub'da da build olur.
3. `git add -A` -> `git commit -m "ne degisti"` -> `git push`
4. `main`'e push = otomatik deploy (`.github/workflows/deploy-pages.yml`). Sonucu GitHub'da **Actions** sekmesinde gor.

Kurallar:
- `src/` icindeki kod `_archive/` icinden **import etmesin** (archive build'e dahil degil).
- Zip/yedek dosyalari repo kokune koyabilirsin, `.gitignore` bunlari disarida tutar.
- Satir sonlari `.gitattributes` ile LF'e sabit; Windows'ta sahte "butun dosya degisti" diff'i cikmaz.

## Karakter motoru ve grant'ler

Lineage, class/subclass feature'i, invocation, pact boon, fighting style, feat ve background
karaktere ne kazandirdigini `grants` alaninda anlatir. Hesap tek yerde yapilir:
`src/lib/engine/derive.ts` -> `deriveCharacter(draft, catalog)`. Creator ve Sheet ayni sonucu kullanir.

Grant tipleri (`src/lib/engine/grants.ts`): `ability`, `proficiency` (skill/save/armor/weapon/tool/language),
`expertise`, `sense`, `speed`, `defense`, `hp`, `ac`, `initiative`, `spell`, `feat`, `resource`, `note`.

Ornek (Devil's Sight):

```json
{ "type": "sense", "sense": "devils-sight", "range": 120 }
```

Yeni icerik eklerken: JSON'a `grants` yaz -> `npm run audit:data` -> `npm run dev` ile sheet'te kontrol et.
`grants: []` olan bir sey ekranda sadece metin olarak gorunur.
