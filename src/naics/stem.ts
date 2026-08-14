/**
 * TS port of BEACON's clean_text()/__stem() (beacon/beacon.py L285-821) — the
 * NLTK Porter2/Snowball English stemmer with BEACON's stop-word, special-word,
 * and mapping overrides. Ported line-for-line to preserve exact parity
 * (§V6) — do not "simplify" the suffix-step logic, order and break-on-first-
 * match behavior are load-bearing.
 */

const STOP_WORDS = new Set([
  "a",
  "am",
  "an",
  "and",
  "are",
  "as",
  "but",
  "by",
  "for",
  "from",
  "i",
  "if",
  "in",
  "is",
  "it",
  "on",
  "or",
  "other",
  "since",
  "so",
  "the",
  "this",
  "to",
  "we",
  "with",
  "you",
]);

const VOWELS = "aeiouy";
const DOUBLE_CONSONANTS = ["bb", "dd", "ff", "gg", "mm", "nn", "pp", "rr", "tt"];
const LI_ENDING = "cdeghkmnrt";

const STEP1A_SUFFIXES = ["sses", "ied", "ies", "us", "ss", "s"];
const STEP1B_SUFFIXES = ["eedly", "ingly", "edly", "eed", "ing", "ed"];
const STEP2_SUFFIXES = [
  "ization",
  "ational",
  "fulness",
  "ousness",
  "iveness",
  "tional",
  "biliti",
  "lessli",
  "entli",
  "ation",
  "alism",
  "aliti",
  "ousli",
  "iviti",
  "fulli",
  "enci",
  "anci",
  "abli",
  "izer",
  "ator",
  "alli",
  "bli",
  "ogi",
  "li",
];
const STEP3_SUFFIXES = [
  "ational",
  "tional",
  "alize",
  "icate",
  "iciti",
  "ative",
  "ical",
  "ness",
  "ful",
];
const STEP4_SUFFIXES = [
  "ement",
  "ance",
  "ence",
  "able",
  "ible",
  "ment",
  "ant",
  "ent",
  "ism",
  "ate",
  "iti",
  "ous",
  "ive",
  "ize",
  "ion",
  "al",
  "er",
  "ic",
];
const STEP6_SUFFIXES = [
  "curist",
  "graphi",
  "logi",
  "logist",
  "nomi",
  "nomist",
  "pathi",
  "pathet",
  "physicist",
  "scopi",
  "therapeut",
  "therapi",
  "therapist",
  "tomi",
  "tomist",
  "tri",
  "trist",
  "trician",
  "turist",
];

const SPECIAL_WORDS: Record<string, string> = {
  skis: "ski",
  skies: "sky",
  dying: "die",
  lying: "lie",
  tying: "tie",
  idly: "idl",
  gently: "gentl",
  ugly: "ugli",
  early: "earli",
  only: "onli",
  singly: "singl",
  sky: "sky",
  news: "news",
  howe: "howe",
  atlas: "atlas",
  cosmos: "cosmos",
  bias: "bias",
  andes: "andes",
  inning: "inning",
  innings: "inning",
  outing: "outing",
  outings: "outing",
  canning: "canning",
  cannings: "canning",
  herring: "herring",
  herrings: "herring",
  earring: "earring",
  earrings: "earring",
  proceed: "proceed",
  proceeds: "proceed",
  proceeded: "proceed",
  proceeding: "proceed",
  exceed: "exceed",
  exceeds: "exceed",
  exceeded: "exceed",
  exceeding: "exceed",
  succeed: "success",
  succeeds: "success",
  succeeded: "success",
  succeeding: "success",
};

const MAP_DICT: Record<string, string> = {
  auto: "car",
  automobil: "car",
  automot: "car",
};

const isVowel = (ch: string) => VOWELS.includes(ch);
const endsWithAny = (word: string, suffixes: readonly string[]) =>
  suffixes.find((s) => word.endsWith(s));
const startsWithAny = (word: string, prefixes: readonly string[]) =>
  prefixes.some((p) => word.startsWith(p));

function r1r2(word: string): [string, string] {
  let r1 = "";
  let r2 = "";
  for (let i = 1; i < word.length; i++) {
    if (!isVowel(word[i]) && isVowel(word[i - 1])) {
      r1 = word.slice(i + 1);
      break;
    }
  }
  for (let i = 1; i < r1.length; i++) {
    if (!isVowel(r1[i]) && isVowel(r1[i - 1])) {
      r2 = r1.slice(i + 1);
      break;
    }
  }
  return [r1, r2];
}

const suffixReplace = (original: string, old: string, next: string) =>
  original.slice(0, -old.length) + next;

