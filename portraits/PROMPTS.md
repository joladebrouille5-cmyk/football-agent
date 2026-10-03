# Prompts pour la banque de photos

Lots de 40 visages fictifs (grille 8 × 5), à générer hors de l'environnement puis découper selon `portraits/README.md` (« Ajouter un lot »).

**Pourquoi ces lots** : la banque compte 550 visages — `waf` 97, `lat` 93, `neu` 69, `bal` 63, `mix` 61, `eas` 58, `seu` 40, `mea` 40, `naf` 29. Priorité aux origines faibles : **naf** (Maroc, Algérie, Tunisie, Égypte, et une part des Français, Belges, Néerlandais) puis **seu** (Espagne, Italie, Portugal, Grèce, Argentine, Uruguay, Brésil) et **mea**.

Ordre conseillé : 1 → 2 → 3 → 6 → 4 → 5 → 7 → 9 → 8 → 10 → 11 → 12.

Code d'origine à saisir dans `PHOTO_FACES` : indiqué sous chaque titre. Pour le lot 12, les codes sont listés case par case sous le titre.

## 1. Afrique du Nord (Maroc, Algérie, Tunisie, Égypte, Libye)

Origine `PHOTO_FACES` : **naf**

```text
A REAL PHOTOGRAPH, not a 3D render, not CGI, not a video-game character, not an illustration, not digital art. Shot on a Canon EOS R5 with an 85mm lens at f/2.0, ISO 1600, during a night match: real skin pores, slight sweat, uneven skin tone, stray hairs, natural imperfections, slight motion of the crowd behind.

Generate a seamless grid of 40 of these real photos, exactly 8 columns × 5 rows, equal cells, thin white separators, edge to edge. No text, no numbers, no logos, no crests anywhere.

Every cell: head and shoulders, face centered, looking at camera, same eye height and head size. Background: blurred stadium at night with floodlight bokeh. Plain football shirt with no logos, in the colour given.

North African players, each fictional and visibly different, left to right, top to bottom:
Row 1: 1 Moroccan 22, light-olive skin, short black curly hair, thin beard, red · 2 Algerian 27, olive skin, black hair with fade, stubble, green · 3 Tunisian 19, light-tan skin, wavy dark-brown hair, red · 4 Egyptian 30, medium-brown skin, short black hair, trimmed beard, red · 5 Libyan 25, olive skin, buzz cut, moustache, green · 6 Moroccan 33, tan skin, receding hair, grey-flecked stubble, white · 7 Algerian 21, light skin, light-brown curly hair, green eyes, white · 8 Egyptian 24, brown skin, tight curly black hair, white
Row 2: 9 Tunisian 28, olive skin, side-parted black hair, short beard, white · 10 Moroccan 18, light-brown skin, short twists, red · 11 Egyptian 26, tan skin, thick eyebrows, crew cut, navy · 12 Algerian 31, olive skin, bald, goatee, green · 13 Moroccan 25, light skin, dark wavy hair, freckles, green · 14 Libyan 20, medium-brown skin, curly black hair, red · 15 Tunisian 23, tan skin, slicked black hair, stubble, red · 16 Algerian 29, light-olive skin, short dark hair, full beard, white
Row 3: 17 Egyptian 19, light-brown skin, black hair with high fade, white · 18 Moroccan 27, dark-tan skin, short black curls, light beard, red · 19 Algerian 24, light skin, dark-blond short hair, hazel eyes, green · 20 Tunisian 32, olive skin, greying temples, moustache, white · 21 Egyptian 29, medium-brown skin, thinning hair, stubble, red · 22 Moroccan 21, Amazigh features, light skin, dark wavy hair, green · 23 Libyan 26, olive skin, wavy hair, short beard, black · 24 Algerian 18, tan skin, curly black hair, white
Row 4: 25 Moroccan 30, brown skin, buzz cut, goatee, white · 26 Tunisian 20, light skin, brown curly hair, red · 27 Egyptian 33, olive skin, bald, short beard, red · 28 Algerian 23, tan skin, black hair with fade, thin moustache, green · 29 Moroccan 24, light-olive skin, black wavy hair, stubble, red · 30 Libyan 29, light-brown skin, short black hair, round face, green · 31 Egyptian 21, tan skin, thick wavy black hair, white · 32 Tunisian 26, olive skin, crew cut, full beard, red
Row 5: 33 Algerian 34, olive skin, receding hair, grey stubble, white · 34 Moroccan 19, tan skin, short black curls, red · 35 Egyptian 25, light-brown skin, slicked black hair, trimmed beard, navy · 36 Tunisian 22, light skin, dark-brown wavy hair, white · 37 Moroccan 28, Amazigh features, tan skin, short beard, green · 38 Algerian 20, light-brown skin, curly hair with fade, green · 39 Egyptian 27, medium-brown skin, buzz cut, moustache, red · 40 Libyan 31, olive skin, greying wavy hair, beard, green

Ordinary, unknown-looking footballers: no headbands, no long hair with long beard, no bleached hair, no glasses, no resemblance to real footballers or celebrities. Adjacent cells never alike.

STRICT: exactly 8 columns. Photographic, documentary sports photography — absolutely no 3D, no CGI, no plastic or waxy skin, no airbrushing. 16:9, high resolution.
```

## 2. Europe du Sud — Espagne & Portugal

Origine `PHOTO_FACES` : **seu**

