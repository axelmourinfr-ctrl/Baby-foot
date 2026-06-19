// ══════════════════════════════════════════
// Supabase Edge Function — coach-ia
// Proxy sécurisé vers Google Gemini API
// La clé Gemini reste secrète côté serveur, jamais exposée au navigateur
// ══════════════════════════════════════════
//
// INSTALLATION :
// 1. Installe la CLI Supabase : npm install -g supabase
// 2. Dans le terminal, depuis le dossier du projet :
//    supabase functions new coach-ia
// 3. Remplace le contenu généré par celui-ci
// 4. Ajoute ta clé Gemini en secret :
//    supabase secrets set GEMINI_API_KEY=ta_cle_ici
// 5. Déploie :
//    supabase functions deploy coach-ia
//
// Une fois déployée, l'URL sera :
// https://qpnuiyzovxtvldmbelnk.supabase.co/functions/v1/coach-ia

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { systemPrompt, userMessage, mode } = await req.json();

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Clé Gemini non configurée côté serveur" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fullPrompt = systemPrompt + "\n\n" + userMessage;

    const geminiResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.7,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      return new Response(
        JSON.stringify({ error: "Erreur Gemini: " + errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await geminiResponse.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(
      JSON.stringify({ text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erreur serveur: " + err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
