Archived 2026-10-02 from `.memory/archive/gpt-handoff.md` (not versioned): a work order written on 2026-09-29 for another model. History only; nothing here is in force.

# WORK ORDER — READ EVERY LINE BEFORE YOU TOUCH ANYTHING

You are a careful assistant. You will make small changes to an existing application. You will not design. You will
not improve. You will not reorganize. You will not "clean up". You will do only the ITEMS at the end, one at a time,
exactly as written. If something is not written in this document, you do not do it. If you do not understand
something, you STOP and ask (section 6).

## 1. WHAT THIS IS

- The folder is a git repository of a web application called Builder. It needs Node.js and npm.
- The application has strict internal rules. A wrong edit breaks the whole build. That is why this document exists.
- Everything you write (manifest text, commit messages) must be in English. Nothing in Portuguese.

## 2. SETUP — DO THIS FIRST, ONCE

1. Open a terminal in the folder that contains the file `package.json`.
2. Run: `git status`
   - It must print "nothing to commit, working tree clean".
   - If it prints anything else: STOP. Report the output. Do not continue.
3. Run: `git rev-parse HEAD`
   - Copy the result. This is the BASE commit. You need it at the end.
4. Run: `npm install`
   - Wait. It can take several minutes.
   - Then run `git status` again. If `package.json` or `package-lock.json` shows as modified, run
     `git restore package.json package-lock.json` and report it.
5. Run: `npm run check:fast`
   - Wait about one minute.
   - It must end with no error and no line containing "FAILED".
   - If it fails BEFORE you changed anything: STOP and report the full output.

## 3. WHAT YOU MAY EDIT, AND WHAT YOU MAY NEVER TOUCH

You may edit ONLY these files:

- `manifest/*.json` — the JSON files directly inside the folder `manifest` (never the subfolder `manifest/generated`)
- `src/i18n/locales/en.json` and `src/i18n/locales/pt-BR.json` — only if an ITEM names them
- `spec/BEHAVIOUR.md` — only if an ITEM names it

You may NEVER edit, create, move, rename or delete anything else. In particular:

- NEVER edit: any file inside `src/` (that is the application code), `tools/`, `tests/`, `design/`, `docs/`,
  `package.json`, any `.css` file, the folder `manifest/generated/`, `src/generated/`, `src/ui/tokens.css`,
  `src/ui/icons.svg`, `docs/INVENTORY.md`, `docs/inventory.json`.
- NEVER create new files. (One exception: the `patches` folder at the very end.)
- NEVER run: `npm run e2e`, `npm run ui`, `npx playwright`, or anything that opens a browser. The browser part is
  done by someone else.
- NEVER run: `git push`, `git branch`, `git checkout`, `git reset`, `git rebase`, `git commit --amend`.
- NEVER use pnpm or yarn. Only npm.
- NEVER rewrite a JSON file completely. Open it and change only the exact lines the ITEM needs. Keep the key order
  and the indentation exactly as they already are. No reformatting. No renaming. No comments. No reordering.

## 4. THE CONTENT RULES

1. Every control a person sees in the interface is described in the files `manifest/commands/*.json`. Nothing is
   invented in code. Your work is to fill in data, never to invent behaviour.
2. An icon name is a Lucide name: lower-case words joined by hyphens, for example `arrow-right`. It must exist in
   the list inside `manifest/generated/icons.json` (open that file and check). A name that is not in the list makes
   `npm run manifest:check` fail.
3. In `manifest/properties.json`, when a property has `"control": "keyword-buttons"` and a non-empty `"icons"`
   object, then EVERY keyword offered by that property's buttons must have an icon in that object. There must be no
   keyword without an icon. `npm run manifest:check` names any keyword that is missing one.
4. Every text a person reads on screen comes from `src/i18n/locales/en.json` (English is the source language).
   `src/i18n/locales/pt-BR.json` holds the Portuguese translation of the same keys. If an ITEM tells you to add a
   key, you must add it to BOTH files with the exact same key name. A missing key makes the tests fail.
5. Every JSON file must stay valid JSON at all times.

## 5. HOW TO DO ONE ITEM — FOLLOW EXACTLY THIS ORDER

1. Run `git status`. It must be clean. If not, STOP.
2. Read the ITEM. If you do not understand it exactly, STOP and ask. Do not guess. Do not do "something similar".
3. Open the file the ITEM names. Find the exact place. Change only what the ITEM says.
4. Run: `npm run manifest:check`
   - It must end with no error. If it fails, its message names the file and the reason. Fix exactly that reason.
   - Run it again until it passes.
5. Run: `npm run gen`
   - This command rewrites generated files from the manifest. That is allowed and expected. You still never edit
     those files by hand.
6. Run: `npm run inventory`
   - This command rewrites `docs/INVENTORY.md` and `docs/inventory.json`. That is allowed and expected.
