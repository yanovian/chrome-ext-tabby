#!/usr/bin/env node
/**
 * Generate public/_locales/<locale>/messages.json for manifest-facing strings
 * (extension description + toolbar tooltip). The extension NAME "Tabby" is a
 * brand and stays in Latin script for most locales. RTL locales (ar, fa, he)
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
    'A cat lives in your browser. Tabby uses tab title and web address only, keeping your online life private on your device.',
    'Tabby, your browser cat',
  ],
  es: [
    'Un gato vive en tu navegador. Tabby usa solo el título y la dirección web de la pestaña. Tu vida online, privada en el dispositivo.',
    'Tabby, tu gato del navegador',
  ],
  fr: [
    "Un chat vit dans votre navigateur. Tabby n'utilise que le titre et l'adresse web de l'onglet. Vie en ligne privée sur l'appareil.",
    'Tabby, votre chat de navigateur',
  ],
  de: [
    'Eine Katze lebt in deinem Browser. Tabby nutzt nur Tabtitel und Webadresse. Dein Online-Leben bleibt privat auf dem Gerät.',
    'Tabby, deine Browser-Katze',
  ],
  it: [
    'Un gatto vive nel tuo browser. Tabby usa solo titolo e indirizzo web della scheda. Vita online privata sul dispositivo.',
    'Tabby, il tuo gatto del browser',
  ],
  pt_BR: [
    'Um gato mora no seu navegador. A Tabby usa só título e endereço web da aba. Sua vida online fica privada no dispositivo.',
    'Tabby, sua gata do navegador',
  ],
  nl: [
    'Een kat woont in je browser. Tabby gebruikt alleen tabtitel en webadres. Je online leven blijft privé op je apparaat.',
    'Tabby, je browserkat',
  ],
  pl: [
    'Kot mieszka w przeglądarce. Tabby używa tylko tytułu i adresu strony karty. Życie online prywatne na urządzeniu.',
    'Tabby, twój kot w przeglądarce',
  ],
  ru: [
    'Кошка живёт в браузере. Tabby использует только заголовок и адрес вкладки. Онлайн-жизнь остаётся приватной на устройстве.',
    'Tabby, ваша кошка в браузере',
  ],
  uk: [
    'Кішка живе у браузері. Tabby використовує лише заголовок і адресу вкладки. Онлайн-життя приватне на пристрої.',
    'Tabby, ваша кішка в браузері',
  ],
  tr: [
    'Tarayıcında bir kedi yaşıyor. Tabby yalnızca sekme başlığı ve web adresini kullanır. Çevrimiçi hayatın cihazında gizli kalır.',
    'Tabby, tarayıcı kedinin',
  ],
  ar: [
    'قطة تعيش في متصفحك. تستخدم عنوان التبويب وعنوان الصفحة فقط. حياتك على الإنترنت تبقى خاصة على جهازك.',
    'قطة متصفحك',
  ],
  fa: [
    'یک گربه در مرورگر شما زندگی می‌کند. فقط از عنوان و آدرس صفحه استفاده می‌کند. زندگی آنلاین شما روی دستگاه خصوصی می‌ماند.',
    'گربه مرورگر شما',
  ],
  he: [
    'חתולה גרה בדפדפן שלך. היא משתמשת רק בכותרת וכתובת הדף של הלשונית. החיים המקוונים שלך נשארים פרטיים במכשיר.',
    'חתולת הדפדפן שלך',
  ],
  hi: [
    'आपके ब्राउज़र में बिल्ली रहती है। Tabby केवल टैब शीर्षक और पृष्ठ पता इस्तेमाल करती है। ऑनलाइन जीवन डिवाइस पर निजी रहता है।',
    'Tabby, आपकी ब्राउज़र बिल्ली',
  ],
  bn: [
    'আপনার ব্রাউজারে বিড়াল থাকে। Tabby শুধু ট্যাবের শিরোনাম ও পেজের ঠিকানা ব্যবহার করে। অনলাইন জীবন ডিভাইসে ব্যক্তিগত থাকে।',
    'Tabby, আপনার ব্রাউজারের বিড়াল',
  ],
  ta: [
    'உலாவியில் பூனை வசிக்கிறது. Tabby தாவல் தலைப்பு, பக்க முகவரி மட்டுமே. ஆன்லைன் வாழ்க்கை சாதனத்தில் தனிப்பட்டது.',
    'Tabby, உங்கள் உலாவி பூனை',
  ],
  ja: [
    'ブラウザに猫が住んでいます。Tabbyはタブのタイトルとページのアドレスだけを使います。オンライン生活は端末内で非公開です。',
    'Tabby、あなたのブラウザ猫',
  ],
  ko: [
    '브라우저에 고양이가 살아요. Tabby는 탭 제목과 페이지 주소만 사용해요. 온라인 생활은 기기 안에서만 비공개로 지켜져요.',
    'Tabby, 브라우저 고양이',
  ],
  zh_CN: [
    '一只猫住在你的浏览器里。Tabby 只使用标签页标题和网址。你的上网生活在设备上保持私密。',
    'Tabby，你的浏览器猫咪',
  ],
  vi: [
    'Mèo sống trong trình duyệt của bạn. Tabby chỉ dùng tiêu đề và địa chỉ trang của thẻ. Đời sống trực tuyến riêng tư trên thiết bị.',
    'Tabby, mèo trình duyệt của bạn',
  ],
  th: [
    'แมวอาศัยในเบราว์เซอร์ Tabby ใช้เฉพาะชื่อแท็บและที่อยู่หน้าเว็บ ชีวิตออนไลน์เป็นส่วนตัวบนอุปกรณ์',
    'Tabby แมวเบราว์เซอร์ของคุณ',
  ],
  id: [
    'Kucing tinggal di browser. Tabby hanya memakai judul tab dan alamat halaman. Kehidupan online tetap privat di perangkat.',
    'Tabby, kucing browser-mu',
  ],
  ms: [
    'Kucing tinggal dalam pelayar. Tabby hanya guna tajuk tab dan alamat halaman. Kehidupan dalam talian kekal privasi pada peranti.',
    'Tabby, kucing pelayar anda',
  ],
  fil: [
    'May pusa sa browser mo. Si Tabby ay gumagamit lang ng pamagat ng tab at address ng pahina. Pribado ang online life sa aparato.',
    'Tabby, pusa sa browser mo',
  ],
  sw: [
    'Paka anaishi kwenye kivinjari. Tabby hutumia kichwa na anwani ya ukurasa wa kichupo. Maisha mtandaoni hubaki faragha kwenye kifaa.',
    'Tabby, paka wa kivinjari chako',
  ],
  sv: [
    'En katt bor i webbläsaren. Tabby använder bara flikens titel och webbadress. Ditt onlineliv förblir privat på enheten.',
    'Tabby, din webbläsarkatt',
  ],
  da: [
    'En kat bor i browseren. Tabby bruger kun fanetitel og webadresse. Dit onlineliv forbliver privat på enheden.',
    'Tabby, din browserkat',
  ],
  no: [
    'En katt bor i nettleseren. Tabby bruker bare fanetittel og nettadresse. Nettlivet ditt forblir privat på enheten.',
    'Tabby, nettleserkatten din',
  ],
  fi: [
    'Kissa asuu selaimessa. Tabby käyttää vain välilehden otsikkoa ja sivun osoitetta. Verkkoelämä pysyy yksityisenä laitteella.',
    'Tabby, selainkissasi',
  ],
  cs: [
    'V prohlížeči bydlí kočka. Tabby používá jen název a adresu stránky karty. Online život zůstává soukromý v zařízení.',
    'Tabby, tvoje kočka v prohlížeči',
  ],
  sk: [
    'V prehliadači býva mačka. Tabby používa len názov a adresu stránky karty. Online život zostáva súkromný v zariadení.',
    'Tabby, tvoja mačka v prehliadači',
  ],
  hu: [
    'Macska él a böngészőben. Tabby csak a lap címét és webcímét használja. Az online életed privát marad az eszközön.',
    'Tabby, a böngészőmacskád',
  ],
  ro: [
    'O pisică trăiește în browser. Tabby folosește doar titlul și adresa web a filei. Viața online rămâne privată pe dispozitiv.',
    'Tabby, pisica ta din browser',
  ],
  bg: [
    'Котка живее в браузъра. Tabby използва само заглавие и адрес на раздела. Онлайн животът остава поверителен на устройството.',
    'Tabby, вашата котка в браузъра',
  ],
  el: [
    'Μια γάτα ζει στον browser. Η Tabby χρησιμοποιεί μόνο τίτλο και διεύθυνση καρτέλας. Η διαδικτυακή ζωή μένει ιδιωτική στη συσκευή.',
    'Tabby, η γάτα του browser σου',
  ],
  hr: [
    'Mačka živi u pregledniku. Tabby koristi samo naslov i adresu stranice kartice. Online život ostaje privatan na uređaju.',
    'Tabby, tvoja mačka u pregledniku',
  ],
  sr: [
    'Мачка живи у прегледачу. Tabby користи само наслов и адресу картице. Онлајн живот остаје приватан на уређају.',
    'Tabby, ваша мачка у прегледачу',
  ],
  ca: [
    "Un gat viu al navegador. Tabby només fa servir el títol i l'adreça web de la pestanya. Vida en línia privada al dispositiu.",
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
