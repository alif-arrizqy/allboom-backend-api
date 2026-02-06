export function generateCertificateToken(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const alnum = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rnd = (chars: string, len: number) =>
    Array.from({ length: len })
      .map(() => chars[Math.floor(Math.random() * chars.length)])
      .join('');

  const part1 = rnd(letters, 6);
  const year = new Date().getFullYear().toString();
  const part2 = rnd(alnum, 3);

  return `${part1}${year}${part2}`;
}