7. Run: `git status --short`
   - Look at the list. It must contain ONLY: the file(s) the ITEM named, the generated files, and the inventory
     files. If any other file appears, STOP and report.
8. Run: `git add -A`
9. Run: `git commit -m "<one line, in English, no emoji, no signature>"`
   - Example of a good message: `Fill the icons of the position keyword buttons`
   - If git answers that it does not know who you are, first run:
     `git config user.name "GPT"` and `git config user.email "gpt@example.com"`
10. Run: `npm run check:fast`
    - Wait about one minute. It must end with no error and no line containing "FAILED".
    - If it fails: read the message, fix ONLY that problem, and repeat steps 7 to 10 with a NEW commit.
      Never use `--amend`. Maximum 3 tries for the same item. After 3 tries: STOP and report.
11. Move to the next ITEM. One item = one commit. Never do two items in one commit.

## 6. STOP RULES — STOP AND WRITE A QUESTION INSTEAD OF CONTINUING

STOP and report if any of these happens:

- `git status` is not clean at the start of an item.
- An ITEM is unclear, contradictory, or asks for something this document forbids.
- `npm run check:fast` fails 3 times on the same item.
- You feel the need to change a file that no ITEM names, or a file this document forbids.
- You need to create a file.

Do not work around a problem. Do not invent. Stop and write exactly what happened, with the full output.

## 7. WHAT YOU DELIVER AT THE END

After the last item, run these three commands:

1. `git format-patch BASE -o patches/` — replace BASE with the commit you copied in step 2.3.
2. `git log --oneline BASE..HEAD > commits.txt`
3. `npm run check:fast > check-output.txt 2>&1` — the last full run.

Then send back a zip containing: the whole `patches` folder, `commits.txt` and `check-output.txt`.
Also write, in plain text: which items you did, which items you did not do, and anything that failed.
Do not commit the patches folder. Do not push anything anywhere.

## 8. THE ITEMS

The person who gave you this document fills in this section. Each item must use exactly this format:

    ITEM 1
    FILE: manifest/properties.json
    EDIT: <exactly what to change, and where>
    RULE: <which rule of section 4 proves the change is right>

Rules for this section:

- Do only the items written here. Do not do anything else. Do not invent extra items.
- Do them in the order they are written.
- If this section is empty, or an item does not follow the format above, STOP and ask.

ITEMS:

(empty — the person fills this in)

## 9. THE STYLE PANEL REVIEW — A SECOND JOB, DONE AFTER THE ITEMS OF SECTION 8

### Part A — answer three questions honestly, before anything else

- Q1. Does this machine have Node.js, npm and Google Chrome installed?
- Q2. Can you start the application and control a browser on it? (Playwright is already installed in this project.)
- Q3. Can you open a PNG image file and SEE what is in it — the shapes, the text, the spacing — with your own eyes?

If any answer is NO: write one line saying which one is NO, skip this whole section, and say clearly that you did
not look at the panel. NEVER describe the panel from reading the source code. A description of something you did not
see is a false statement. Never write "the panel is ..." if you did not see the panel.

### Part B — look at the whole Style panel, in the real application, with your own eyes

1. Start the application and leave it running:
   `PORT=5330 npm run dev`
   Then open `http://localhost:5330/` in the browser you control.
2. You may create ONE file named `review.mjs` at the root of the project, to drive the browser with Playwright.
   Never commit it. Delete it when you finish. Nothing else may be created.
3. Build a page with one of each kind of element, using the application's own Insert tiles, one by one:
   a Container, a Heading, a Paragraph, an Image, a Link and a Button.
4. Select each element, one at a time. For each element, do ALL of this:
   - scroll the Style panel from its first line down to its very last line;
   - open EVERY collapsed section;
   - open EVERY dropdown menu, EVERY value list and EVERY picker that appears;
   - take a screenshot of every screen you see, one PNG per screen, saved in a folder `review-shots/`.
5. OPEN every PNG you took. LOOK at it. Do not read the file name: LOOK at the picture.
6. Compare each screen with the design. The folder `design/final/shots/` holds the design's own screenshots of this
   interface. Open them and compare them side by side with yours.
7. Write a file named `findings.md` at the root of the project (never commit it). One entry per problem, in EXACTLY
   this format:

       WHERE: <panel, section, control, as a person sees it on screen>
       WHAT I SAW: <one sentence: what is wrong — order, grouping, spacing, alignment, a label, a missing icon, a
       control that looks usable but does nothing, a value hard to read, two controls that say the same thing>
       SCREENSHOT: <the PNG file name that shows it>
       DESIGN: <the file in design/final/shots/ that shows how it should be, or "none">
       PROPOSED EDIT: <if and only if the fix is a change to one JSON value in manifest/, write the exact file and
       the exact before/after; otherwise write "needs code">

8. Do NOT fix anything. Do NOT edit any file for this review. The fixes are written by someone else as ITEMS of
   section 8, and you will apply those items in a later round, exactly as written.