```text
A REAL PHOTOGRAPH, not a 3D render, not CGI, not a video-game character, not an illustration, not digital art. Shot on a Canon EOS R5 with an 85mm lens at f/2.0, ISO 1600, during a night match: real skin pores, slight sweat, uneven skin tone, stray hairs, natural imperfections, slight motion of the crowd behind.

Generate a seamless grid of 40 of these real photos, exactly 8 columns × 5 rows, equal cells, thin white separators, edge to edge. No text, no numbers, no logos, no crests anywhere.

Every cell: head and shoulders, face centered, looking at camera, same eye height and head size. Background: blurred stadium at night with floodlight bokeh. Plain football shirt with no logos, in the colour given.

Iberian players, each fictional and visibly different, left to right, top to bottom:
Row 1: 1 Spanish 23, olive skin, black wavy hair, stubble, red · 2 Portuguese 27, light-olive skin, short dark-brown hair, short beard, dark red · 3 Spanish 19, light skin, light-brown curly hair, freckles, white · 4 Basque 30, light skin, strong jaw, short brown hair, red-and-white · 5 Portuguese 21, tan skin, black hair with fade, green · 6 Andalusian 26, olive skin, curly black hair, thin beard, green · 7 Galician 32, light skin, receding hair, brown beard, sky blue · 8 Portuguese 24, olive skin, slicked dark hair, white
Row 2: 9 Catalan 28, light skin, dark side-parted hair, stubble, claret · 10 Spanish 18, olive skin, black hair to the ears, red · 11 Portuguese 31, light skin, bald, short grey-flecked beard, red · 12 Spanish 25, tan skin, buzz cut, moustache, yellow · 13 Asturian 22, light skin, red-brown hair, blue · 14 Portuguese 29, olive skin, wavy brown hair, full beard, green · 15 Spanish 34, light-olive skin, greying short hair, white · 16 Valencian 20, tan skin, black curly hair, orange
Row 3: 17 Portuguese 23, light skin, dark-blond hair, light stubble, blue · 18 Spanish 27, olive skin, thick black eyebrows, crew cut, red · 19 Spanish 21, light skin, brown wavy hair, green eyes, white · 20 Portuguese 26, tan skin, short curly black hair, goatee, white · 21 Basque 24, light skin, short dark hair, long face, green · 22 Spanish 30, olive skin, thinning hair, stubble, blue · 23 Canarian 19, tan skin, black hair with fade, yellow · 24 Portuguese 33, light-olive skin, short beard, crew cut, black
Row 4: 25 Spanish 22, light skin, dark-brown hair with quiff, red · 26 Portuguese 20, olive skin, wavy black hair, white · 27 Andalusian 29, tan skin, short black hair, full trimmed beard, green · 28 Spanish 25, light skin, sandy-brown hair, freckles, sky blue · 29 Portuguese 28, light-olive skin, buzz cut, stubble, dark red · 30 Catalan 31, light skin, salt-and-pepper hair, blue · 31 Spanish 18, olive skin, curly brown hair, yellow · 32 Galician 26, light skin, short dark hair, moustache, white
Row 5: 33 Portuguese 25, olive skin, side-parted dark hair, thin beard, green · 34 Spanish 32, tan skin, bald, goatee, red · 35 Spanish 24, light skin, light-brown short hair, blue eyes, white · 36 Portuguese 19, light-olive skin, black spiky hair, red · 37 Valencian 27, olive skin, wavy hair, stubble, orange · 38 Basque 22, light skin, crew cut, freckles, red-and-white · 39 Spanish 29, olive skin, dark curly hair, short beard, navy · 40 Portuguese 34, light skin, receding grey hair, white

Ordinary, unknown-looking footballers: no headbands, no long hair with long beard, no bleached hair, no glasses, no resemblance to real footballers or celebrities. Adjacent cells never alike.

STRICT: exactly 8 columns. Photographic, documentary sports photography — absolutely no 3D, no CGI, no plastic or waxy skin, no airbrushing. 16:9, high resolution.
```

## 3. Europe du Sud — Italie & Grèce

Origine `PHOTO_FACES` : **seu**

```text
A REAL PHOTOGRAPH, not a 3D render, not CGI, not a video-game character, not an illustration, not digital art. Shot on a Canon EOS R5 with an 85mm lens at f/2.0, ISO 1600, during a night match: real skin pores, slight sweat, uneven skin tone, stray hairs, natural imperfections, slight motion of the crowd behind.

Generate a seamless grid of 40 of these real photos, exactly 8 columns × 5 rows, equal cells, thin white separators, edge to edge. No text, no numbers, no logos, no crests anywhere.

Every cell: head and shoulders, face centered, looking at camera, same eye height and head size. Background: blurred stadium at night with floodlight bokeh. Plain football shirt with no logos, in the colour given.

Italian and Greek players, each fictional and visibly different, left to right, top to bottom:
Row 1: 1 Italian 24, olive skin, black wavy hair, stubble, blue · 2 Greek 28, olive skin, dark curly hair, short beard, white · 3 Sicilian 21, tan skin, black hair with fade, red · 4 Italian 31, light skin, receding brown hair, beard, black-and-white · 5 Greek 19, light-olive skin, brown wavy hair, blue · 6 Sardinian 26, tan skin, short black hair, thick eyebrows, red · 7 Italian 23, light skin, light-brown hair, freckles, purple · 8 Cypriot 29, olive skin, crew cut, moustache, green
Row 2: 9 Italian 27, olive skin, slicked dark hair, trimmed beard, navy · 10 Greek 22, tan skin, short black curls, red · 11 Italian 18, light skin, dark-brown hair to the ears, sky blue · 12 Neapolitan 30, olive skin, buzz cut, stubble, sky blue · 13 Greek 33, light-olive skin, bald, grey beard, white · 14 Italian 25, light skin, dark-blond hair, blue eyes, yellow · 15 Calabrian 20, tan skin, curly black hair, red · 16 Greek 26, olive skin, side-parted hair, stubble, green
Row 3: 17 Italian 29, light skin, wavy brown hair, short beard, green · 18 Greek 24, olive skin, thick black eyebrows, crew cut, blue · 19 Sicilian 32, tan skin, greying curly hair, moustache, yellow · 20 Italian 21, olive skin, black spiky hair, black · 21 Cretan 27, light-olive skin, dark hair, full beard, white · 22 Italian 19, light skin, sandy hair, freckles, white · 23 Greek 30, tan skin, thinning hair, goatee, red · 24 Italian 23, olive skin, short curly hair, light stubble, purple
Row 4: 25 Greek 20, light skin, light-brown curly hair, sky blue · 26 Italian 26, olive skin, black hair with fade, beard, blue · 27 Sardinian 31, tan skin, short grey-flecked hair, red · 28 Italian 24, light skin, red-brown hair, green · 29 Greek 28, olive skin, slicked black hair, stubble, yellow · 30 Italian 34, light-olive skin, bald, short beard, black-and-white · 31 Cypriot 22, tan skin, wavy black hair, white · 32 Italian 25, olive skin, buzz cut, thin moustache, red
Row 5: 33 Italian 22, light skin, dark side-parted hair, green · 34 Greek 25, olive skin, short curly black hair, full beard, red · 35 Neapolitan 19, tan skin, black hair to the ears, sky blue · 36 Italian 30, light skin, receding brown hair, stubble, blue · 37 Greek 23, light-olive skin, crew cut, white · 38 Italian 28, olive skin, thick wavy hair, goatee, navy · 39 Sicilian 26, tan skin, curly hair, short beard, yellow · 40 Greek 32, olive skin, salt-and-pepper hair, white

Ordinary, unknown-looking footballers: no headbands, no long hair with long beard, no bleached hair, no glasses, no resemblance to real footballers or celebrities. Adjacent cells never alike.

STRICT: exactly 8 columns. Photographic, documentary sports photography — absolutely no 3D, no CGI, no plastic or waxy skin, no airbrushing. 16:9, high resolution.
```

