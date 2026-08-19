# What to put in zanejamin/zanejamin.github.io

Everything here goes at the ROOT of the repo, keeping this exact structure.
The links between pages are relative, so the folders must sit next to index.html.

    index.html              <- REPLACES your current one
    si-menu.png             <- new
    si-wave.png             <- new
    si-boss.png             <- new
    space-invaders/         <- new folder (the playable game)
      index.html
      game.js
      assets/
    bible-clasp/            <- new folder (the case study page)
      index.html

## Files you are NOT uploading

Your existing images stay exactly where they are, untouched:
bruce-1.jpg, bruce-2.jpg, bruce-3.jpg, ncl-team-cert.jpg, ncl-individual-cert.jpg

Do not upload this file (UPLOAD-THIS.md) or SETUP-BETA-FORM.md. They are notes for you.

## One thing still missing

Save your three phone screenshots into the bible-clasp folder, with these exact names:

    bible-clasp/bc-today.png      home screen
    bible-clasp/bc-read.png       read screen
    bible-clasp/bc-profile.png    profile screen

They must be INSIDE bible-clasp/, not at the root. Both the project card on the
homepage and the case study page point at that same location, so you only need one
copy of each.

On the homepage card they are cropped to the top of each screen so the three tiles
line up evenly; clicking one opens the full screenshot in the lightbox. On the case
study page they are shown whole.

Until you add them, both galleries show broken images. Everything else works.

## Uploading through the GitHub website

1. Open the repo, click Add file, then Upload files.
2. Drag in: index.html, the three si-*.png files, and both folders
   (space-invaders and bible-clasp).
3. Scroll down, click Commit changes.
4. Wait a minute or two, then hard-refresh your site with Ctrl+Shift+R.

Uploading index.html with the same name replaces the old one. That is intended.

## After it is live, check these

- The Space Invaders card has a green "Play the demo" button that loads the game.
- The Bible Clasp card has a "Read the case study" button that opens the new page.
- On the Bible Clasp page, submit the beta form once yourself. Formspree holds
  everything until you click the confirmation link on the first submission.
- The three donate tiles are still placeholders. Send me your Cash App, Venmo and
  PayPal handles and I will wire them up.

## Known issue worth fixing separately

Your index.html loads Space Grotesk and Inter from Google Fonts, but its Content
Security Policy blocks external stylesheets, so those fonts have never actually
loaded and the site falls back to system fonts. The fix is to change the CSP line to:

    style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com;

I did not apply this, since it changes your canonical file and you should decide.
The new Bible Clasp page already has the corrected version.
