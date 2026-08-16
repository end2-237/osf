// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
// @ts-ignore
import * as djwt from "https://deno.land/x/djwt@v3.0.1/mod.ts"

/* ════════════════════════════════════════════════════════════════════════════
   POUSSER LES NOTIFICATIONS DU RELAIS

   Vide la file `relais_notifications` et pousse chaque ligne vers le téléphone
   de la boutique concernée.

   Deux façons de l'appeler, et il faut les deux :

     · l'application l'invoque juste après un appel à disponibilité, pour que
       les trente secondes commencent tout de suite ;
     · une tâche planifiée l'appelle chaque minute, pour tout ce que
       l'application n'a pas déclenché — la vente confirmée, le bon expiré.

   Une notification d'appel qui a plus de deux minutes n'est plus envoyée :
   l'appel est clos, et pousser une question à laquelle on ne peut plus
   répondre apprend au commerçant à ignorer les suivantes.
   ════════════════════════════════════════════════════════════════════════════ */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getAccessToken(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }
  const pem = privateKey.replace(/\\n/g, '\n')
  const keyData = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, "")
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  )
  const jwt = await djwt.create({ alg: "RS256", typ: "JWT" }, payload, cryptoKey)
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })
  const data = await r.json()
  return data.access_token
}

// @ts-ignore
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // @ts-ignore
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: file, error } = await supabase.rpc('notifications_a_envoyer', { p_limite: 100 })
    if (error) throw new Error(error.message)
    if (!file?.length) {
      return new Response(JSON.stringify({ ok: true, envoyees: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Un seul aller-retour pour tous les jetons de toutes les boutiques
    // concernées : la file contient souvent trois lignes pour un même appel.
    const vendorIds = [...new Set(file.map((n: any) => n.vendor_id))]
    const { data: tokens } = await supabase
      .from('fcm_tokens').select('vendor_id, token').in('vendor_id', vendorIds)

    const parVendeur = new Map<string, string[]>()
    for (const t of tokens || []) {
      if (!parVendeur.has(t.vendor_id)) parVendeur.set(t.vendor_id, [])
      parVendeur.get(t.vendor_id)!.push(t.token)
    }

    // @ts-ignore
    const accessToken = await getAccessToken(Deno.env.get('FIREBASE_CLIENT_EMAIL')!, Deno.env.get('FIREBASE_PRIVATE_KEY')!)
    // @ts-ignore
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID')
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

    const envois: Promise<Response>[] = []
    for (const n of file) {
      for (const token of parVendeur.get(n.vendor_id) || []) {
        envois.push(fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: n.titre, body: n.corps },
              webpush: {
                notification: {
                  icon: "/ofs.png",
                  // Un appel doit sonner et rester à l'écran : le commerçant a
                  // trente secondes. Le reste peut attendre qu'il regarde.
                  requireInteraction: n.genre === 'appel',
                  tag: n.genre === 'appel' ? 'relais-appel' : `relais-${n.id}`,
                },
                fcm_options: { link: n.lien || '/admin' },
              },
              data: { genre: n.genre, lien: n.lien || '/admin' },
            },
          }),
        }))
      }
    }

    await Promise.allSettled(envois)

    // On marque tout, y compris ce qui n'avait aucun jeton : une boutique sans
    // notification poussée verra quand même la ligne dans son tableau de bord,
    // et on ne veut pas la repousser indéfiniment.
    await supabase.rpc('marquer_notifications_envoyees', { p_ids: file.map((n: any) => n.id) })

    return new Response(JSON.stringify({ ok: true, envoyees: file.length, poussees: envois.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
