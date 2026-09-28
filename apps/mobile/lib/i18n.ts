// App language: English, chiShona, isiNdebele.
//
// Deliberately small: a flat key → string dictionary per language, a
// module-level current language (persisted on the device and mirrored to
// profiles.language), and a useT() hook that re-renders on change. Any key
// missing from a language falls back to English, so a partly translated
// screen never shows a raw key.
//
// Coverage (stage 1): bottom navigation, sign in / sign up, posting an ad,
// the listing page's main actions and the safety messages — the screens
// every user touches. Shona/Ndebele copy should be reviewed by native
// speakers before being promoted in marketing.
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { loadCache, saveCache } from "./offlineCache";
import { supabase } from "./supabase";

export type Lang = "en" | "sn" | "nd";

export const LANGUAGES: { code: Lang; name: string; english: string }[] = [
  { code: "en", name: "English", english: "English" },
  { code: "sn", name: "chiShona", english: "Shona" },
  { code: "nd", name: "isiNdebele", english: "Ndebele" },
];

const en = {
  "nav.home": "Home",
  "nav.search": "Search",
  "nav.post": "Post",
  "nav.messages": "Messages",
  "nav.account": "Account",

  "auth.signIn": "Sign In",
  "auth.signUp": "Sign Up",
  "auth.welcomeBack": "Welcome back",
  "auth.signInSubtitle": "Sign in to buy, sell, and manage your account",
  "auth.createAccount": "Create your account",
  "auth.createAccountSubtitle": "Join PaMarket to start buying and selling safely",
  "auth.email": "Email Address",
  "auth.password": "Password",
  "auth.forgotPassword": "Forgot password?",
  "auth.noAccount": "Don't have an account? ",
  "auth.haveAccount": "Already have an account? ",
  "auth.orContinueWith": "or continue with",
  "auth.continuePhone": "Continue with phone / WhatsApp",

  "post.title": "Post a Free Ad",
  "post.submit": "Post Ad",
  "post.next": "Next",
  "post.back": "Back",
  "post.adTitle": "Title",
  "post.description": "Description",
  "post.price": "Price",
  "post.category": "Category",
  "post.location": "Location",
  "post.photos": "Photos",
  "post.submitted": "Ad posted successfully.",
  "post.heldForReview": "Ad submitted. It will go live once our team has reviewed it.",

  "listing.chatWithSeller": "Chat with seller",
  "listing.editListing": "Edit listing",
  "listing.tradeSafely": "Trade safely",
  "listing.tradeSafelyBody": "Meet in a public place, inspect before paying, and remember: PaMarket never handles payments.",
  "listing.similar": "Similar listings",
  "listing.promoteStatus": "Promote free on WhatsApp Status",
  "listing.promoteStatusSub": "Share a ready-made picture of this ad with everyone in your contacts.",
  "listing.atTodaysRate": "at today's rate",

  "safety.meetPublic": "Meet in a busy public place during the day.",
  "safety.inspectFirst": "See and test the item before you pay.",
  "safety.noDeposits": "Never send EcoCash or bank deposits to someone you haven't met.",
  "safety.reportSuspicious": "Report anything suspicious. We check every report.",

  "settings.language": "Language",
  "settings.languageNote": "Choose the language for app menus and main screens. Some screens are still in English while we finish translating.",
};

type Key = keyof typeof en;
type Dict = Partial<Record<Key, string>>;

