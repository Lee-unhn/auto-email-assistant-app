// Verify Claude-mode web search flows through the provider → grounding links.
import { ClaudeCliProvider } from './src/llm/claudeCli.ts'
async function main() {
  const llm = new ClaudeCliProvider()
  const r = await llm.complete({
    system: '你用 WebSearch 查證並在最後附 Sources 連結。',
    user: 'NVIDIA DLI「擴散模型的生成式 AI」課程的官方頁面是哪個？給 1-2 個權威連結。',
    useWebSearch: true
  })
  console.log('grounding links:', r.grounding.length)
  for (const g of r.grounding) console.log('  -', g.url)
  console.log('text head:', r.text.replace(/\s+/g, ' ').slice(0, 160))
  process.exit(0)
}
main().catch((e) => { console.error('ERR', e?.message ?? e); process.exit(1) })
