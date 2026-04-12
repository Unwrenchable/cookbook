/**
 * /api/ai-describe – AI-powered token description generator.
 * Uses OpenAI gpt-4o-mini when OPENAI_API_KEY is set, otherwise returns a template.
 */
import { NextRequest, NextResponse } from "next/server";

const FALLBACK_DESCRIPTIONS: Record<string, string> = {
  "Standard ERC20": "A clean, no-frills ERC20 token built for speed and simplicity. Pure utility, zero bloat. The OGs know what this is.",
  "Taxable (Buy/Sell Tax)": "Every trade fuels the machine. Buy/sell tax auto-fills the marketing war chest — keeping the charts moving and the community hyped.",
  "Deflationary (Auto-Burn)": "Every transfer burns a slice of supply into the void. Deflationary by design, bullish by default. The longer you hold, the rarer it gets.",
  "Reflection (Redistribution)": "Holders earn just by holding. Every on-chain transaction redistributes a cut back to the diamond hands. Pure passive yield, degen style.",
  "Bonding Curve (Meme / pump.fun)": "Pump.fun-style bonding curve token. Price goes up as supply fills up. Early apes eat first. No rugs, just vibes and math.",
  "🤖 AI Agent Token": "An on-chain AI agent controls the burn and redistribution — autonomously, within safety caps. The future of degen is automated.",
  "🏛️ PolitiFi (Prediction Market)": "Choose a side. Win or get burned. Binary prediction market where the market decides the narrative and losers fund the winners.",
  "⚙️ Utility Hybrid (Staking + Burns)": "Stake to earn, hold to survive burns, govern to flex. The SHIB-inspired triple-threat token built for long-term degens.",
  "📈 Pump → CEX (Graduation)": "Starts as a bonding curve, graduates to CEX when the ETH threshold hits. Pump the curve, then ring the bell. GG.",
};

/** Input length caps to prevent prompt injection and API cost drain. */
const MAX_NAME_LEN   = 64;
const MAX_SYMBOL_LEN = 16;
const MAX_FLAVOR_LEN = 64;
const MAX_VIBES_LEN  = 120;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { name?: string; symbol?: string; flavor?: string; vibes?: string };
    const {
      name   = "Token",
      symbol = "TKN",
      flavor = "Standard ERC20",
      vibes  = "degen meme crypto",
    } = body;

    // Sanitise + truncate — prevents prompt injection and runaway token costs
    const safeName   = String(name).replace(/[^\w\s$.,!?-]/g, "").slice(0, MAX_NAME_LEN);
    const safeSymbol = String(symbol).replace(/[^\w$]/g, "").slice(0, MAX_SYMBOL_LEN);
    const safeFlavor = String(flavor).replace(/[^\w\s()👋🏛️⚙️📈🤖/.,+-]/g, "").slice(0, MAX_FLAVOR_LEN);
    const safeVibes  = String(vibes).replace(/[^\w\s.,!-]/g, "").slice(0, MAX_VIBES_LEN);

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      const description =
        FALLBACK_DESCRIPTIONS[safeFlavor] ??
        `${safeName} (${safeSymbol}) is a next-gen token built for the degen community. Ape in, hold tight, and let the charts do the talking.`;
      return NextResponse.json({ description });
    }

    const systemPrompt =
      "You are a degen crypto token description writer. Write punchy, hype, 2-3 sentence token descriptions for meme coins and DeFi tokens. Keep it under 100 words. No emojis in the text itself.";
    const userPrompt = `Write a description for ${safeName} (${safeSymbol}) — a ${safeFlavor} token. Vibes: ${safeVibes}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 150,
        temperature: 0.9,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `OpenAI error: ${txt}` }, { status: 502 });
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const description = data.choices[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ description });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
