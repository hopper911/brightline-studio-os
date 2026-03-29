/** True on Vercel (all envs). Uses several vars — some edge cases omit `VERCEL` alone. */
export function isVercelVisualOnly(): boolean {
  return !!(process.env.VERCEL || process.env.VERCEL_URL || process.env.VERCEL_ENV);
}
