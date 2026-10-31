// Reads a school class out of free text, so "class 11", "11th", "XI std" and
// "eleventh" all mean Class 11.

const MAX_CLASS = 12;

// Words that announce a class: "class 11", "std 12", "grade 11"
const CLASS_WORDS = new Set(['class', 'cls', 'std', 'standard', 'grade']);

// Endings that may follow a class number: "11th", "12 th", "1st"
const ORDINAL_SUFFIXES = new Set(['st', 'nd', 'rd', 'th']);

const ROMAN_CLASSES: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
  xi: 11,
  xii: 12,
};

// Roman numerals that are safe to read without "class" in front: a lone "x"
// or "v" is more likely part of a topic name than a class.
const STANDALONE_ROMAN = new Set(['xi', 'xii', 'xith', 'xiith']);

const WORD_CLASSES: Record<string, number> = {
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  eleven: 11,
  twelve: 12,
};

export type ClassQuery = {
  // The class asked for, if any
  classNumber: number | null;
  // True when the text only names a class word without a number yet, such
  // as "class" while the student is still typing
  isClassPrefix: boolean;
  // Whatever is left once the class has been read out, lowercased
  rest: string;
};

const toClassNumber = (
  token: string,
  afterClassWord: boolean,
): number | null => {
  if (/^\d+$/.test(token)) {
    const value = Number(token);
    return value >= 1 && value <= MAX_CLASS ? value : null;
  }

  if (token in WORD_CLASSES) return WORD_CLASSES[token];

  const roman = token.replace(/th$/, '');
  if (roman in ROMAN_CLASSES && (afterClassWord || STANDALONE_ROMAN.has(token)))
    return ROMAN_CLASSES[roman];

  return null;
};

// "cla" or "gra" while the student is still typing a class word
const isClassWordPrefix = (tokens: readonly string[]) =>
  tokens.length === 1 &&
  tokens[0].length >= 3 &&
  [...CLASS_WORDS].some(word => word.startsWith(tokens[0]));

export const parseClassQuery = (text: string): ClassQuery => {
  // "class11" and "11th" become "class 11" and "11 th"
  const tokens = text
    .toLowerCase()
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  let classNumber: number | null = null;
  let sawClassWord = false;
  const rest: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (CLASS_WORDS.has(token)) {
      sawClassWord = true;
      continue;
    }

    const previous = tokens[index - 1];
    const value: number | null =
      classNumber === null
        ? toClassNumber(
            token,
            previous !== undefined && CLASS_WORDS.has(previous),
          )
        : null;

    if (value !== null) {
      classNumber = value;
      if (ORDINAL_SUFFIXES.has(tokens[index + 1] ?? '')) index += 1;
      continue;
    }

    rest.push(token);
  }

  return {
    classNumber,
    isClassPrefix:
      classNumber === null &&
      (sawClassWord ? rest.length === 0 : isClassWordPrefix(tokens)),
    rest: rest.join(' '),
  };
};

export const formatClassLevel = (classNumber: number) => `Class ${classNumber}`;
