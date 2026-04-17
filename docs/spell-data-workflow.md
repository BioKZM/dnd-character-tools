# Spell Data Workflow

Bu proje için en verimli yol:

1. `Spells.md` içinde spell metnini neredeyse kaynaktan kopyala-yapıştır tutmak
2. Sadece özel / mekanik spell'leri `content/manual/spell_overrides.json` içinde yapısal olarak işaretlemek

Bu sayede:
- ana spell metni insan tarafından hızlı girilir
- parser tarafı açıklama, source, casting time, range, duration, spell list gibi bilgileri alır
- tooltip / chip / damage / scaling gibi kritik mekanikler override katmanından güvenli şekilde beslenir

## Recommended Source Format

`Spells.md` içindeki her spell şu omurgayı kullansın:

```md
===Armor of Agathys===
Source: Player's Handbook

_1st-level abjuration_

**Casting Time:** 1 action
**Range:** Self
**Components:** V, S, M (a cup of water)
**Duration:** 1 hour

A protective magical force surrounds you, manifesting as a spectral frost that covers you and your gear.
You gain 5 temporary hit points for the duration.
If a creature hits you with a melee attack while you have these hit points, the creature takes 5 cold damage.

**_At Higher Levels._** When you cast this spell using a spell slot of 2nd level or higher, both the temporary hit points and the cold damage increase by 5 for each slot.

**_Spell Lists._** [Warlock](http://dnd5e.wikidot.com/spells:warlock)
```

## Input Rules

- Spell başlangıcı her zaman `===Spell Name===`
- `Source:` satırı ayrı kalsın
- Subtitle satırı `_1st-level abjuration_` gibi tek satır olsun
- `Casting Time`, `Range`, `Components`, `Duration` kendi başlıklarıyla kalsın
- Ana açıklama paragrafları arasında boş satır bırakılabilir
- `At Higher Levels` varsa tek başlık altında kalsın
- `Spell Lists` satırı en sonda kalsın

## When To Use Overrides

`spell_overrides.json` sadece şu tip durumlar için gerekli:

- `damage`, `save`, `attack roll` bilgisi tooltip chip'lerinde görünmeli
- `At Higher Levels` mekanik olarak işlenmeli
- spell düz hasar değil, tetikleyici / retaliatory / move-based davranış içeriyor
- spell tooltip'inde hızlı karar verdiren yapı isteniyor

Örnek edge-case spell'ler:

- `Armor of Agathys`
- `Absorb Elements`
- `Booming Blade`
- `Green-Flame Blade`
- `Magic Missile`
- `Hex`
- `Eldritch Blast`

## Minimum Override Strategy

Tüm spell'leri override etmiyoruz.

Öncelik:

1. Cantrip'ler
2. Damage veren 1st-level spell'ler
3. Save / Attack roll isteyen spell'ler
4. `At Higher Levels` ile ciddi scaling alan spell'ler
5. Özel tetikleyici mekanik kullanan spell'ler

## Override Keywords

Önerilen `effect` anahtarları:

- `damage`
- `healing`
- `temp_hp`
- `retaliatory_damage`
- `bonus_damage`
- `move_trigger_damage`
- `aura_damage`
- `ac_bonus`
- `condition`
- `extra_projectile`

Önerilen `trigger` anahtarları:

- `on_hit`
- `on_melee_hit_while_temp_hp`
- `on_move`
- `on_start_of_turn`
- `on_fail_save`
- `while_active`
- `passive`

## Practical Recommendation

En iyi hız / doğruluk dengesi:

- spell metni: `Spells.md`
- özel mekanik veri: `content/manual/spell_overrides.json`

Yani ana metni sen hızlıca girersin, sadece problemli spell'leri yapısal olarak ayrıca işaretleriz.
