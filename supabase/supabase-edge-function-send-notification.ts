// // supabase/functions/send-notification/index.ts
// // Cette fonction doit être déployée sur Supabase Edge Functions

// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
// }

// serve(async (req) => {
//   // Handle CORS
//   if (req.method === 'OPTIONS') {
//     return new Response('ok', { headers: corsHeaders })
//   }

//   try {
//     const { vendorId, title, body } = await req.json()

//     // Créer le client Supabase
//     const supabaseClient = createClient(
//       Deno.env.get('SUPABASE_URL') ?? '',
//       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
//     )

//     // Récupérer les tokens FCM du vendeur
//     const { data: tokens, error: tokensError } = await supabaseClient
//       .from('fcm_tokens')
//       .select('token')
//       .eq('vendor_id', vendorId)

//     if (tokensError) throw tokensError

//     if (!tokens || tokens.length === 0) {
//       return new Response(
//         JSON.stringify({ message: 'No FCM tokens found for vendor' }),
//         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
//       )
//     }

//     // Préparer la requête FCM
//     const fcmUrl = 'https://fcm.googleapis.com/fcm/send'
//     const serverKey = Deno.env.get('FIREBASE_SERVER_KEY')

//     const notifications = tokens.map(async ({ token }) => {
//       const response = await fetch(fcmUrl, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `key=${serverKey}`
//         },
//         body: JSON.stringify({
//           to: token,
//           notification: {
//             title: title,
//             body: body,
//             icon: '/logo.png',
//             click_action: 'https://your-site.com/admin'
//           }
//         })
//       })

//       return response.json()
//     })

//     const results = await Promise.all(notifications)

//     return new Response(
//       JSON.stringify({ success: true, results }),
//       { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
//     )

//   } catch (error) {
//     return new Response(
//       JSON.stringify({ error: error.message }),
//       { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
//     )
//   }
// })
