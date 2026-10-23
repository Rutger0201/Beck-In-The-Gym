# Design direction — owner review required

## Architectural Performance (approved 22 October 2026)

The owner chose concept B, "Architectural Performance", with the portrait and caption compositions of the editorial concept for later photography. Design tokens live at the top of `apps/web/app/global.css`: a monochrome palette (architectural black, graphite, silver, concrete, slab, soft white), semantic tokens per surface (`.tone-light` switches a section to the light concrete surface), a fluid type scale, spacing, motion and easing tokens. Display type is Barlow Condensed 400/500/600, body text Inter, labels and facts IBM Plex Mono, and the about-quote Instrument Serif italic. All fonts are self-hosted latin woff2 subsets under OFL.

The homepage hero shows a twelve-column hairline grid, the headline with a weight contrast instead of an outline word, and the first supplied coaching photograph in black and white (`public/photos`, AVIF and WebP at 480/800/1152 px). The crop is centred on Rutger and leaves out the second person and the lettering on their shirt (owner feedback, 23 October 2026). The header is transparent over the hero and becomes solid after scrolling. The mobile menu is a full-height panel with focus kept inside, Escape to close and page scroll locked while open. Content above the fold is never hidden; sections further down get a short entrance that is skipped under reduced motion.

Open: portrait photography of Rutger for the about panel (it shows the emblem until then) and further coaching images. The sections below describe the previous dark-only iteration and remain for history.


The supplied white transparent logo, white BG emblem on black and black logo on white are preserved under public/brand. The visual direction combines large condensed headlines, restrained champagne/olive neutrals, sharp grid alignment and personal, understandable copy. Inter handles reading text; Barlow Condensed handles display headings. Both are self-hosted with their OFL licences.

The owner requested dark-only presentation on 22 October 2026. Public pages and the standalone card use a single dark palette irrespective of system preference or any previously stored appearance choice. The theme selector is removed and no new appearance preference is stored. Admin and the business workbench already use dark UI. White document paper and QR backgrounds remain functional document/media surfaces, not a second interface theme. Controls have visible keyboard focus. The mobile navigation exposes its state and closes with Escape. Content is visible without reveal effects or JavaScript, and reduced-motion users get no motion.

The hero is a split layout with the original logo as the current visual. **No gym photography or video is claimed to be final.** After approved, licensed gym or trainer photos are supplied, replace the hero visual and the brand panel with responsive AVIF/WebP photographs. Do not imply a stock gym is DeMIX, fabricate trainer portraits, or publish misleading AI exercise images. A background video needs a poster, muted inline playback, a pause control, reduced-motion handling and a media-size budget before it is added.

Homepage progression: personal introduction → training goals → coaching formats → Rutger's approach → intake → local training arrangements → FAQ → introductory CTA. The full service page covers all five services. Experiences are prepared as a noindex page without testimonials. No reviews, diploma claims, customer statistics or result guarantees are invented.

Typography, creative direction and final imagery remain subject to owner review before publication. The same approval applies to the wording of training-location arrangements and any future AALO qualification statement.
