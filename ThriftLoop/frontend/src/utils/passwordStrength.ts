/**
 * Rates a password for the sign-up meter. It only advises: any password of 8+ characters is accepted.
 * Score 0 = too short, 1 = weak, 2 = fair, 3 = strong, 4 = very strong.
 */
export interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  tip: string;
}

const COMMON = [
  'password', 'passw0rd', '12345678', '123456789', '1234567890', 'qwerty', 'qwertyui', 'iloveyou', 'abc12345',
  'football', 'welcome', 'admin', 'letmein', 'monkey', 'dragon', 'sunshine', 'princess', 'thriftloop', '11111111',
];

export function passwordStrength(password: string, context: string[] = []): Strength {
  if (password.length < 8) {
    return { score: 0, label: 'Too short', tip: `${8 - password.length} more character${password.length === 7 ? '' : 's'} needed.` };
  }
  const lower = password.toLowerCase();
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;

  let points = 0;
  points += password.length >= 16 ? 3 : password.length >= 12 ? 2 : 1;
  points += variety >= 4 ? 2 : variety === 3 ? 1 : 0;

  const repeated = /(.)\1{2,}/.test(password); // aaa, 111
  const sequence = /(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|wert|asdf|zxcv)/i.test(password);
  const common = COMMON.some((c) => lower.includes(c));
  const personal = context.some((c) => c.length >= 3 && lower.includes(c.toLowerCase()));
  if (repeated || sequence) points -= 1;
  if (common || personal) points -= 2;
  if (variety === 1) points -= 1;

  const score = Math.max(1, Math.min(4, points)) as Strength['score'];
  const tip = common
    ? 'This is a very common password. It works, but it’s easy to guess.'
    : personal
      ? 'Avoid using your name or email in your password.'
      : score >= 4
        ? 'Great password.'
        : password.length < 12
          ? 'Longer is stronger: try 12+ characters or a short phrase.'
          : variety < 3
            ? 'Mix in capitals, numbers or a symbol to make it stronger.'
            : 'Good. A few more characters would make it even stronger.';
  return { score, label: ['Too short', 'Weak', 'Fair', 'Strong', 'Very strong'][score], tip };
}
