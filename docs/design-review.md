# Layout and preview review — 22 October 2026

The original logo files remain unchanged. Their visible artwork has large transparent margins, so centering the full image did not center the visible logo. The fixed-width card image also clipped the top of the artwork on phones.

## Corrections

- Frame the complete white lockup using its measured alpha bounds; center that frame in the hero and digital card. Use the square emblem for header/footer badges.
- Center the about-panel emblem inside its available area and the map marker inside its rings. Allow narrow buttons and grid content to wrap without horizontal page overflow.
- Generate the GitHub Pages base path, HTML, CSS and JS from the same source as the Next.js app. Add content-specific titles, translated test notices and asset cache keys.
- Generate a working vCard with only the known name, organisation and website. Generate local QR SVGs for the Dutch and English card routes; no external QR service is used.
- Disable native form submission in preview HTML. JavaScript enables a demonstration handler that never sends or saves form contents.
- Serve SVG and vCard files with their correct media types in the local preview server.

## Verification

Browser checks cover logo containment and horizontal centering at 320, 390, 768, 1024 and 1440 px in both themes. Additional checks cover all 20 translated pages, broken images, JavaScript errors, repository-prefixed routes, the vCard download, QR display and zero form writes. Desktop/mobile screenshots are saved as CI artifacts for visual inspection.

The full build, type checks, unit/validation tests, database tests and 12 browser tests passed in [CI run 39775060172](https://github.com/Rutger0201/Beck-In-The-Gym/actions/runs/39775060172). The resulting screenshots were inspected and the Pages output was checked for 418 local page/asset references before updating the online preview.

The current imagery is the owner's supplied branding. No gym photography or trainer portrait has been supplied for BITG. The shared BITG document generator remains deferred; the existing Beck on the Rocks generator is at https://beckontherocks.nl/documenten.html and stores documents in the original browser.
