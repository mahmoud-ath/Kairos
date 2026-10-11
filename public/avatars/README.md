# Avatars

Kairos ships **two tiers of avatars**, one per sub-folder:

| Folder | Tier |
| --- | --- |
| `Standard/` | Standard |
| `Vip/` | Vip |

`src/lib/avatars.ts` lists them in `SEEDS` and derives everything else (id,
label, `src`, fallback initials and unlock requirement) from that list, so
**adding or removing an avatar is one line there plus the artwork file**.

## Unlock rule

- The **first two** avatars in the list are free.
- The rest unlock in **groups of three that share one milestone**, 10 completed
  tasks apart — so the first group opens at **10**, the next at **20**, and so
  on (`FREE_AVATAR_COUNT`, `UNLOCK_GROUP_SIZE`, `UNLOCK_STEP`).

The count is a lifetime total read from the append-only `TaskEvent` log, so
clearing completed tasks never takes an unlocked avatar away.

## Adding your own artwork

1. Drop the file into `Standard/` or `Vip/`.
2. Add one line to `SEEDS` in `src/lib/avatars.ts`:

```ts
{ name: "my-avatar", tier: "standard" },
```

The `id` becomes the file name, and the label is derived from it
(`"my-avatar"` → "My Avatar", `"01-athena-wisdom"` → "Athena Wisdom").

If you export PNG or WebP instead of SVG, change **one line**:

```ts
export const ARTWORK_EXTENSION = "png";
```

## Behaviour

- If a file is missing or fails to load, the avatar falls back to its initials on
  a coloured gradient, so a bad upload degrades instead of showing a broken
  image.
- Set `AVATAR_ARTWORK_READY = false` in the same module to ignore the files
  entirely and render initials only.

## A note on file size

These SVGs wrap embedded raster images, so they are **not** vector art and the
Next.js image optimiser cannot shrink them (it refuses SVG on purpose). Several
are 150–450 kB and three are ~3.3 MB, which makes the Settings picker heavy:
the grid lazy-loads, but a tile in view still downloads its full file.
Re-exporting the set as ~256×256 WebP or PNG (then setting
`ARTWORK_EXTENSION`) would cut the page weight by an order of magnitude.

