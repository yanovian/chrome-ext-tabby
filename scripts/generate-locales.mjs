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
    'A cat lives in your browser. She reacts to your tabs and grows with you. She stays off sensitive sites (banks, email, GitHub, etc.).',
    'Tabby, your browser cat',
  ],
  es: [
    'Un gato en tu navegador. Reacciona a tus pestañas y crece contigo. Evita sitios sensibles (bancos, correo, GitHub, etc.).',
    'Tabby, tu gato del navegador',
  ],
  fr: [
    'Un chat dans le navigateur. Réagit à vos onglets et grandit avec vous. Il évite les sites sensibles (banques, e-mail, GitHub, etc.).',
    'Tabby, votre chat de navigateur',
  ],
  de: [
    'Katze lebt in deinem Browser. Reagiert auf Tabs und wächst mit dir. Sie meidet sensible Seiten (Banken, E-Mail, GitHub usw.).',
    'Tabby, deine Browser-Katze',
  ],
  it: [
    'Un gatto vive nel browser. Reagisce alle schede e cresce con te. Evita siti sensibili (banche, email, GitHub, ecc.).',
    'Tabby, il tuo gatto del browser',
  ],
  pt_BR: [
    'Um gato mora no seu navegador. Reage às abas e cresce com você. Fica fora de sites sensíveis (bancos, e-mail, GitHub, etc.).',
    'Tabby, sua gata do navegador',
  ],
  nl: [
    'Een kat in je browser. Ze reageert op tabs en groeit mee. Ze mijdt gevoelige sites (banken, e-mail, GitHub, enz.).',
    'Tabby, je browserkat',
  ],
  pl: [
    'Kot mieszka w przeglądarce. Reaguje na karty i rośnie z tobą. Omija wrażliwe strony (banki, poczta, GitHub itd.).',
    'Tabby, twój kot w przeglądarce',
  ],
  ru: [
    'Кошка живёт в браузере. Реагирует на вкладки и растёт с вами. Не появляется на чувствительных сайтах (банки, почта, GitHub и др.).',
    'Tabby, ваша кошка в браузере',
  ],
  uk: [
    'Кішка живе у браузері. Реагує на вкладки й росте з вами. Не з’являється на чутливих сайтах (банки, пошта, GitHub тощо).',
    'Tabby, ваша кішка в браузері',
  ],
  tr: [
    'Tarayıcında bir kedi yaşıyor. Sekmelere tepki verir ve seninle büyür. Hassas sitelerde görünmez (banka, e-posta, GitHub vb.).',
    'Tabby, tarayıcı kedinin',
  ],
  ar: [
    'قطة تعيش في متصفحك. تتفاعل مع تبويباتك وتكبر معك. لا تظهر على المواقع الحساسة (بنوك، بريد، GitHub، إلخ).',
    'قطة متصفحك',
  ],
  fa: [
    'گربه‌ای در مرورگر شما زندگی می‌کند. به تب‌ها واکنش می‌دهد و با شما بزرگ می‌شود. در سایت‌های حساس نیست (بانک، ایمیل، GitHub و غیره).',
    'گربه مرورگر شما',
  ],
  he: [
    'חתולה גרה בדפדפן שלך. היא מגיבה ללשוניות וגדלה איתך. לא מופיעה באתרים רגישים (בנקים, דואר, GitHub וכו׳).',
    'חתולת הדפדפן שלך',
  ],
  hi: [
    'ब्राउज़र में बिल्ली रहती है। टैब पर प्रतिक्रिया देती है और बढ़ती है। संवेदनशील साइटों पर नहीं (बैंक, ईमेल, GitHub आदि)।',
    'Tabby, आपकी ब्राउज़र बिल्ली',
  ],
  bn: [
    'ব্রাউজারে বিড়াল থাকে। ট্যাবে প্রতিক্রিয়া জানায় এবং বড় হয়। সংবেদনশীল সাইটে নয় (ব্যাংক, ইমেল, GitHub ইত্যাদি)।',
    'Tabby, আপনার ব্রাউজারের বিড়াল',
  ],
  ta: [
    'உலாவியில் பூனை வசிக்கிறது. தாவல்களுக்கு எதிர்வினையாற்றி வளர்கிறது. உணர்திறன் தளங்களில் தோன்றாது (வங்கி, மின்னஞ்சல், GitHub முதலியன).',
    'Tabby, உங்கள் உலாவி பூனை',
  ],
  ja: [
    'ブラウザに猫が住んでいます。タブに反応し、一緒に成長します。機密サイトには出ません（銀行、メール、GitHubなど）。',
    'Tabby、あなたのブラウザ猫',
  ],
  ko: [
    '브라우저에 고양이가 살아요. 탭에 반응하며 함께 자라요. 민감한 사이트에는 나타나지 않아요(은행, 이메일, GitHub 등).',
    'Tabby, 브라우저 고양이',
  ],
  zh_CN: [
    '一只猫住在你的浏览器里。她会根据标签页反应并陪你成长。敏感网站不会出现她（银行、邮箱、GitHub 等）。',
    'Tabby，你的浏览器猫咪',
  ],
  vi: [
    'Mèo trong trình duyệt của bạn. Phản ứng với thẻ và lớn lên cùng bạn. Không hiện ở trang nhạy cảm (ngân hàng, email, GitHub, v.v.).',
    'Tabby, mèo trình duyệt của bạn',
  ],
  th: [
    'แมวอาศัยในเบราว์เซอร์ของคุณ ตอบสนองแท็บและโตไปกับคุณ ไม่โผล่บนไซต์อ่อนไหว (ธนาคาร อีเมล GitHub ฯลฯ)',
    'Tabby แมวเบราว์เซอร์ของคุณ',
  ],
  id: [
    'Kucing tinggal di browser kamu. Bereaksi pada tab dan tumbuh bersamamu. Tidak muncul di situs sensitif (bank, email, GitHub, dll.).',
    'Tabby, kucing browser-mu',
  ],
  ms: [
    'Kucing dalam pelayar anda. Bertindak balas pada tab dan membesar. Tidak muncul di laman sensitif (bank, e-mel, GitHub, dll.).',
    'Tabby, kucing pelayar anda',
  ],
  fil: [
    'May pusa sa browser mo. Tumutugon sa tab at lumalaki kasama mo. Hindi lumalabas sa sensitibong site (bangko, email, GitHub, atbp.).',
    'Tabby, pusa sa browser mo',
  ],
  sw: [
    'Paka kwenye kivinjari chako. Hutikia vichupo na hukua pamoja nawe. Haonekani kwenye tovuti nyeti (benki, barua pepe, GitHub, n.k.).',
    'Tabby, paka wa kivinjari chako',
  ],
  sv: [
    'En katt bor i din webbläsare. Hon reagerar på flikar och växer med dig. Hon undviker känsliga sidor (banker, e-post, GitHub m.m.).',
    'Tabby, din webbläsarkatt',
  ],
  da: [
    'En kat bor i din browser. Den reagerer på faner og vokser med dig. Den vises ikke på følsomme sider (banker, e-mail, GitHub osv.).',
    'Tabby, din browserkat',
  ],
  no: [
    'En katt i nettleseren din. Den reagerer på faner og vokser med deg. Vises ikke på sensitive sider (banker, e-post, GitHub osv.).',
    'Tabby, nettleserkatten din',
  ],
  fi: [
    'Kissa selaimessasi. Se reagoi välilehtiin ja kasvaa kanssasi. Ei näy arkaluontoisilla sivuilla (pankit, sähköposti, GitHub jne.).',
    'Tabby, selainkissasi',
  ],
  cs: [
    'V prohlížeči bydlí kočka. Reaguje na karty a roste s vámi. Na citlivých webech se nezobrazuje (banky, e-mail, GitHub atd.).',
    'Tabby, tvoje kočka v prohlížeči',
  ],
  sk: [
    'V prehliadači býva mačka. Reaguje na karty a rastie s vami. Na citlivých stránkach sa nezobrazuje (banky, e-mail, GitHub atď.).',
    'Tabby, tvoja mačka v prehliadači',
  ],
  hu: [
    'Macska él a böngésződben. Reagál a lapokra és veled növekszik. Érzékeny oldalakon nem jelenik meg (bankok, e-mail, GitHub stb.).',
    'Tabby, a böngészőmacskád',
  ],
  ro: [
    'O pisică în browserul tău. Reacționează la file și crește cu tine. Nu apare pe site-uri sensibile (bănci, e-mail, GitHub etc.).',
    'Tabby, pisica ta din browser',
  ],
  bg: [
    'Котка живее в браузъра ви. Реагира на разделите и расте с вас. Не се появява на чувствителни сайтове (банки, поща, GitHub и др.).',
    'Tabby, вашата котка в браузъра',
  ],
  el: [
    'Γάτα στον browser. Αντιδρά στις καρτέλες και μεγαλώνει. Δεν εμφανίζεται σε ευαίσθητους ιστότοπους (τράπεζες, email, GitHub κ.ά.).',
    'Tabby, η γάτα του browser σου',
  ],
  hr: [
    'Mačka u pregledniku. Reagira na kartice i raste s tobom. Ne pojavljuje se na osjetljivim stranicama (banke, e-pošta, GitHub itd.).',
    'Tabby, tvoja mačka u pregledniku',
  ],
  sr: [
    'Мачка живи у прегледачу. Реагује на картице и расте с вама. Не појављује се на осетљивим сајтовима (банке, е-пошта, GitHub итд.).',
    'Tabby, ваша мачка у прегледачу',
  ],
  ca: [
    "Un gat viu al navegador. Reacciona a les pestanyes i creix amb tu. No apareix en llocs sensibles (bancs, correu, GitHub, etc.).",
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