const sn: Dict = {
  "nav.home": "Kumba",
  "nav.search": "Tsvaga",
  "nav.post": "Isa",
  "nav.messages": "Mameseji",
  "nav.account": "Akaundi",

  "auth.signIn": "Pinda",
  "auth.signUp": "Nyoresa",
  "auth.welcomeBack": "Mauya zvakare",
  "auth.signInSubtitle": "Pinda kuti utenge, utengese, uye ugadzirise akaundi yako",
  "auth.createAccount": "Vhura akaundi yako",
  "auth.createAccountSubtitle": "Joinha PaMarket kuti utange kutenga nekutengesa zvakachengeteka",
  "auth.email": "Email",
  "auth.password": "Pasiwedhi",
  "auth.forgotPassword": "Wakanganwa pasiwedhi?",
  "auth.noAccount": "Hauna akaundi here? ",
  "auth.haveAccount": "Watova neakaundi? ",
  "auth.orContinueWith": "kana enderera ne",
  "auth.continuePhone": "Enderera nefoni / WhatsApp",

  "post.title": "Isa Shambadziro Mahara",
  "post.submit": "Isa Shambadziro",
  "post.next": "Enderera",
  "post.back": "Dzokera",
  "post.adTitle": "Musoro",
  "post.description": "Tsananguro",
  "post.price": "Mutengo",
  "post.category": "Rudzi",
  "post.location": "Nzvimbo",
  "post.photos": "Mifananidzo",
  "post.submitted": "Shambadziro yako yaiswa.",
  "post.heldForReview": "Shambadziro yatumirwa. Ichabuda kana chikwata chedu chaiongorora.",

  "listing.chatWithSeller": "Taura nemutengesi",
  "listing.editListing": "Gadzirisa shambadziro",
  "listing.tradeSafely": "Tengeserana zvakachengeteka",
  "listing.tradeSafelyBody": "Sanganai panzvimbo ine vanhu, ongorora usati wabhadhara, uye rangarira: PaMarket haibate mari yako.",
  "listing.similar": "Zvimwe zvakafanana",
  "listing.promoteStatus": "Shambadza pachena paWhatsApp Status",
  "listing.promoteStatusSub": "Govera mufananidzo weshambadziro iyi kuvanhu vese vari mufoni yako.",
  "listing.atTodaysRate": "pamutengo wanhasi",

  "safety.meetPublic": "Sanganai panzvimbo ine vanhu vakawanda masikati.",
  "safety.inspectFirst": "Ona uye edza chinhu usati wabhadhara.",
  "safety.noDeposits": "Usambotumira mari yeEcoCash kana yebhanga kumunhu wausati wasangana naye.",
  "safety.reportSuspicious": "Tizivisei chero chinhu chinokunetsai. Tinoongorora mashoko ese.",

  "settings.language": "Mutauro",
  "settings.languageNote": "Sarudza mutauro wemamenyu nemapeji makuru. Mamwe mapeji achiri muChirungu tichiri kushandura.",
};

const nd: Dict = {
  "nav.home": "Ekhaya",
  "nav.search": "Dinga",
  "nav.post": "Faka",
  "nav.messages": "Imilayezo",
  "nav.account": "I-akhawunti",

  "auth.signIn": "Ngena",
  "auth.signUp": "Bhalisa",
  "auth.welcomeBack": "Wamukelekile futhi",
  "auth.signInSubtitle": "Ngena ukuze uthenge, uthengise, njalo uphathe i-akhawunti yakho",
  "auth.createAccount": "Vula i-akhawunti yakho",
  "auth.createAccountSubtitle": "Joyina iPaMarket ukuze uqalise ukuthenga lokuthengisa ngokuphephile",
  "auth.email": "I-imeyili",
  "auth.password": "Iphasiwedi",
  "auth.forgotPassword": "Ukhohlwe iphasiwedi?",
  "auth.noAccount": "Awulayo i-akhawunti? ",
  "auth.haveAccount": "Usulayo i-akhawunti? ",
  "auth.orContinueWith": "kumbe uqhubeke nge",
  "auth.continuePhone": "Qhubeka ngefoni / WhatsApp",

  "post.title": "Faka Isikhangiso Mahala",
  "post.submit": "Faka Isikhangiso",
  "post.next": "Okulandelayo",
  "post.back": "Emuva",
  "post.adTitle": "Isihloko",
  "post.description": "Incazelo",
  "post.price": "Intengo",
  "post.category": "Uhlobo",
  "post.location": "Indawo",
  "post.photos": "Izithombe",
  "post.submitted": "Isikhangiso sakho sifakiwe.",
  "post.heldForReview": "Isikhangiso sithunyelwe. Sizavela nxa iqembu lethu selisihlolile.",

  "listing.chatWithSeller": "Khuluma lomthengisi",
  "listing.editListing": "Lungisa isikhangiso",
  "listing.tradeSafely": "Thengiselana ngokuphephile",
  "listing.tradeSafelyBody": "Hlanganani endaweni elabantu, hlola ungakabhadali, njalo khumbula: iPaMarket kayiphathi imali yakho.",
  "listing.similar": "Okunye okufanayo",
  "listing.promoteStatus": "Khangisa mahala ku-WhatsApp Status",
  "listing.promoteStatusSub": "Yabelana ngesithombe salesi sikhangiso labo bonke abasefonini yakho.",
  "listing.atTodaysRate": "ngentengo yalamuhla",

  "safety.meetPublic": "Hlanganani endaweni elabantu abanengi emini.",
  "safety.inspectFirst": "Bona njalo uhlole into ungakabhadali.",
  "safety.noDeposits": "Ungathumeli imali ye-EcoCash kumbe yasebhanga kumuntu ongakahlangani laye.",
  "safety.reportSuspicious": "Sazise nxa kulokuthile okungahambi kuhle. Sihlola yonke imibiko.",

  "settings.language": "Ulimi",
  "settings.languageNote": "Khetha ulimi lwamamenyu lamakhasi amakhulu. Amanye amakhasi alokhu esesiNgisini sisaqhubeka ukuhumutsha.",
};