## 4. Europe du Nord & de l'Ouest (Angleterre, Écosse, Irlande, Allemagne, Pays-Bas, Scandinavie)

Origine `PHOTO_FACES` : **neu**

```text
A REAL PHOTOGRAPH, not a 3D render, not CGI, not a video-game character, not an illustration, not digital art. Shot on a Canon EOS R5 with an 85mm lens at f/2.0, ISO 1600, during a night match: real skin pores, slight sweat, uneven skin tone, stray hairs, natural imperfections, slight motion of the crowd behind.

Generate a seamless grid of 40 of these real photos, exactly 8 columns × 5 rows, equal cells, thin white separators, edge to edge. No text, no numbers, no logos, no crests anywhere.

Every cell: head and shoulders, face centered, looking at camera, same eye height and head size. Background: blurred stadium at night with floodlight bokeh. Plain football shirt with no logos, in the colour given.

Northern and Western European players, each fictional and visibly different, left to right, top to bottom:
Row 1: 1 English 22, pale skin, ginger short hair, freckles, red · 2 Scottish 29, fair skin, dark-brown hair, short beard, navy · 3 Irish 19, pale skin, black curly hair, green · 4 German 26, light skin, blond crew cut, white · 5 Dutch 24, fair skin, light-brown wavy hair, orange · 6 Danish 31, fair skin, receding sandy hair, stubble, red · 7 Norwegian 21, pale skin, platinum-natural blond hair, blue eyes, red · 8 Swedish 27, fair skin, dark-blond hair, beard, yellow
Row 2: 9 Welsh 25, light skin, brown hair with side part, red · 10 German 33, light skin, bald, ginger beard, black · 11 Belgian 20, fair skin, curly brown hair, red · 12 English 28, light skin, short dark hair, stubble, white · 13 Austrian 23, fair skin, brown hair, freckles, red · 14 Swiss 30, light skin, thinning blond hair, red · 15 Dutch 18, pale skin, blond curly hair, orange · 16 Finnish 26, very fair skin, ash-blond buzz cut, white
Row 3: 17 Irish 32, fair skin, red-brown hair, full trimmed beard, green · 18 Icelandic 24, pale skin, strawberry-blond hair, blue · 19 German 21, light skin, dark-brown hair with fade, white · 20 English 26, pale skin, light-brown hair, long face, sky blue · 21 Norwegian 29, fair skin, brown wavy hair, moustache, red · 22 Scottish 19, pale skin, ginger buzz cut, blue · 23 Danish 23, fair skin, dark hair, stubble, white · 24 Dutch 34, light skin, greying short hair, orange
Row 4: 25 Swedish 20, fair skin, light-brown hair to the ears, blue · 26 English 30, light skin, receding dark hair, goatee, navy · 27 German 25, fair skin, sandy wavy hair, green · 28 Belgian 27, light skin, black short hair, beard, red · 29 Irish 22, pale skin, dark-brown hair, freckles, green · 30 Austrian 31, light skin, blond crew cut, stubble, white · 31 Welsh 18, fair skin, curly light-brown hair, red · 32 Danish 28, fair skin, ginger beard, short hair, red
Row 5: 33 Norwegian 24, pale skin, dark-blond side-parted hair, white · 34 Dutch 29, light skin, brown hair, short beard, orange · 35 English 21, fair skin, dark curly hair, white · 36 German 30, light skin, balding, brown stubble, black · 37 Scottish 26, pale skin, red hair, beard, navy · 38 Swiss 22, fair skin, brown hair with fade, red · 39 Finnish 33, fair skin, light hair, grey-flecked beard, blue · 40 Swedish 25, light skin, brown hair, freckles, yellow

Ordinary, unknown-looking footballers: no headbands, no long hair with long beard, no bleached hair, no glasses, no resemblance to real footballers or celebrities. Adjacent cells never alike.

STRICT: exactly 8 columns. Photographic, documentary sports photography — absolutely no 3D, no CGI, no plastic or waxy skin, no airbrushing. 16:9, high resolution.
```

## 5. Balkans & Europe de l'Est (Croatie, Serbie, Bosnie, Albanie, Pologne, Tchéquie, Ukraine, Roumanie)

Origine `PHOTO_FACES` : **bal**

