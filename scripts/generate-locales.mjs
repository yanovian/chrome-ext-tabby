#!/usr/bin/env node
/**
 * Generate public/_locales/<locale>/messages.json for manifest-facing strings
 * (extension description + toolbar tooltip). The extension NAME "Tabby" is a
 * brand and stays in Latin script for most locales. RTL locales (ar, fa)
 * use native words for "cat" instead of "Tabby".
 *
 * Translations live in the MESSAGES map below. Output is written to
 * public/_locales/ (gitignored). Regenerate with `pnpm locales`, or automatically
 * via postinstall and `pnpm assets` before dev/build/zip.
 *
 * Only Chrome-supported locale codes are used, one main variant per language
 * (see https://developer.chrome.com/docs/extensions/reference/api/i18n#locales).
 * Chinese and Portuguese require a region, so we use the most-spoken variant.
 *
 * Keep every description under Chrome's 132-character manifest limit.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', '_locales');

// [description, toolbar tooltip] per locale. RTL locales omit the "Tabby" brand.
const MESSAGES = {
  en: [
    'A cat lives in your browser. She reacts to your tabs and grows with you. She stays off some websites to avoid distraction.',
    'Tabby, your browser cat',
  ],
  es: [
    'Un gato en tu navegador. Reacciona a tus pestañas y crece contigo. Evita algunos sitios para no distraerte.',
    'Tabby, tu gato del navegador',
  ],
  fr: [
    'Un chat dans le navigateur. Réagit à vos onglets et grandit avec vous. Il évite certains sites pour ne pas vous distraire.',
    'Tabby, votre chat de navigateur',
  ],
  de: [
    'Katze lebt in deinem Browser. Reagiert auf Tabs und wächst mit dir. Sie meidet einige Seiten, um nicht abzulenken.',
    'Tabby, deine Browser-Katze',
  ],
  it: [
    'Un gatto vive nel browser. Reagisce alle schede e cresce con te. Evita alcuni siti per non distrarti.',
    'Tabby, il tuo gatto del browser',
  ],
  pt_BR: [
    'Um gato mora no seu navegador. Reage às abas e cresce com você. Fica fora de alguns sites para não distrair.',
    'Tabby, sua gata do navegador',
  ],
  nl: [
    'Een kat in je browser. Ze reageert op tabs en groeit mee. Ze mijdt sommige sites om afleiding te vermijden.',
    'Tabby, je browserkat',
  ],
  pl: [
    'Kot mieszka w przeglądarce. Reaguje na karty i rośnie z tobą. Omija niektóre strony, by nie rozpraszać.',
    'Tabby, twój kot w przeglądarce',
  ],
  ru: [
    'Кошка живёт в браузере. Реагирует на вкладки и растёт с вами. Не появляется на некоторых сайтах, чтобы не отвлекать.',
    'Tabby, ваша кошка в браузере',
  ],
  uk: [
    'Кішка живе у браузері. Реагує на вкладки й росте з вами. Не з’являється на деяких сайтах, щоб не відволікати.',
    'Tabby, ваша кішка в браузері',
  ],
  tr: [
    'Tarayıcında bir kedi yaşıyor. Sekmelere tepki verir ve seninle büyür. Dikkat dağıtmamak için bazı sitelerde görünmez.',
    'Tabby, tarayıcı kedinin',
  ],
  ar: [
    'قطة تعيش في متصفحك. تتفاعل مع تبويباتك وتكبر معك. لا تظهر على بعض المواقع لتجنب الإلهاء.',
    'قطة متصفحك',
  ],
  fa: [
    'گربه‌ای در مرورگر شما زندگی می‌کند. به تب‌ها واکنش می‌دهد و با شما بزرگ می‌شود. برای جلوگیری از حواس‌پرتی در برخی سایت‌ها نیست.',
    'گربه مرورگر شما',
  ],
  hi: [
    'ब्राउज़र में बिल्ली रहती है। टैब पर प्रतिक्रिया देती है और बढ़ती है। ध्यान भटकाने से बचने के लिए कुछ साइटों पर नहीं।',
    'Tabby, आपकी ब्राउज़र बिल्ली',
  ],
  bn: [
    'ব্রাউজারে বিড়াল থাকে। ট্যাবে প্রতিক্রিয়া জানায় এবং বড় হয়। মনোযোগ ভাঙতে না দিতে কিছু সাইটে থাকে না।',
    'Tabby, আপনার ব্রাউজারের বিড়াল',
  ],
  ta: [
    'உலாவியில் பூனை வசிக்கிறது. தாவல்களுக்கு எதிர்வினையாற்றி வளர்கிறது. கவனச்சிதறலைத் தவிர்க்க சில தளங்களில் தோன்றாது.',
    'Tabby, உங்கள் உலாவி பூனை',
  ],
  ja: [
    'ブラウザに猫が住んでいます。タブに反応し、一緒に成長します。気を散らさないよう、一部のサイトには出ません。',
    'Tabby、あなたのブラウザ猫',
  ],
  ko: [
    '브라우저에 고양이가 살아요. 탭에 반응하며 함께 자라요. 방해하지 않으려고 일부 사이트에는 나타나지 않아요.',
    'Tabby, 브라우저 고양이',
  ],
  zh_CN: [
    '一只猫住在你的浏览器里。她会根据标签页反应并陪你成长。为避免打扰，部分网站不会出现她。',
    'Tabby，你的浏览器猫咪',
  ],
  vi: [
    'Mèo trong trình duyệt của bạn. Phản ứng với thẻ và lớn lên cùng bạn. Không hiện ở một số trang để tránh làm bạn mất tập trung.',
    'Tabby, mèo trình duyệt của bạn',
  ],
  th: [
    'แมวอาศัยในเบราว์เซอร์ของคุณ ตอบสนองแท็บและโตไปกับคุณ ไม่โผล่บนไซต์บางแห่งเพื่อไม่ให้รบกวนสมาธิ',
    'Tabby แมวเบราว์เซอร์ของคุณ',
  ],
  id: [
    'Kucing tinggal di browser kamu. Bereaksi pada tab dan tumbuh bersamamu. Tidak muncul di beberapa situs agar tidak mengganggu.',
    'Tabby, kucing browser-mu',
  ],
  ms: [
    'Kucing dalam pelayar anda. Bertindak balas pada tab dan membesar. Tidak muncul di beberapa laman untuk elak gangguan.',
    'Tabby, kucing pelayar anda',
  ],
  fil: [
    'May pusa sa browser mo. Tumutugon sa tab at lumalaki kasama mo. Hindi lumalabas sa ilang site para hindi makagambala.',
    'Tabby, pusa sa browser mo',
  ],
  sw: [
    'Paka kwenye kivinjari chako. Hutikia vichupo na hukua pamoja nawe. Haonekani kwenye baadhi ya tovuti ili kuepuka usumbufu.',
    'Tabby, paka wa kivinjari chako',
  ],
  sv: [
    'En katt bor i din webbläsare. Hon reagerar på flikar och växer med dig. Hon undviker vissa sidor för att inte störa.',
    'Tabby, din webbläsarkatt',
  ],
  da: [
    'En kat bor i din browser. Den reagerer på faner og vokser med dig. Den vises ikke på nogle sider for at undgå forstyrrelse.',
    'Tabby, din browserkat',
  ],
  no: [
    'En katt i nettleseren din. Den reagerer på faner og vokser med deg. Vises ikke på noen sider for å unngå distraksjon.',
    'Tabby, nettleserkatten din',
  ],
  fi: [
    'Kissa selaimessasi. Se reagoi välilehtiin ja kasvaa kanssasi. Ei näy joillakin sivuilla häiriön välttämiseksi.',
    'Tabby, selainkissasi',
  ],
  cs: [
    'V prohlížeči bydlí kočka. Reaguje na karty a roste s vámi. Na některých webech se nezobrazuje, aby nerušila.',
    'Tabby, tvoje kočka v prohlížeči',
  ],
  sk: [
    'V prehliadači býva mačka. Reaguje na karty a rastie s vami. Na niektorých stránkach sa nezobrazuje, aby nerušila.',
    'Tabby, tvoja mačka v prehliadači',
  ],
  hu: [
    'Macska él a böngésződben. Reagál a lapokra és veled növekszik. Néhány oldalon nem jelenik meg, hogy ne zavarjon.',
    'Tabby, a böngészőmacskád',
  ],
  ro: [
    'O pisică în browserul tău. Reacționează la file și crește cu tine. Nu apare pe unele site-uri ca să nu te distragă.',
    'Tabby, pisica ta din browser',
  ],
  bg: [
    'Котка живее в браузъра ви. Реагира на разделите и расте с вас. Не се появява на някои сайтове, за да не ви разсейва.',
    'Tabby, вашата котка в браузъра',
  ],
  el: [
    'Γάτα στον browser. Αντιδρά στις καρτέλες και μεγαλώνει. Δεν εμφανίζεται σε ορισμένους ιστότοπους για να μην αποσπά.',
    'Tabby, η γάτα του browser σου',
  ],
  hr: [
    'Mačka u pregledniku. Reagira na kartice i raste s tobom. Ne pojavljuje se na nekim stranicama da te ne ometa.',
    'Tabby, tvoja mačka u pregledniku',
  ],
  sr: [
    'Мачка живи у прегледачу. Реагује на картице и расте с вама. Не појављује се на неким сајтовима да не омета.',
    'Tabby, ваша мачка у прегледачу',
  ],
  ca: [
    "Un gat viu al navegador. Reacciona a les pestanyes i creix amb tu. No apareix en alguns llocs per no distreure't.",
    'Tabby, el teu gat del navegador',
  ],
};

let count = 0;
let longest = 0;
for (const [locale, [description, actionTitle]] of Object.entries(MESSAGES)) {
  if (description.length > longest) {
    longest = description.length;
  }
  if (description.length > 132) {
    throw new Error(
      `[generate-locales] ${locale} description is ${description.length} chars (>132).`,
    );
  }

  const dir = join(OUT, locale);
  mkdirSync(dir, { recursive: true });
  const body = {
    extDescription: {
      message: description,
      description:
        'Extension description shown in the Chrome Web Store and chrome://extensions.',
    },
    actionTitle: {
      message: actionTitle,
      description: 'Tooltip shown when hovering the toolbar icon.',
    },
  };
  writeFileSync(join(dir, 'messages.json'), `${JSON.stringify(body, null, 2)}\n`);
  count += 1;
}

console.log(
  `[generate-locales] wrote ${count} locales (longest description: ${longest} chars)`,
);