const DICTS: Record<Lang, Dict> = { en, sn, nd };
const CACHE_KEY = "app-language-v1";

let current: Lang = "en";
const listeners = new Set<(l: Lang) => void>();

export function t(key: Key, lang: Lang = current): string {
  return DICTS[lang][key] ?? en[key];
}

export function getLanguage(): Lang {
  return current;
}

// expo-file-system (offlineCache) has no web implementation, so the web build
// keeps the choice in localStorage instead.
function readWebLanguage(): Lang | null {
  try {
    return Platform.OS === "web" && typeof localStorage !== "undefined" ? (localStorage.getItem(CACHE_KEY) as Lang | null) : null;
  } catch {
    return null;
  }
}

function writeWebLanguage(lang: Lang) {
  try {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") localStorage.setItem(CACHE_KEY, lang);
  } catch {
    // private mode etc. — the in-memory choice still applies
  }
}

// Web: read synchronously at import so the first render is already in the
// chosen language.
const initialWeb = readWebLanguage();
if (initialWeb && initialWeb in DICTS) current = initialWeb;

export async function loadLanguage(): Promise<Lang> {
  const saved = Platform.OS === "web" ? readWebLanguage() : await loadCache<Lang>(CACHE_KEY).catch(() => null);
  if (saved && saved in DICTS && saved !== current) {
    current = saved;
    listeners.forEach((fn) => fn(current));
  }
  return current;
}

export async function setLanguage(lang: Lang, userId?: string | null): Promise<void> {
  current = lang;
  listeners.forEach((fn) => fn(lang));
  writeWebLanguage(lang);
  if (Platform.OS !== "web") await saveCache(CACHE_KEY, lang).catch(() => {});
  // Mirrors the choice to the profile so notifications/emails can follow it
  // later; failure is harmless (the device setting already applied).
  if (userId) {
    await supabase.from("profiles").update({ language: lang }).eq("id", userId);
  }
}

// Re-renders the calling component when the language changes.
export function useT(): (key: Key) => string {
  const [lang, setLang] = useState<Lang>(current);
  useEffect(() => {
    listeners.add(setLang);
    return () => {
      listeners.delete(setLang);
    };
  }, []);
  return (key: Key) => t(key, lang);
}

export function useLanguage(): Lang {
  const [lang, setLang] = useState<Lang>(current);
  useEffect(() => {
    listeners.add(setLang);
    return () => {
      listeners.delete(setLang);
    };
  }, []);
  return lang;
}
