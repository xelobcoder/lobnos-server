const commonWords = ['password', 'qwerty', 'letmein', 'welcome', 'admin', 'administrator', 'changeme', 'iloveyou', '123456789012', 'abcdefgh', 'primelab', 'laboratory'];

export function passwordProblem(password: unknown): string | null {
    if (typeof password !== 'string' || password.length < 12) return 'Use at least 12 characters.';
    if (Buffer.byteLength(password, 'utf8') > 72) return 'Use at most 72 UTF-8 bytes.';
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Include a letter and a number.';
    const normalized = password.toLowerCase().replace(/[\d\W_]+$/g, '').replace(/[@]/g, 'a').replace(/[0]/g, 'o').replace(/[!1]/g, 'i').replace(/[3]/g, 'e').replace(/[$5]/g, 's').replace(/[^a-z]/g, '');
    if (commonWords.some(word => normalized === word || normalized === word + word) || /^(.)\1+$/.test(password) || /^(0123456789|1234567890|123456789012|abcdefghijkl)/i.test(password)) return 'Choose a less common password. Avoid predictable words and sequences.';
    return null;
}

export function requireStrongPassword(password: unknown): string {
    const problem = passwordProblem(password);
    if (problem) throw new Error(problem);
    return password as string;
}
