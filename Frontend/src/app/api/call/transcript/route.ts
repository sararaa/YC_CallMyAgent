import { SAMPLE_TRANSCRIPT } from '@/lib/mockData'

export const dynamic = 'force-dynamic'

export async function GET() {
  const words = SAMPLE_TRANSCRIPT.split(' ')
  let msgId = 'msg-' + Date.now()
  let wordIndex = 0

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()

      // Start a new caller message
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'message_start', messageId: msgId })}\n\n`))
      await delay(600)

      for (let i = 0; i < words.length; i++) {
        const word = (i === 0 ? '' : ' ') + words[i]
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'word', messageId: msgId, word })}\n\n`))

        // Natural sentence breaks
        if (words[i].endsWith('.') || words[i].endsWith('?') || words[i].endsWith('!')) {
          await delay(700)
          if (i < words.length - 1) {
            msgId = 'msg-' + Date.now() + '-' + (++wordIndex)
            await delay(1200)
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'message_start', messageId: msgId })}\n\n`))
            await delay(400)
          }
        } else {
          await delay(120)
        }
      }

      await delay(800)
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'call_ended' })}\n\n`))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
