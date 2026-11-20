const usdToEur = 0.92;
const tokenRates = {
  main: { input: 2, output: 10 },
  fast: { input: 0.10, output: 0.50 },
};

export function estimateOpenAiEur(
  tier: keyof typeof tokenRates,
  usage: { input_tokens: number; output_tokens: number } | null | undefined,
) {
  if (!usage) return 0;
  const rate = tokenRates[tier];
  return (usage.input_tokens * rate.input + usage.output_tokens * rate.output) * usdToEur / 1_000_000;
}

export function buildCostPayload(callSeconds: number, openAiEur: number) {
  // Round the components to cents so their displayed sum equals the displayed total.
  const voiceCents = Math.round(callSeconds / 60 * 0.08 * usdToEur * 100);
  const phoneCents = Math.round(callSeconds / 60 * 0.04 * usdToEur * 100);
  const openAiCents = Math.round(openAiEur * 100);
  return {
    total_eur: (voiceCents + phoneCents + openAiCents) / 100,
    breakdown: {
      voice_eur: voiceCents / 100,
      phone_eur: phoneCents / 100,
      openai_eur: openAiCents / 100,
    },
  };
}