```text
A REAL PHOTOGRAPH, not a 3D render, not CGI, not a video-game character, not an illustration, not digital art. Shot on a Canon EOS R5 with an 85mm lens at f/2.0, ISO 1600, during a night match: real skin pores, slight sweat, uneven skin tone, stray hairs, natural imperfections, slight motion of the crowd behind.

Generate a seamless grid of 40 of these real photos, exactly 8 columns × 5 rows, equal cells, thin white separators, edge to edge. No text, no numbers, no logos, no crests anywhere.

Every cell: head and shoulders, face centered, looking at camera, same eye height and head size. Background: blurred stadium at night with floodlight bokeh. Plain football shirt with no logos, in the colour given.

Balkan and Eastern European players, each fictional and visibly different, left to right, top to bottom:
Row 1: 1 Croatian 24, light skin, dark-brown hair, stubble, red-and-white · 2 Serbian 29, light skin, black crew cut, short beard, red · 3 Polish 20, fair skin, light-brown hair, white · 4 Ukrainian 27, fair skin, sandy buzz cut, yellow · 5 Albanian 22, olive skin, black wavy hair, thin beard, red · 6 Czech 31, light skin, receding brown hair, moustache, white · 7 Bosnian 19, light skin, dark curly hair, blue · 8 Romanian 26, light-olive skin, black hair with fade, yellow
Row 2: 9 Slovenian 23, fair skin, blond hair, blue eyes, green · 10 Hungarian 30, light skin, dark wavy hair, beard, red · 11 Montenegrin 25, light skin, tall face, short black hair, red · 12 Bulgarian 28, olive skin, bald, goatee, white · 13 Polish 33, fair skin, greying short hair, red · 14 Slovak 18, fair skin, brown hair to the ears, blue · 15 Kosovar 21, light-olive skin, dark hair, stubble, blue · 16 Ukrainian 24, fair skin, light-brown curly hair, blue
Row 3: 17 Serbian 20, light skin, dark-blond hair, green · 18 Croatian 32, light skin, salt-and-pepper hair, beard, blue · 19 Romanian 22, olive skin, curly black hair, red · 20 Czech 26, light skin, red-brown hair, freckles, red · 21 North Macedonian 29, olive skin, buzz cut, stubble, red · 22 Polish 24, light skin, dark side-parted hair, white · 23 Bosnian 27, light skin, black hair with quiff, short beard, white · 24 Lithuanian 19, very fair skin, blond crew cut, yellow
Row 4: 25 Albanian 31, olive skin, receding black hair, moustache, red · 26 Hungarian 21, fair skin, light-brown wavy hair, white · 27 Ukrainian 30, light skin, dark hair, full beard, blue · 28 Croatian 18, light skin, brown hair, blue eyes, red-and-white · 29 Georgian 25, olive skin, thick black hair, stubble, white · 30 Serbian 34, light skin, bald, grey stubble, red · 31 Romanian 28, light skin, brown crew cut, blue · 32 Slovak 23, fair skin, dark-brown curly hair, sky blue
Row 5: 33 Polish 27, fair skin, ginger beard, short hair, red · 34 Bosnian 22, light skin, black buzz cut, white · 35 Czech 20, fair skin, blond wavy hair, blue · 36 Bulgarian 26, olive skin, dark wavy hair, beard, green · 37 Latvian 29, very fair skin, sandy hair, stubble, dark red · 38 Montenegrin 31, light skin, greying temples, red · 39 Croatian 25, light skin, dark curly hair, thin beard, blue · 40 Armenian 24, olive skin, black hair, thick eyebrows, stubble, red

Ordinary, unknown-looking footballers: no headbands, no long hair with long beard, no bleached hair, no glasses, no resemblance to real footballers or celebrities. Adjacent cells never alike.

STRICT: exactly 8 columns. Photographic, documentary sports photography — absolutely no 3D, no CGI, no plastic or waxy skin, no airbrushing. 16:9, high resolution.
```

## 6. Moyen-Orient & Turquie (Turquie, Iran, Arabie saoudite, Golfe, Levant, Irak, Kurdistan)

Origine `PHOTO_FACES` : **mea**

```text
A REAL PHOTOGRAPH, not a 3D render, not CGI, not a video-game character, not an illustration, not digital art. Shot on a Canon EOS R5 with an 85mm lens at f/2.0, ISO 1600, during a night match: real skin pores, slight sweat, uneven skin tone, stray hairs, natural imperfections, slight motion of the crowd behind.

Generate a seamless grid of 40 of these real photos, exactly 8 columns × 5 rows, equal cells, thin white separators, edge to edge. No text, no numbers, no logos, no crests anywhere.

Every cell: head and shoulders, face centered, looking at camera, same eye height and head size. Background: blurred stadium at night with floodlight bokeh. Plain football shirt with no logos, in the colour given.

Middle Eastern players, each fictional and visibly different, left to right, top to bottom:
Row 1: 1 Turkish 23, light-olive skin, black hair with fade, stubble, red · 2 Saudi 27, medium-brown skin, short black hair, trimmed beard, green · 3 Iranian 20, light skin, thick wavy black hair, white · 4 Lebanese 29, olive skin, dark hair, short beard, white · 5 Iraqi 25, tan skin, curly black hair, moustache, green · 6 Kurdish 22, light skin, brown hair, stubble, red · 7 Emirati 31, tan skin, crew cut, goatee, white · 8 Jordanian 18, olive skin, black curls, red
Row 2: 9 Turkish 32, olive skin, receding hair, grey-flecked beard, yellow · 10 Syrian 24, light skin, dark side-parted hair, red · 11 Qatari 26, brown skin, short hair, thin beard, burgundy · 12 Iranian 28, olive skin, bald, full trimmed beard, red · 13 Palestinian 21, tan skin, wavy black hair, white · 14 Turkish 19, light skin, light-brown curly hair, navy · 15 Omani 30, dark-tan skin, short black hair, moustache, red · 16 Kuwaiti 23, olive skin, buzz cut, stubble, blue
Row 3: 17 Iranian 25, light skin, black slicked hair, stubble, white · 18 Saudi 20, tan skin, curly hair with fade, white · 19 Turkish 27, olive skin, dark wavy hair, short beard, black-and-white · 20 Iraqi 33, olive skin, greying hair, moustache, white · 21 Lebanese 22, light skin, dark-brown hair, green eyes, red · 22 Bahraini 28, brown skin, crew cut, goatee, red · 23 Kurdish 31, light-olive skin, thinning hair, beard, green · 24 Azerbaijani 24, light skin, black hair, thick eyebrows, blue
Row 4: 25 Turkish 21, light-olive skin, short black hair, yellow · 26 Saudi 32, medium-brown skin, bald, short beard, blue · 27 Iranian 19, olive skin, black curly hair, red · 28 Jordanian 26, light skin, brown wavy hair, stubble, white · 29 Yemeni 24, brown skin, short curly hair, thin moustache, red · 30 Syrian 29, olive skin, crew cut, full beard, red · 31 Emirati 22, tan skin, black hair with fade, white · 32 Turkish 30, light skin, dark hair, moustache, green
Row 5: 33 Iraqi 20, tan skin, black wavy hair, green · 34 Iranian 31, olive skin, salt-and-pepper hair, trimmed beard, red · 35 Lebanese 27, olive skin, curly brown hair, white · 36 Saudi 25, tan skin, buzz cut, thin beard, yellow · 37 Turkish 24, olive skin, side-parted black hair, stubble, red · 38 Qatari 19, brown skin, short black hair, burgundy · 39 Kurdish 28, light skin, dark curly hair, beard, red · 40 Palestinian 33, tan skin, receding hair, grey stubble, green

Ordinary, unknown-looking footballers: no headbands, no long hair with long beard, no bleached hair, no glasses, no resemblance to real footballers or celebrities. Adjacent cells never alike.

STRICT: exactly 8 columns. Photographic, documentary sports photography — absolutely no 3D, no CGI, no plastic or waxy skin, no airbrushing. 16:9, high resolution.
```

