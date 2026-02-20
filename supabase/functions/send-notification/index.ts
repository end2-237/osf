// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
// @ts-ignore
import * as djtw from "https://deno.land/x/djwt@v3.0.1/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fonction pour générer le Token Google OAuth2 manuellement
async function getAccessToken(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const pem = privateKey.replace(/\\n/g, '\n');
  const keyData = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, "");
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const jwt = await djtw.create({ alg: "RS256", typ: "JWT" }, payload, cryptoKey);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await response.json();
  return data.access_token;
}

// @ts-ignore
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { vendorId, title, body } = await req.json()

    // @ts-ignore
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: tokens } = await supabase.from('fcm_tokens').select('token').eq('vendor_id', vendorId)

    if (!tokens || tokens.length === 0) return new Response("No tokens", { status: 404 })

    // @ts-ignore
    const accessToken = await getAccessToken(Deno.env.get('FIREBASE_CLIENT_EMAIL')!, Deno.env.get('FIREBASE_PRIVATE_KEY')!)
    // @ts-ignore
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID')
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

    const requests = tokens.map(t => 
      fetch(fcmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          message: {
            token: t.token,
            notification: { title, body },
            webpush: {
              notification: { icon: "/ofs.png" },
              fcm_options: { link: "/admin" }
            }
          }
        })
      })
    )

    await Promise.all(requests)
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})