# Wellbeing rationale

Why Tabby reacts to "draining" sites and offers a cat companion at all, with sources.
This is internal design rationale for contributors, not user-facing health advice:
contribiotor should not copy these claims into `README.md`, the store listing, 
or `PRIVACY.md`. Tabby is a lighthearted mascot, not a medical or therapeutic product, 
and makes no health claims to end users.

## Social media and stress

Reputable health bodies and peer-reviewed research consistently link heavy social media
use to higher stress, anxiety, and lower mood, particularly for younger users:

- [U.S. Surgeon General's Advisory: Social Media and Youth Mental Health](https://www.hhs.gov/sites/default/files/sg-youth-mental-health-social-media-advisory.pdf)
  (U.S. Department of Health and Human Services): calls for urgent action given
  evidence of harm to adolescent mental health, and recommends limiting use.
- [Health Advisory on Social Media Use in Adolescence](https://www.apa.org/topics/social-media-internet/health-advisory-adolescent-social-media-use)
  (American Psychological Association, 2023): effects depend on use patterns and
  content, not just time spent; recommends monitoring and healthy-use habits.
- [Mental Health: Adolescent and School Health](https://www.cdc.gov/healthy-youth/mental-health/index.html)
  (CDC): tracks rising rates of persistent sadness and hopelessness among teens
  alongside growing social media use.
- [Social Media and Adolescent Health](https://www.nationalacademies.org/read/27396/chapter/3)
  (National Academies of Sciences, Engineering, and Medicine, consensus report):
  reviews the evidence base connecting social media use patterns to youth mental health.
- [Social Media and Mental Health in Children and Teens](https://www.hopkinsmedicine.org/health/wellness-and-prevention/social-media-and-mental-health-in-children-and-teens)
  (Johns Hopkins Medicine): practical guidance for recognizing when use is becoming
  harmful.
- [Social media's impact on our mental health and tips to use it safely](https://health.ucdavis.edu/blog/cultivating-health/social-medias-impact-our-mental-health-and-tips-to-use-it-safely/2024/05)
  (UC Davis Health): overview aimed at adults, with practical safe-use tips.
- [Link between excessive social media use and psychiatric disorders](https://www.sciencedirect.com/science/article/pii/S2352250X22000070)
  (*Annals of Medicine and Surgery*, peer-reviewed, also indexed on
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/37113864/)): stress is a key mediator
  between social media use and diagnosed mental health conditions.
- [Social Media and Mental Health](https://www.helpguide.org/mental-health/wellbeing/social-media-and-mental-health)
  (HelpGuide.org, clinician-reviewed nonprofit): reader-facing summary with concrete
  self-check questions for unhealthy use patterns.

This is the reasoning behind treating long, continuous sessions on social/news sites
as "draining" in `utils/draining-session.ts` (see [`mood-system.md`](./mood-system.md)):
not that any single visit is bad, but that sustained, uninterrupted time on these sites
is the pattern the research flags, so the mechanic specifically tracks continuous
dwell rather than any single visit.

## Pets, cats, and stress relief

There's also a research basis for the companion side of the design, not just the
warning side:

- [The Power of Pets](https://newsinhealth.nih.gov/2018/02/power-pets) (NIH News in
  Health): interacting with animals, including cats, is linked to lower cortisol and
  blood pressure and an improved mood.

## What this means for Tabby's design

Tabby's mood shifting to `stressed`/`overwhelmed` after a long stretch on a draining
site (see [`mood-system.md`](./mood-system.md)) is meant to read as a **gentle
nudge to notice the time passing**, not a warning, block, or judgment. It only
requires stepping away for a short while (or petting/playing, see the care-recovery
credit in the same doc) to ease back, by design: the point is a moment of noticing, not
friction.

The companion side (pet, feed, play, ask) leans on the same idea in reverse: a cat
presence in the corner of the screen, styled after the real comfort effect of pet
company, meant as light company during a browsing session rather than a feature that
diagnoses or treats anything.
