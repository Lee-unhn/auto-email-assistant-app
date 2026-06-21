import { readGeminiKey } from './electron/keyloader.ts'
import { GoogleGenerativeAI } from '@google/generative-ai'

async function main() {
  const key = await readGeminiKey()
  console.log('key present:', !!key, 'len:', key?.length, 'prefix:', key?.slice(0, 4))
  const genAI = new GoogleGenerativeAI(key!)
  for (const model of ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest']) {
    try {
      const m = genAI.getGenerativeModel({ model })
      const r = await m.generateContent('reply with the word pong')
      console.log(`✓ ${model}:`, r.response.text().trim().slice(0, 30))
    } catch (e: any) {
      console.log(`✗ ${model}:`, String(e?.message ?? e).slice(0, 160))
    }
  }
  process.exit(0)
}
main()
