#!/usr/bin/env node
/**
 * Generate public/_locales/<locale>/messages.json for manifest-facing strings
 * (extension description + toolbar tooltip). The extension NAME "Tabby" is a
 * brand and stays in Latin script for most locales. RTL locales (ar, fa, he)
 * use native words for "cat" instead of "Tabby".
 *
 * These files are the source of truth for translators and are committed to the
 * repo. Regenerate or add a language with `pnpm locales`.
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
    'A cat lives in your browser. Tabby reacts to what you read and keeps your online life private on your device.',
    'Tabby, your browser cat',
  ],
  es: [
    'Un gato vive en tu navegador. Tabby reacciona a lo que lees y mantiene tu vida online privada en tu dispositivo.',
    'Tabby, tu gato del navegador',
  ],
  fr: [
    "Un chat vit dans votre navigateur. Tabby réagit à ce que vous lisez et garde votre vie en ligne privée sur votre appareil.",
    'Tabby, votre chat de navigateur',
  ],
  de: [
    'Eine Katze lebt in deinem Browser. Tabby reagiert auf das, was du liest, und hält dein Online-Leben privat auf deinem Gerät.',
    'Tabby, deine Browser-Katze',
  ],
  it: [
    'Un gatto vive nel tuo browser. Tabby reagisce a ciò che leggi e mantiene la tua vita online privata sul dispositivo.',
    'Tabby, il tuo gatto del browser',
  ],
  pt_BR: [
    'Um gato mora no seu navegador. A Tabby reage ao que você lê e mantém sua vida online privada no seu dispositivo.',
    'Tabby, sua gata do navegador',
  ],
  nl: [
    'Een kat woont in je browser. Tabby reageert op wat je leest en houdt je online leven privé op je apparaat.',
    'Tabby, je browserkat',
  ],
  pl: [
    'Kot mieszka w twojej przeglądarce. Tabby reaguje na to, co czytasz, i trzyma twoje życie online prywatnie na urządzeniu.',
    'Tabby, twój kot w przeglądarce',
  ],
  ru: [
    'Кошка живёт в вашем браузере. Tabby реагирует на то, что вы читаете, и хранит вашу онлайн-жизнь приватно на устройстве.',
    'Tabby, ваша кошка в браузере',
  ],
  uk: [
    'Кішка живе у вашому браузері. Tabby реагує на те, що ви читаєте, і зберігає ваше онлайн-життя приватно на пристрої.',
    'Tabby, ваша кішка в браузері',
  ],
  tr: [
    'Tarayıcında bir kedi yaşıyor. Tabby okuduklarına tepki verir ve çevrimiçi hayatını cihazında gizli tutar.',
    'Tabby, tarayıcı kedinin',
  ],
  ar: [
    'قطة تعيش في متصفحك. تتفاعل مع ما تقرأه وتحافظ على حياتك على الإنترنت بشكل خاص على جهازك.',
    'قطة متصفحك',
  ],
  fa: [
    'یک گربه در مرورگر شما زندگی می‌کند. به آنچه می‌خوانید واکنش نشان می‌دهد و زندگی آنلاین شما را روی دستگاه خصوصی نگه می‌دارد.',
    'گربه مرورگر شما',
  ],
  he: [
    'חתולה גרה בדפדפן שלך. היא מגיבה למה שאתה קורא ושומרת על החיים המקוונים שלך בפרטיות על המכשיר.',
    'חתולת הדפדפן שלך',
  ],
  hi: [
    'आपके ब्राउज़र में एक बिल्ली रहती है। Tabby आपके पढ़ने पर प्रतिक्रिया देती है और आपकी ऑनलाइन ज़िंदगी को डिवाइस पर निजी रखती है।',
    'Tabby, आपकी ब्राउज़र बिल्ली',
  ],
  bn: [
    'আপনার ব্রাউজারে একটি বিড়াল থাকে। Tabby আপনি যা পড়েন তার প্রতি সাড়া দেয় এবং আপনার অনলাইন জীবন ডিভাইসে ব্যক্তিগত রাখে।',
    'Tabby, আপনার ব্রাউজারের বিড়াল',
  ],
  ta: [
    'உலாவியில் ஒரு பூனை வசிக்கிறது. Tabby நீங்கள் படிப்பதற்கு எதிர்வினையாற்றி, ஆன்லைன் வாழ்க்கையை சாதனத்தில் தனிப்பட்டதாக வைக்கிறது.',
    'Tabby, உங்கள் உலாவி பூனை',
  ],
  ja: [
    'ブラウザに猫が住んでいます。Tabbyは読んだ内容に反応し、オンライン生活を端末内でプライベートに保ちます。',
    'Tabby、あなたのブラウザ猫',
  ],
  ko: [
    '브라우저에 고양이가 살고 있어요. Tabby는 읽는 내용에 반응하고, 온라인 생활을 기기 안에서만 비공개로 지켜요.',
    'Tabby, 브라우저 고양이',
  ],
  zh_CN: [
    '一只猫住在你的浏览器里。Tabby 会对你看的内容做出反应，并在你的设备上私密地陪伴你的上网生活。',
    'Tabby，你的浏览器猫咪',
  ],
  vi: [
    'Một chú mèo sống trong trình duyệt của bạn. Tabby phản ứng với những gì bạn đọc và giữ đời sống trực tuyến riêng tư trên thiết bị.',
    'Tabby, mèo trình duyệt của bạn',
  ],
  th: [
    'มีแมวอาศัยอยู่ในเบราว์เซอร์ของคุณ Tabby ตอบสนองต่อสิ่งที่คุณอ่านและเก็บชีวิตออนไลน์ของคุณไว้เป็นส่วนตัวบนอุปกรณ์',
    'Tabby แมวเบราว์เซอร์ของคุณ',
  ],
  id: [
    'Seekor kucing tinggal di browser kamu. Tabby bereaksi pada yang kamu baca dan menjaga kehidupan online pribadi di perangkat.',
    'Tabby, kucing browser-mu',
  ],
  ms: [
    'Seekor kucing tinggal dalam pelayar anda. Tabby bertindak balas kepada apa yang anda baca dan kekal privasi di peranti.',
    'Tabby, kucing pelayar anda',
  ],
  fil: [
    'May pusa sa iyong browser. Tumutugon si Tabby sa binabasa mo at pinapanatiling pribado ang online life mo sa device.',
    'Tabby, pusa sa browser mo',
  ],
  sw: [
    'Paka anaishi kwenye kivinjari chako. Tabby huitikia unachosoma na kuweka maisha yako mtandaoni kuwa ya faragha kwenye kifaa.',
    'Tabby, paka wa kivinjari chako',
  ],
  sv: [
    'En katt bor i din webbläsare. Tabby reagerar på det du läser och håller ditt onlineliv privat på enheten.',
    'Tabby, din webbläsarkatt',
  ],
  da: [
    'En kat bor i din browser. Tabby reagerer på det, du læser, og holder dit onlineliv privat på enheden.',
    'Tabby, din browserkat',
  ],
  no: [
    'En katt bor i nettleseren din. Tabby reagerer på det du leser og holder nettlivet ditt privat på enheten.',
    'Tabby, nettleserkatten din',
  ],
  fi: [
    'Kissa asuu selaimessasi. Tabby reagoi lukemaasi ja pitää verkkoelämäsi yksityisenä laitteellasi.',
    'Tabby, selainkissasi',
  ],
  cs: [
    'V prohlížeči bydlí kočka. Tabby reaguje na to, co čteš, a drží tvůj online život v soukromí na zařízení.',
    'Tabby, tvoje kočka v prohlížeči',
  ],
  sk: [
    'V prehliadači býva mačka. Tabby reaguje na to, čo čítaš, a drží tvoj online život v súkromí na zariadení.',
    'Tabby, tvoja mačka v prehliadači',
  ],
  hu: [
    'Egy macska él a böngésződben. Tabby reagál arra, amit olvasol, és az online életedet privátan tartja az eszközön.',
    'Tabby, a böngészőmacskád',
  ],
  ro: [
    'O pisică trăiește în browserul tău. Tabby reacționează la ce citești și îți ține viața online privată pe dispozitiv.',
    'Tabby, pisica ta din browser',
  ],
  bg: [
    'Котка живее в браузъра ви. Tabby реагира на това, което четете, и пази онлайн живота ви частен на устройството.',
    'Tabby, вашата котка в браузъра',
  ],
  el: [
    'Μια γάτα ζει στον browser σου. Η Tabby αντιδρά σε ό,τι διαβάζεις και κρατά τη διαδικτυακή σου ζωή ιδιωτική στη συσκευή.',
    'Tabby, η γάτα του browser σου',
  ],
  hr: [
    'Mačka živi u tvom pregledniku. Tabby reagira na ono što čitaš i drži tvoj online život privatan na uređaju.',
    'Tabby, tvoja mačka u pregledniku',
  ],
  sr: [
    'Мачка живи у вашем прегледачу. Tabby реагује на оно што читате и чува ваш онлајн живот приватним на уређају.',
    'Tabby, ваша мачка у прегледачу',
  ],
  ca: [
    'Un gat viu al teu navegador. Tabby reacciona al que llegeixes i manté la teva vida en línia privada al dispositiu.',
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