## 7. Asie de l'Est (Japon, Corée, Chine)

Origine `PHOTO_FACES` : **eas**

```text
A REAL PHOTOGRAPH, not a 3D render, not CGI, not a video-game character, not an illustration, not digital art. Shot on a Canon EOS R5 with an 85mm lens at f/2.0, ISO 1600, during a night match: real skin pores, slight sweat, uneven skin tone, stray hairs, natural imperfections, slight motion of the crowd behind.

Generate a seamless grid of 40 of these real photos, exactly 8 columns × 5 rows, equal cells, thin white separators, edge to edge. No text, no numbers, no logos, no crests anywhere.

Every cell: head and shoulders, face centered, looking at camera, same eye height and head size. Background: blurred stadium at night with floodlight bokeh. Plain football shirt with no logos, in the colour given.

East Asian players, each fictional and visibly different, left to right, top to bottom:
Row 1: 1 Japanese 22, light skin, straight black hair with fringe, blue · 2 Korean 26, light skin, short black two-block cut, red · 3 Chinese 19, light skin, black buzz cut, red · 4 Japanese 29, tan skin, short dark-brown hair, stubble, white · 5 Korean 24, light skin, side-parted black hair, white · 6 Chinese 31, light-tan skin, receding black hair, red · 7 Japanese 20, light skin, wavy black hair, navy · 8 Korean 28, tan skin, crew cut, thin moustache, blue
Row 2: 9 Chinese 25, light skin, black hair with fade, white · 10 Japanese 33, light skin, short greying hair, red · 11 Korean 18, light skin, black hair to the eyebrows, red · 12 Chinese 27, tan skin, short spiky hair, yellow · 13 Japanese 23, light-tan skin, dark-brown curly perm, blue · 14 Korean 30, light skin, short hair, goatee, white · 15 Chinese 21, light skin, round face, black crew cut, blue · 16 Japanese 26, tan skin, buzz cut, green
Row 3: 17 Korean 22, light skin, wavy black hair, sky blue · 18 Japanese 28, light skin, slicked black hair, light stubble, red · 19 Chinese 33, light-tan skin, thinning hair, red · 20 Korean 25, tan skin, short black hair, long face, yellow · 21 Japanese 19, light skin, dark-brown hair, white · 22 Chinese 23, light skin, black hair with side part, green · 23 Korean 31, light skin, crew cut, stubble, navy · 24 Japanese 24, tan skin, short curly black hair, orange
Row 4: 25 Chinese 20, light skin, black wavy hair, white · 26 Japanese 30, light skin, receding hair, moustache, blue · 27 Korean 21, light skin, buzz cut, green · 28 Chinese 28, tan skin, short beard, crew cut, red · 29 Japanese 25, light skin, black hair with fade, red · 30 Korean 34, light-tan skin, greying short hair, white · 31 Chinese 24, light skin, dark-brown hair, freckles, blue · 32 Japanese 22, tan skin, spiky black hair, white
Row 5: 33 Korean 27, light skin, side-parted hair, thin beard, red · 34 Japanese 21, light skin, straight hair to the ears, navy · 35 Chinese 30, light-tan skin, buzz cut, stubble, yellow · 36 Korean 19, light skin, black curly perm, blue · 37 Japanese 32, tan skin, bald, short beard, red · 38 Chinese 26, light skin, slicked black hair, white · 39 Korean 23, tan skin, short dark hair, red · 40 Japanese 27, light skin, wavy hair, light stubble, green

Ordinary, unknown-looking footballers: no headbands, no long hair with long beard, no bleached hair, no glasses, no resemblance to real footballers or celebrities. Adjacent cells never alike.

STRICT: exactly 8 columns. Photographic, documentary sports photography — absolutely no 3D, no CGI, no plastic or waxy skin, no airbrushing. 16:9, high resolution.
```

## 8. Amérique centrale, Mexique & Andes (complète « lat »)

Origine `PHOTO_FACES` : **lat**

```text
A REAL PHOTOGRAPH, not a 3D render, not CGI, not a video-game character, not an illustration, not digital art. Shot on a Canon EOS R5 with an 85mm lens at f/2.0, ISO 1600, during a night match: real skin pores, slight sweat, uneven skin tone, stray hairs, natural imperfections, slight motion of the crowd behind.

Generate a seamless grid of 40 of these real photos, exactly 8 columns × 5 rows, equal cells, thin white separators, edge to edge. No text, no numbers, no logos, no crests anywhere.

Every cell: head and shoulders, face centered, looking at camera, same eye height and head size. Background: blurred stadium at night with floodlight bokeh. Plain football shirt with no logos, in the colour given.

Mexican and Central American players, each fictional and visibly different, left to right, top to bottom:
Row 1: 1 Mexican 23, brown skin, black hair with fade, stubble, green · 2 Guatemalan 20, Mayan features, straight black hair, white · 3 Costa Rican 27, tan skin, curly black hair, red · 4 Honduran 25, brown skin, short black curls, blue · 5 Mexican 31, mestizo, receding hair, moustache, white · 6 Salvadoran 22, tan skin, spiky black hair, blue · 7 Panamanian 29, dark-brown skin, short beard, red · 8 Mexican 18, light-brown skin, wavy black hair, green
Row 2: 9 Nicaraguan 24, brown skin, buzz cut, blue · 10 Mexican 28, tan skin, slicked black hair, goatee, burgundy · 11 Guatemalan 30, indigenous features, round face, short hair, blue · 12 Mexican 21, light skin, light-brown hair, freckles, white · 13 Costa Rican 33, tan skin, greying hair, beard, red · 14 Honduran 19, mestizo, black hair to the ears, white · 15 Mexican 26, brown skin, crew cut, thin beard, yellow · 16 Panamanian 23, dark skin, short twists, red
Row 3: 17 Mexican 30, medium-brown skin, bald, short beard, green · 18 Salvadoran 26, tan skin, black curly hair, stubble, blue · 19 Mexican 20, mestizo, black hair with high fade, red · 20 Guatemalan 24, light-brown skin, side-parted hair, white · 21 Costa Rican 22, light-tan skin, wavy brown hair, red · 22 Mexican 34, tan skin, thinning grey hair, moustache, navy · 23 Honduran 28, brown skin, short hair, goatee, blue · 24 Mexican 25, indigenous features, straight black hair, yellow
Row 4: 25 Peruvian 22, Andean features, black crew cut, red-and-white · 26 Bolivian 27, Quechua features, short black hair, green · 27 Mexican 19, light-brown skin, curly black hair, green · 28 Ecuadorian 29, mestizo, stubble, buzz cut, yellow · 29 Mexican 24, tan skin, dark wavy hair, thin moustache, white · 30 Guatemalan 32, Mayan features, greying short hair, blue · 31 Mexican 26, brown skin, black hair with quiff, short beard, red · 32 Salvadoran 21, tan skin, short curls, blue
Row 5: 33 Mexican 27, light-brown skin, side-parted black hair, white · 34 Costa Rican 20, tan skin, black hair with fade, red · 35 Mexican 32, mestizo, receding hair, beard, green · 36 Honduran 23, brown skin, curly black hair, blue · 37 Mexican 21, tan skin, buzz cut, freckles, yellow · 38 Peruvian 30, indigenous features, round face, short black hair, white · 39 Mexican 25, brown skin, wavy hair, stubble, burgundy · 40 Nicaraguan 28, tan skin, short black hair, goatee, blue

Ordinary, unknown-looking footballers: no headbands, no long hair with long beard, no bleached hair, no glasses, no resemblance to real footballers or celebrities. Adjacent cells never alike.

STRICT: exactly 8 columns. Photographic, documentary sports photography — absolutely no 3D, no CGI, no plastic or waxy skin, no airbrushing. 16:9, high resolution.
```

