// // supabase/functions/send-notification/index.ts
// import { serve } from "std/http/server"
// import { createClient } from "supabase"

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
// }

// interface NotificationPayload {
//   vendorId: string;
//   title: string;
//   body: string;
// }

// serve(async (req: Request) => {
//   if (req.method === 'OPTIONS') {
//     return new Response('ok', { headers: corsHeaders })
//   }

//   try {
//     const { vendorId, title, body }: NotificationPayload = await req.json()

//     const supabaseClient = createClient(
//       Deno.env.get('SUPABASE_URL') ?? '',
//       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
//     )

//     const { data: tokens, error: tokensError } = await supabaseClient
//       .from('fcm_tokens')
//       .select('token')
//       .eq('vendor_id', vendorId)

//     if (tokensError) throw tokensError

//     if (!tokens || tokens.length === 0) {
//       return new Response(JSON.stringify({ error: 'No tokens' }), { 
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
//         status: 404 
//       })
//     }

//     const serverKey = Deno.env.get('FIREBASE_SERVER_KEY')
//     const fcmUrl = 'https://fcm.googleapis.com/fcm/send'

//     const requests = tokens.map(t => 
//       fetch(fcmUrl, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `key=${serverKey}`
//         },
//         body: JSON.stringify({
//           to: t.token,
//           notification: { title, body, icon: '/ofs.png' }
//         })
//       })
//     )

//     await Promise.all(requests)

//     return new Response(JSON.stringify({ ok: true }), { 
//       headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
//       status: 200 
//     })

//   } catch (error) {
//     return new Response(JSON.stringify({ error: error.message }), { 
//       headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
//       status: 400 
//     })
//   }
// })