# PDMX pilot — Etapa 0 results

Run 2026-08-10 against PDMX **v8** (Zenodo record 15571083). The deliverable of
this stage was a number, not code. Here it is, and it does not support the plan
it was meant to validate.

## Headline

| If we… | We get |
| --- | --- |
| import only scores that already carry frets **and** are provably public domain | **~64 guitar songs** (87 across all string instruments) |
| also write the fretting pass — the largest block of work in the plan | **~233 songs** |

The fretting pass buys **146 songs**. That is weeks of work for a rounding error
on a catalog that was supposed to be "thousands".

## The funnel

Reproduce with `node tools/pdmx/analyze-metadata.mjs`.

| Stage | Count | of total |
| --- | ---: | ---: |
| PDMX v8 total | 254,077 | 100% |
| `subset:all_valid` | 254,035 | 100.0% |
| `subset:no_license_conflict` | 222,856 | 87.7% |
| `is_best_unique_arrangement` (PDMX's own dedup) | 102,635 | 40.4% |
| has **any** guitar part (GM programs 24–31) | 4,446 | 1.7% |
| guitar-led (guitar ≥ half the parts) | 2,175 | 0.9% |
| **usable** = valid + clean licence + guitar-led + unique | **1,439** | 0.6% |

The 1.7% is the number that kills the ambition. PDMX is a MuseScore dump, and
MuseScore is overwhelmingly piano and choral. Guitar is a rounding error in it.

## alphaTab handles the files fine

`node tools/pdmx/analyze-scores.mjs` over all 1,439:

- **1,439 parsed, 0 failures.** The MusicXML importer is not a risk. The earlier
  worry about "52% feature coverage" was about visual fidelity, not parsing.
- 463 (32.2%) have a stringed staff, and every one of those also has a
  tablature staff.
- **458 (31.8%) are fully fretted** — ≥95% of notes carry string+fret.
- 980 (68.1%) are plain notation, and would need fretting synthesised.
- Tunings found: 344 standard guitar, plus ukulele (`69,64,60,67`), mandolin
  (`76,69,62,55`) and bass (`55,50,45,40`). Of the 458 fretted, only **376** are
  six-string guitar; 69 are ukulele/mandolin, 6 bass.

One gotcha worth recording: a track carries **two staves** — notation and
tablature. Notes on the notation staff always report `string=-1, fret=-1`. Read
`staff.isStringed && staff.tuning.length > 0` and only then walk the notes.

## The finding that actually matters: the licence flag is not true

PDMX is published as a public-domain corpus. That flag comes from MuseScore
uploaders, and uploaders are wrong. Present in the already-fretted set, all
labelled `cc-zero`:

- `No Suprises (Acoustic Guitar Tab) by Radiohead`
- `Every Breath You Take - The Police`
- `All I Want for Christmas is You Ukulele`
- `Cavatina` — Stanley Myers, died 1993
- `The Sound of Silence` — Paul Simon
- Game and TV soundtracks: Pokémon, Night in the Woods, Krusty Krab, Steven
  Universe

So the dataset cannot be bulk-imported on trust. Each score has to be
*positively* established as public domain — the burden runs that way, and
"labelled cc-zero" is not evidence.

`node tools/pdmx/verify-licence.mjs` applies a defensible test: a composer
lifespan in the metadata whose death year is ≤ 1955 (life+70 clears in 2026), or
an explicit traditional/anonymous marker not attributable to a modern arranger.

| Verdict | Of the 458 fretted |
| --- | ---: |
| unverified | 373 (81.4%) |
| provably PD by composer death date | 57 (12.4%) |
| provably PD as traditional/anonymous | 27 (5.9%) |
| provably still in copyright | 1 (0.2%) |

Over all 1,439 usable scores the same test passes **233 (16.2%)** — genres
classical 141, folk 10. That 16% is the real conversion rate of this dataset,
not the 100% its licence column claims.

## What this means for the plan

1. **Drop the fretting pass.** It was the largest block of work and it buys 146
   songs. Revisit only if a much larger fretted corpus appears.
2. **The catalog is a curated library, not an index.** ~64–87 songs is 13–17×
   what the repo has today and worth importing, but "milhares de tabs" is not
   reachable from PDMX.
3. **Licence verification is a required pipeline stage, not a filter.** The
   positive-proof test above should gate every import, and each row needs
   `license`, `attributionName` and `source_url` recorded and shown.
4. Etapa 5 shrinks a lot: no fretting algorithm, just MusicXML → ASCII + MIDI +
   timing map for scores that already carry frets.

## Data

Downloads live in `C:\Dev\_pdmx` (outside the repo, 1.9 GB archive + 1,439
extracted scores). Artefacts: `pilot-metadata.json`, `pilot-scores.json`,
`pilot-fretted.json`, `pilot-licence.json`, `usable-index.json`.

Only `mxl.tar.gz`, `PDMX.csv` and `subset_paths.tar.gz` were fetched — `pdf`
(9.6 GB) and `data` (2.2 GB) are not needed. `mid.tar.gz` (214 MB) was not
fetched but is worth knowing about: PDMX ships MIDI, which may save generating
it in the pipeline.