## 9. Métissés & diaspora (Caraïbes, Brésil, Cap-Vert, Europe, Amérique du Nord)

Origine `PHOTO_FACES` : **mix**

```text
A REAL PHOTOGRAPH, not a 3D render, not CGI, not a video-game character, not an illustration, not digital art. Shot on a Canon EOS R5 with an 85mm lens at f/2.0, ISO 1600, during a night match: real skin pores, slight sweat, uneven skin tone, stray hairs, natural imperfections, slight motion of the crowd behind.

Generate a seamless grid of 40 of these real photos, exactly 8 columns × 5 rows, equal cells, thin white separators, edge to edge. No text, no numbers, no logos, no crests anywhere.

Every cell: head and shoulders, face centered, looking at camera, same eye height and head size. Background: blurred stadium at night with floodlight bokeh. Plain football shirt with no logos, in the colour given.

Mixed-heritage players from the Caribbean, Brazil, Cape Verde, Europe and North America, each fictional and visibly different, left to right, top to bottom:
Row 1: 1 Cape Verdean 22, light-brown skin, curly dark hair, green eyes, blue · 2 French 26, mixed Black and white heritage, light-brown skin, short curly hair, navy · 3 Brazilian 20, pardo, brown skin, wavy black hair, yellow · 4 Jamaican 28, medium-brown skin, short dreadlocks, yellow · 5 English 24, mixed heritage, tan skin, curly brown hair with fade, white · 6 Dominican 31, light-brown skin, buzz cut, goatee, blue · 7 Dutch 19, Surinamese heritage, brown skin, short twists, orange · 8 Portuguese 27, mixed Angolan heritage, light-brown skin, beard, red
Row 2: 9 Cuban 25, light-brown skin, curly black hair, thin moustache, red · 10 Belgian 21, mixed Congolese heritage, light-brown skin, curly hair, red · 11 Brazilian 33, moreno, bald, short beard, blue · 12 Haitian 23, brown skin, short afro, stubble, blue · 13 American 26, mixed heritage, tan skin, light-brown curls, freckles, white · 14 Puerto Rican 29, light-brown skin, wavy hair, beard, red · 15 Cape Verdean 18, brown skin, curly hair with fade, white · 16 Canadian 24, mixed Black and Asian heritage, light-brown skin, straight black hair, red
Row 3: 17 French 30, Antillean heritage, brown skin, short beard, crew cut, blue · 18 Brazilian 22, pardo, light-brown skin, curly hair, green eyes, yellow · 19 Trinidadian 25, mixed Indian and African heritage, brown skin, wavy black hair, red · 20 German 20, mixed heritage, light-brown skin, curly dark-blond hair, white · 21 Colombian 28, Afro-Colombian mixed, medium-brown skin, short curls, yellow · 22 English 32, mixed heritage, light-brown skin, receding hair, beard, navy · 23 Venezuelan 23, pardo, tan skin, black curls, burgundy · 24 Swedish 26, mixed Eritrean heritage, light-brown skin, short hair, yellow
Row 4: 25 Brazilian 27, light-brown skin, cornrows, light beard, blue · 26 Panamanian 21, mixed heritage, tan skin, curly hair with fade, red · 27 French 24, mixed Maghrebi and African heritage, brown skin, curly black hair, white · 28 Cape Verdean 30, brown skin, bald, goatee, blue · 29 Dominican 19, light-brown skin, curly hair, freckles, white · 30 American 29, mixed Mexican and Black heritage, brown skin, short beard, navy · 31 Irish 22, mixed Nigerian heritage, light-brown skin, curly reddish-brown hair, green · 32 Brazilian 25, moreno, short black hair, stubble, yellow
Row 5: 33 Guadeloupean 23, brown skin, short twists, red · 34 English 27, mixed Jamaican heritage, light-brown skin, buzz cut, white · 35 Brazilian 31, pardo, receding curly hair, grey-flecked beard, blue · 36 Norwegian 20, mixed Somali heritage, light-brown skin, short curls, red · 37 Cuban 28, tan skin, wavy black hair, moustache, blue · 38 Portuguese 24, mixed Cape Verdean heritage, brown skin, curly hair, green · 39 Canadian 26, mixed Filipino and white heritage, tan skin, black hair, red · 40 Colombian 22, mixed, light-brown skin, curly hair with fade, yellow

Ordinary, unknown-looking footballers: no headbands, no long hair with long beard, no bleached hair, no glasses, no resemblance to real footballers or celebrities. Adjacent cells never alike.

STRICT: exactly 8 columns. Photographic, documentary sports photography — absolutely no 3D, no CGI, no plastic or waxy skin, no airbrushing. 16:9, high resolution.
```

## 10. Afrique de l'Ouest & centrale (complète « waf »)

Origine `PHOTO_FACES` : **waf**