export function stem(word: string): string {
  if (word in SPECIAL_WORDS) return SPECIAL_WORDS[word];
  if (word.length <= 3) return word;

  if (word.startsWith("y")) word = "Y" + word.slice(1);
  for (let i = 1; i < word.length; i++) {
    if (isVowel(word[i - 1]) && word[i] === "y") {
      word = word.slice(0, i) + "Y" + word.slice(i + 1);
    }
  }

  let r1 = "";
  let r2 = "";

  if (startsWithAny(word, ["gener", "commun", "arsen"])) {
    r1 = startsWithAny(word, ["gener", "arsen"]) ? word.slice(5) : word.slice(6);
    for (let i = 1; i < r1.length; i++) {
      if (!isVowel(r1[i]) && isVowel(r1[i - 1])) {
        r2 = r1.slice(i + 1);
        break;
      }
    }
  } else {
    [r1, r2] = r1r2(word);
  }

  // STEP 1a
  {
    const suffix = endsWithAny(word, STEP1A_SUFFIXES);
    if (suffix) {
      if (suffix === "sses") {
        word = word.slice(0, -2);
        r1 = r1.slice(0, -2);
        r2 = r2.slice(0, -2);
      } else if (suffix === "ied" || suffix === "ies") {
        if (word.slice(0, -suffix.length).length > 1) {
          word = word.slice(0, -2);
          r1 = r1.slice(0, -2);
          r2 = r2.slice(0, -2);
        } else {
          word = word.slice(0, -1);
          r1 = r1.slice(0, -1);
          r2 = r2.slice(0, -1);
        }
      } else if (suffix === "s") {
        const vowelFound = word.slice(0, -2).split("").some(isVowel);
        if (vowelFound) {
          word = word.slice(0, -1);
          r1 = r1.slice(0, -1);
          r2 = r2.slice(0, -1);
        }
      }
    }
  }

  // STEP 1b
  {
    const suffix = endsWithAny(word, STEP1B_SUFFIXES);
    if (suffix) {
      if (suffix === "eed" || suffix === "eedly") {
        if (r1.endsWith(suffix)) {
          word = suffixReplace(word, suffix, "ee");
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "ee") : "";
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "ee") : "";
        }
      } else {
        const vowelFound = word.slice(0, -suffix.length).split("").some(isVowel);
        if (vowelFound) {
          word = word.slice(0, -suffix.length);
          r1 = r1.slice(0, -suffix.length);
          r2 = r2.slice(0, -suffix.length);
          if (word.endsWith("at") || word.endsWith("bl") || word.endsWith("iz")) {
            word = word + "e";
            r1 = r1 + "e";
            if (word.length > 5 || r1.length >= 3) r2 = r2 + "e";
          } else if (endsWithAny(word, DOUBLE_CONSONANTS)) {
            word = word.slice(0, -1);
            r1 = r1.slice(0, -1);
            r2 = r2.slice(0, -1);
          } else if (
            (r1 === "" &&
              word.length >= 3 &&
              !isVowel(word[word.length - 1]) &&
              !"wxY".includes(word[word.length - 1]) &&
              isVowel(word[word.length - 2]) &&
              !isVowel(word[word.length - 3])) ||
            (r1 === "" && word.length === 2 && isVowel(word[0]) && !isVowel(word[1]))
          ) {
            word = word + "e";
            if (r1.length > 0) r1 = r1 + "e";
            if (r2.length > 0) r2 = r2 + "e";
          }
        }
      }
    }
  }

  // STEP 1c
  if (word.length > 2 && "yY".includes(word[word.length - 1]) && !isVowel(word[word.length - 2])) {
    word = word.slice(0, -1) + "i";
    r1 = r1.length >= 1 ? r1.slice(0, -1) + "i" : "";
    r2 = r2.length >= 1 ? r2.slice(0, -1) + "i" : "";
  }

  // STEP 2
  {
    const suffix = endsWithAny(word, STEP2_SUFFIXES);
    if (suffix && r1.endsWith(suffix)) {
      if (
        suffix === "entli" ||
        suffix === "fulli" ||
        suffix === "lessli" ||
        suffix === "tional" ||
        (suffix === "li" && LI_ENDING.includes(word[word.length - 3]))
      ) {
        word = word.slice(0, -2);
        r1 = r1.slice(0, -2);
        r2 = r2.slice(0, -2);
      } else if (suffix === "enci" || suffix === "anci" || suffix === "abli") {
        word = word.slice(0, -1) + "e";
        r1 = r1.length >= 1 ? r1.slice(0, -1) + "e" : "";
        r2 = r2.length >= 1 ? r2.slice(0, -1) + "e" : "";
      } else if (suffix === "izer" || suffix === "ization") {
        word = suffixReplace(word, suffix, "ize");
        r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "ize") : "";
        r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "ize") : "";
      } else if (suffix === "ational" || suffix === "ation" || suffix === "ator") {
        word = suffixReplace(word, suffix, "ate");
        r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "ate") : "";
        r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "ate") : "e";
      } else if (suffix === "alism" || suffix === "aliti" || suffix === "alli") {
        word = suffixReplace(word, suffix, "al");
        r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "al") : "";
        r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "al") : "";
      } else if (suffix === "fulness") {
        word = word.slice(0, -4);
        r1 = r1.slice(0, -4);
        r2 = r2.slice(0, -4);
      } else if (suffix === "ousli" || suffix === "ousness") {
        word = suffixReplace(word, suffix, "ous");
        r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "ous") : "";
        r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "ous") : "";
      } else if (suffix === "iveness" || suffix === "iviti") {
        word = suffixReplace(word, suffix, "ive");
        r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "ive") : "";
        r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "ive") : "e";
      } else if (suffix === "biliti" || suffix === "bli") {
        word = suffixReplace(word, suffix, "ble");
        r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "ble") : "";
        r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "ble") : "";
      } else if (suffix === "ogi" && word[word.length - 4] === "l") {
        word = word.slice(0, -1);
        r1 = r1.slice(0, -1);
        r2 = r2.slice(0, -1);
      }
    }
  }

  // STEP 3
  {
    const suffix = endsWithAny(word, STEP3_SUFFIXES);
    if (suffix && r1.endsWith(suffix)) {
      if (suffix === "tional") {
        word = word.slice(0, -2);
        r1 = r1.slice(0, -2);
        r2 = r2.slice(0, -2);
      } else if (suffix === "ational") {
        word = suffixReplace(word, suffix, "ate");
        r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "ate") : "";
        r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "ate") : "";
      } else if (suffix === "alize") {
        word = word.slice(0, -3);
        r1 = r1.slice(0, -3);
        r2 = r2.slice(0, -3);
      } else if (suffix === "icate" || suffix === "iciti" || suffix === "ical") {
        word = suffixReplace(word, suffix, "ic");
        r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, "ic") : "";
        r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, "ic") : "";
      } else if (suffix === "ful" || suffix === "ness") {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
      } else if (suffix === "ative" && r2.endsWith(suffix)) {
        word = word.slice(0, -5);
        r1 = r1.slice(0, -5);
        r2 = r2.slice(0, -5);
      }
    }
  }

  // STEP 4
  {
    const suffix = endsWithAny(word, STEP4_SUFFIXES);
    if (suffix && r2.endsWith(suffix)) {
      if (suffix === "ion") {
        if ("st".includes(word[word.length - 4])) {
          word = word.slice(0, -3);
          r1 = r1.slice(0, -3);
          r2 = r2.slice(0, -3);
        }
      } else {
        word = word.slice(0, -suffix.length);
        r1 = r1.slice(0, -suffix.length);
        r2 = r2.slice(0, -suffix.length);
      }
    }
  }

  // STEP 5
  if (
    (r2.endsWith("l") && word[word.length - 2] === "l") ||
    r2.endsWith("e") ||
    (r1.endsWith("e") &&
      word.length >= 4 &&
      (isVowel(word[word.length - 2]) ||
        "wxY".includes(word[word.length - 2]) ||
        !isVowel(word[word.length - 3]) ||
        isVowel(word[word.length - 4])))
  ) {
    word = word.slice(0, -1);
  }

  word = word.replace(/Y/g, "y");

  // STEP 6
  {
    const suffix = endsWithAny(word, STEP6_SUFFIXES);
    if (suffix) {
      if (
        (suffix === "graphi" && word.length >= 9) ||
        (suffix === "logi" && word.length >= 7) ||
        (suffix === "nomi" && word.length >= 7) ||
        (suffix === "pathi" && word.length >= 6) ||
        (suffix === "scopi" && word.length >= 8) ||
        suffix === "therapi" ||
        (suffix === "tomi" && word.length >= 7) ||
        (suffix === "tri" && word.length >= 8 && "ae".includes(word[word.length - 4]))
      ) {
        word = word.slice(0, -1);
      } else if (suffix === "pathet" && word.length >= 7) {
        word = word.slice(0, -2);
      } else if (
        (suffix === "curist" && word.length >= 8) ||
        (suffix === "logist" && word.length >= 9) ||
        (suffix === "nomist" && word.length >= 9) ||
        suffix === "therapeut" ||
        suffix === "therapist" ||
        (suffix === "tomist" && word.length >= 9) ||
        (suffix === "trist" && word.length >= 10 && "ae".includes(word[word.length - 6])) ||
        (suffix === "turist" && word.length >= 8)
      ) {
        word = word.slice(0, -3);
      } else if (
        suffix === "physicist" ||
        (suffix === "trician" && word.length >= 10 && "ae".includes(word[word.length - 8]))
      ) {
        word = word.slice(0, -5);
      }
    }
  }

  return word;
}

const mapWord = (word: string) => MAP_DICT[word] ?? word;

export function cleanText(text: string): string {
  text = text.toLowerCase();
  text = text.replace(/\bcarrepair\b/g, " car repair ");
  text = text.replace(/\block[ -]+smith/g, " locksmith");
  text = text.replace(/\(except.*\)/g, " ");
  text = text.replace(/[^a-z]+/g, " ");
  text = text.trim();
  text = text
    .split(" ")
    .filter((w) => w !== "" && !STOP_WORDS.has(w))
    .join(" ");
  text = text
    .split(" ")
    .filter((w) => w !== "")
    .map(stem)
    .join(" ");
  text = text
    .split(" ")
    .filter((w) => w !== "")
    .map(mapWord)
    .join(" ");
  return text;
}
