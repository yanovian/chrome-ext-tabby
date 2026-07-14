# Changelog

Updates for people who use Tabby. Newest first.

## 2.3.2 (unreleased)

- New **"Go play by yourself"** button sends Tabby off to peek
- The care menu is **steadier**: it stays open while you use it, no surprise peeks mid-click, and button highlights clear when you close it.
- Fixed Tabby sometimes **vanishing** instead of coming back when you tapped her mid-peek.

## 2.3.1

- The website links to our other projects.
- Fix the sub page icon on website.
- Side **edge peeks** rotate into the page.
- **Dev mood override** in the popup reliably applies.
- **Browser E2E tests** run in CI.

## 2.3.0

- Fix bugs
- Tabby speaks your **language**: pick from 39 languages in settings.
- A **marketing site** for Tabby lives at [yanovian.github.io/chrome-ext-tabby](https://yanovian.github.io/chrome-ext-tabby/).
- The marketing site shows Tabby in **sharp Lottie animations**, not blurry GIFs.
- The marketing site has **share previews** and search tags for social links.
- Read the **privacy policy** and **terms of service** on the marketing site, with links to the official files on GitHub.
- The marketing site is available in **39 languages**, with a language picker and right-to-left layout.
- Supports **Armenian** language.
- The language picker shows a **flag** beside each language name.
- Page **title and meta tags** follow the language you pick, including in view-source via locale URLs like `/fa/`.
- **Share preview images** match each language too.
- Share images ship **in the repo**; CI does not rebuild them every deploy.
- Tabby's **mood lines** sound like a real cat in every language, not machine translation.

## 2.2.4

- Store **description** says she skips some sites to avoid **distraction**.
- Improve the moods.

## 2.2.3

- Avoid more sites to be **less annoying**.

## 2.2.2

- Update the list of **sensitive sites** to avoid.

## 2.2.1

- **Moods stick better** after you feed, pet, play, or ask what's up: she stays **full** for hours, **happy** for a while, and won't nap right after you check in.
- **Hunger** builds more around **mealtimes** and less overnight.

## 2.2.0

- **Animated GIFs** are used instead of Lottie json.
- **Preload animations** on first install, so appear smoothly.
- Tabby **grows and scales in size with age** on screen and in the popup preview.
- **`pnpm gif:convert`** rebuilds GIFs with **gifski** for smoother colors.
- **Mood from sites and titles:** Netflix cheers her up; YouTube/Rutube use video titles; known news/social only; tutorials/books good, TikTok-style bad.

## 2.1.0

- **Stressed** on draining pages comes first; after about an hour on **social or news**, Tabby may feel **overwhelmed**: wide eyes with **pink toe-bean paws** sliding in from the sides to cover them. Leave those sites and she eases back to **stressed**, then **happy** after a minute away with a thank-you.
- **Dev mode** sliders **simulate** real time on social or news (or away), using the same **1 hour** and **1 minute** thresholds as production. Preview shows **stressed** after a few minutes on a feed, easing speech when you leave, then **happy** with thanks after a minute away.
- Tabby recognizes more **news sites**.
- Tabby shows on the **Chrome Web Store** right after install, on the page where you added her.
- The **first-meeting tour** notes that Tabby stays off **sensitive sites**.

## 2.0.5

- Tabby stays off **sensitive sites** (email, banking, GitHub, and similar).
- **Fix bugs**: Fix performance issues.
- Tabby stays **mostly visible**, appears on **install**, and **show on all tabs** brings her back on this page.

## 2.0.4

- **Fix bugs**: Tabby stays fast with many tabs open and wakes reliably on the active tab.

## 2.0.3

- **Fix bugs**: Tabby shows on install more reliably, and dragging no longer duplicates her.

## 2.0.2

- **Fix bugs**: Tabby shows on install without a refresh, animations play reliably, and the menu feels faster.

## 2.0.1

- **Fix bugs** in show/hide controls, the first-meeting tour, quiet visits, and the settings menu.
- The **animated preview** in the extension menu works again in the store build.

## 2.0.0
- The store download is **much smaller**: legacy PNG sprites and the bundled on-device model are gone.
- Tabby classifies pages from **known sites and title keywords** only without any local AI.

## 1.0.0

- Tabby is a **Lottie-animated** cat with gold eyes and a purple collar. **Her icon matches that look.** New users meet her in the **bottom-left** with a short **first-meeting tour**.
- The **care menu** is clearer: **do not disturb** has its own section, **Show Tabby on this page**, and **speech** sits beside the menu.
- **Skip intro** keeps Tabby **visible** and quiet. Her lines are **curated**, with hungrier **feed me** wording when she needs food.
- **Peek** and quiet **ambient** visits: she peeks in for a while, then ducks away. **Pet, play, or treat** during a peek brings her out happy.
- **Feeding and play** feel more real: hungry treats get a munching moment, play gets wild paws and jokes, and petting while hungry earns sass. The menu stays closed during those moments.

## 0.8.0

- Tabby only uses the **tab title and web address** to react to what you're reading. She never reads page text or your browsing history.
- Her mood changes only if you **stay on a page for about a minute**. Opening the same page again soon won't stack extra mood changes.
- **Smarter guesses** for familiar kinds of sites (social feeds, learning pages, YouTube, shopping, and more).
- The **Varied local speech** setting also helps when a page is hard to classify. Still fully on your device.

- During the day Tabby **stays out of the way** and only **pops in quietly** now and then (napping or grooming, no chat).
- Tap **More** for **Do not disturb** (30 minutes, 1 hour, or today) when you need focus on every tab.
- Fixed Tabby **coming back** after do not disturb when you open the extension menu.
- The extension menu shows **do not disturb** status with time left and lets you **cancel** it early.
- **Do not disturb** has its own section in the extension menu: set 30 minutes, 1 hour, or until end of today, or cancel early.
- **Show Tabby on this page** brings her back right away when you ask, even outside her quiet peek schedule.

## 0.7.0

- Fixed **Hide Tabby** in the care menu (More → Hide Tabby).
- Tabby shows on the **active tab only**, so she is lighter on battery and CPU.
- Smoother **appear and disappear** when she shows up or you hide her.
- Gentler **mood transitions** when her expression changes.
- Changelog added.

## 0.6.0

- Tabby stays **in sync across tabs**: same cat, same mood as you switch pages.

## 0.5.0

- Removed redundant **host permission** at install (Tabby still runs on pages you visit via the content script).
- New **getting-started tutorial**.

## 0.4.0

- Fixed duplicate cats showing up on the same page.

## 0.3.0

- Sprite and on-page display fixes.

## 0.2.0

- First public release.
- Floating cat companion with pet, feed, play, and mood check-ins.
- Grows through life stages; reacts to your browsing on your device.
- Show or hide Tabby globally or per page.
- Available in 40+ languages.