```text
A REAL PHOTOGRAPH, not a 3D render, not CGI, not a video-game character, not an illustration, not digital art. Shot on a Canon EOS R5 with an 85mm lens at f/2.0, ISO 1600, during a night match: real skin pores, slight sweat, uneven skin tone, stray hairs, natural imperfections, slight motion of the crowd behind.

Generate a seamless grid of 40 of these real photos, exactly 8 columns × 5 rows, equal cells, thin white separators, edge to edge. No text, no numbers, no logos, no crests anywhere.

Every cell: head and shoulders, face centered, looking at camera, same eye height and head size. Background: blurred stadium at night with floodlight bokeh. Plain football shirt with no logos, in the colour given.

West and Central African players, each fictional and visibly different, left to right, top to bottom:
Row 1: 1 Senegalese 23, very dark skin, short hair, thin beard, green · 2 Nigerian 27, dark-brown skin, low fade, stubble, green · 3 Ivorian 20, dark skin, short twists, orange · 4 Cameroonian 30, dark skin, bald, short beard, green · 5 Ghanaian 24, dark-brown skin, short afro, white · 6 Malian 22, very dark skin, tall face, buzz cut, yellow · 7 Guinean 26, dark skin, short curls, moustache, red · 8 Congolese 28, dark-brown skin, high-top fade, blue
Row 2: 9 Burkinabe 19, dark skin, short hair, round face, green · 10 Beninese 25, dark-brown skin, cornrows, yellow · 11 Togolese 31, dark skin, receding hair, goatee, yellow · 12 Gabonese 21, dark-brown skin, short twists, yellow · 13 Nigerian 33, dark skin, greying stubble, buzz cut, white · 14 Senegalese 26, very dark skin, short dreadlocks, white · 15 Cameroonian 18, dark-brown skin, short afro, red · 16 Ivorian 29, dark skin, full trimmed beard, orange
Row 3: 17 Ghanaian 22, dark skin, low fade, freckles, white · 18 Malian 28, dark-brown skin, short hair, thin moustache, green · 19 Congolese 24, very dark skin, short beard, crew cut, sky blue · 20 Nigerian 20, dark-brown skin, short curls with part, green · 21 Guinean 30, dark skin, bald, stubble, red · 22 Senegalese 19, dark skin, high-top fade, white · 23 Sierra Leonean 27, dark-brown skin, short twists, blue · 24 Cameroonian 25, dark skin, goatee, buzz cut, green
Row 4: 25 Ivorian 31, dark-brown skin, salt-and-pepper beard, orange · 26 Gambian 21, very dark skin, short afro, red · 27 Nigerian 26, dark skin, cornrows, light beard, white · 28 Malian 24, dark skin, round face, short hair, yellow · 29 Ghanaian 29, dark-brown skin, receding hair, moustache, white · 30 Congolese 19, dark skin, short twists, red · 31 Beninese 23, dark-brown skin, buzz cut, green · 32 Senegalese 32, very dark skin, short beard, grey temples, green
Row 5: 33 Cameroonian 22, dark-brown skin, short dreadlocks, red · 34 Guinean 25, dark skin, crew cut, stubble, green · 35 Nigerian 18, dark-brown skin, short afro, white · 36 Togolese 27, dark skin, goatee, high fade, yellow · 37 Ivorian 24, dark-brown skin, short curls, white · 38 Malian 30, very dark skin, thin beard, buzz cut, green · 39 Ghanaian 20, dark skin, low fade, red · 40 Congolese 34, dark-brown skin, bald, grey stubble, blue

Ordinary, unknown-looking footballers: no headbands, no long hair with long beard, no bleached hair, no glasses, no resemblance to real footballers or celebrities. Adjacent cells never alike.

STRICT: exactly 8 columns. Photographic, documentary sports photography — absolutely no 3D, no CGI, no plastic or waxy skin, no airbrushing. 16:9, high resolution.
```

## 11. Afrique de l'Est & australe (Éthiopie, Kenya, Somalie, Afrique du Sud, Angola, Zambie…) — à classer en « waf »

Origine `PHOTO_FACES` : **waf**

```text
A REAL PHOTOGRAPH, not a 3D render, not CGI, not a video-game character, not an illustration, not digital art. Shot on a Canon EOS R5 with an 85mm lens at f/2.0, ISO 1600, during a night match: real skin pores, slight sweat, uneven skin tone, stray hairs, natural imperfections, slight motion of the crowd behind.

Generate a seamless grid of 40 of these real photos, exactly 8 columns × 5 rows, equal cells, thin white separators, edge to edge. No text, no numbers, no logos, no crests anywhere.

Every cell: head and shoulders, face centered, looking at camera, same eye height and head size. Background: blurred stadium at night with floodlight bokeh. Plain football shirt with no logos, in the colour given.

East and Southern African players, each fictional and visibly different, left to right, top to bottom:
Row 1: 1 Ethiopian 22, brown skin, narrow face, short curly hair, green · 2 Kenyan 26, dark skin, buzz cut, stubble, red · 3 Somali 20, brown skin, slim face, short hair, sky blue · 4 South African 28, dark-brown skin, short beard, crew cut, yellow · 5 Angolan 24, dark skin, short twists, red · 6 Zambian 30, dark-brown skin, bald, goatee, green · 7 Eritrean 19, brown skin, curly black hair, blue · 8 Tanzanian 25, dark skin, high fade, white
Row 2: 9 Ugandan 27, dark skin, round face, short afro, yellow · 10 Zimbabwean 23, dark-brown skin, short dreadlocks, green · 11 Ethiopian 31, brown skin, receding hair, moustache, green · 12 Mozambican 21, dark skin, short curls, red · 13 South African 20, Cape Coloured, light-brown skin, curly hair with fade, white · 14 Rwandan 29, dark-brown skin, tall face, buzz cut, blue · 15 Sudanese 26, very dark skin, short beard, white · 16 Malagasy 24, light-brown skin, straight black hair, red
Row 3: 17 Kenyan 19, dark-brown skin, short twists, white · 18 Somali 28, brown skin, short beard, crew cut, blue · 19 Angolan 32, dark skin, greying stubble, red · 20 Ethiopian 25, light-brown skin, curly afro, yellow · 21 South African 23, Zulu features, dark skin, low fade, yellow · 22 Tanzanian 30, dark-brown skin, goatee, blue · 23 Zambian 21, dark skin, round face, short hair, green · 24 Eritrean 27, brown skin, slim face, light beard, blue
Row 4: 25 Mozambican 26, dark-brown skin, cornrows, red · 26 Ugandan 22, dark skin, buzz cut, freckles, red · 27 Sudanese 30, very dark skin, bald, moustache, red · 28 Malagasy 28, tan skin, wavy black hair, stubble, green · 29 South African 34, light-brown skin, receding curly hair, beard, green · 30 Kenyan 24, dark skin, short afro, green · 31 Rwandan 20, dark-brown skin, short curls, yellow · 32 Ethiopian 29, brown skin, short hair, goatee, red
Row 5: 33 Zimbabwean 31, dark skin, short grey-flecked hair, green · 34 Angolan 20, dark-brown skin, high-top fade, black · 35 Somali 23, brown skin, curly hair, thin moustache, sky blue · 36 Tanzanian 27, dark skin, short dreadlocks, yellow · 37 Zambian 24, dark-brown skin, crew cut, stubble, orange · 38 South African 26, dark skin, short beard, buzz cut, white · 39 Eritrean 22, light-brown skin, wavy curly hair, blue · 40 Ugandan 33, dark skin, bald, short beard, black

Ordinary, unknown-looking footballers: no headbands, no long hair with long beard, no bleached hair, no glasses, no resemblance to real footballers or celebrities. Adjacent cells never alike.

STRICT: exactly 8 columns. Photographic, documentary sports photography — absolutely no 3D, no CGI, no plastic or waxy skin, no airbrushing. 16:9, high resolution.
```

