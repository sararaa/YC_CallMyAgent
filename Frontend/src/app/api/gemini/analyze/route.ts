import { SAMPLE_GEMINI_THINKING, SAMPLE_GEMINI_RESULT } from '@/lib/mockData'

export const dynamic = 'force-dynamic'

export async function POST() {
  const thinking = SAMPLE_GEMINI_THINKING

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()

      // Stream thinking text char by char
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`))
      await delay(300)

      for (let i = 0; i < thinking.length; i++) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'thinking_chunk', text: thinking[i] })}\n\n`))
        await delay(18)
      }

      await delay(600)
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'thinking_done' })}\n\n`))
      await delay(400)

      // Send final result
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'result', data: SAMPLE_GEMINI_RESULT })}\n\n`))
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
