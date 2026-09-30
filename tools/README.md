# tools

Optional. Nothing here is needed to view the site: open `index.html` and you
are done.

## Live vs copy

`compare.mjs` opens the Webflow site and the local copy in headless Chromium,
walks both down the page to the same scroll positions, and saves a screenshot
of each into `shots/` (gitignored).

```bash
cd tools
npm install
node compare.mjs                              # both sites, 1440 and 375 wide
node compare.mjs --only local --width 1440    # just the copy
node compare.mjs --page privacy-policy.html --steps 0,900
```

It uses the Chromium at `/opt/pw-browsers` that the cloud sandbox provides;
change `executablePath` to run it elsewhere.