## 12. Océanie, Asie du Sud & du Sud-Est (Australie, Pacifique, Inde, Indonésie…) — origines variées

Origine `PHOTO_FACES` : **neu / eas / mea / mix (voir légende)**

Codes par case : 1 neu, 2 mix, 3 eas, 4 mea, 5 eas, 6 neu, 7 eas, 8 eas, 9 mix, 10 mea, 11 eas, 12 neu, 13 mix, 14 mea, 15 eas, 16 mix, 17 mea, 18 eas, 19 neu, 20 mea, 21 mix, 22 eas, 23 neu, 24 mix, 25 eas, 26 neu, 27 mea, 28 eas, 29 mix, 30 eas, 31 eas, 32 mea, 33 eas, 34 mix, 35 eas, 36 mea, 37 neu, 38 eas, 39 mix, 40 eas.

```text
A REAL PHOTOGRAPH, not a 3D render, not CGI, not a video-game character, not an illustration, not digital art. Shot on a Canon EOS R5 with an 85mm lens at f/2.0, ISO 1600, during a night match: real skin pores, slight sweat, uneven skin tone, stray hairs, natural imperfections, slight motion of the crowd behind.

Generate a seamless grid of 40 of these real photos, exactly 8 columns × 5 rows, equal cells, thin white separators, edge to edge. No text, no numbers, no logos, no crests anywhere.

Every cell: head and shoulders, face centered, looking at camera, same eye height and head size. Background: blurred stadium at night with floodlight bokeh. Plain football shirt with no logos, in the colour given.

Players from Oceania, South Asia and Southeast Asia, each fictional and visibly different, left to right, top to bottom:
Row 1: 1 Australian 23, fair sun-tanned skin, sandy short hair, freckles, yellow · 2 Samoan 26, brown skin, broad face, short black curls, blue · 3 Indonesian 21, tan skin, straight black hair, red · 4 Indian 25, brown skin, black wavy hair, stubble, blue · 5 Vietnamese 22, light skin, black crew cut, red · 6 New Zealander 29, fair skin, brown hair, beard, white · 7 Thai 20, light-tan skin, black hair with fringe, blue · 8 Filipino 27, tan skin, short black hair, thin moustache, blue
Row 2: 9 Māori 24, brown skin, black curly hair, short beard, black · 10 Pakistani 28, light-brown skin, black hair, full trimmed beard, green · 11 Malaysian 19, tan skin, black hair with fade, yellow · 12 Australian 31, light skin, receding brown hair, stubble, green · 13 Fijian 25, dark-brown skin, short afro, white · 14 Bangladeshi 22, brown skin, side-parted black hair, green · 15 Indonesian 30, tan skin, buzz cut, goatee, red · 16 Tongan 21, brown skin, wide face, short curls, red
Row 3: 17 Indian 19, light-brown skin, curly black hair, sky blue · 18 Vietnamese 27, light-tan skin, short spiky hair, yellow · 19 Australian 20, fair skin, blond wavy hair, gold · 20 Sri Lankan 26, brown skin, crew cut, stubble, blue · 21 Filipino 23, mixed heritage, light-tan skin, wavy brown hair, white · 22 Thai 32, tan skin, short greying hair, red · 23 New Zealander 22, light skin, ginger crew cut, white · 24 Papua New Guinean 28, dark-brown skin, short curly hair, beard, red
Row 4: 25 Malaysian 26, light-brown skin, black hair, short beard, blue · 26 Australian 27, Greek-Australian, olive skin, dark curly hair, navy · 27 Indian 31, brown skin, bald, trimmed beard, blue · 28 Indonesian 24, light-tan skin, wavy black hair, white · 29 Samoan 20, brown skin, short twists, blue · 30 Nepali 23, light-brown skin, straight black hair, red · 31 Australian 29, Vietnamese-Australian, light skin, black hair with fade, yellow · 32 Pakistani 21, light skin, light-brown hair, green eyes, green
Row 5: 33 Filipino 30, tan skin, crew cut, moustache, blue · 34 New Zealander 25, Māori-European heritage, light-brown skin, wavy hair, black · 35 Thai 24, light skin, black hair to the ears, blue · 36 Indian 22, dark-brown skin, short curly hair, thin beard, orange · 37 Australian 33, fair skin, grey-flecked beard, short hair, green · 38 Vietnamese 19, light skin, black wavy hair, red · 39 Fijian 27, dark-brown skin, shaved head, goatee, white · 40 Indonesian 28, tan skin, side-parted black hair, stubble, red

Ordinary, unknown-looking footballers: no headbands, no long hair with long beard, no bleached hair, no glasses, no resemblance to real footballers or celebrities. Adjacent cells never alike.

STRICT: exactly 8 columns. Photographic, documentary sports photography — absolutely no 3D, no CGI, no plastic or waxy skin, no airbrushing. 16:9, high resolution.
```
