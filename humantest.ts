// Human-usage e2e proof: runs the REAL new pipeline (pre-filter → batch classify →
// orchestrate) on the SAMPLE mailbox via Claude CLI. No Gemini quota, no real inbox,
// no email sent, no calendar mutated. Run: npx tsx humantest.ts
import os from 'os'
import path from 'path'
import { SampleMailProvider } from './src/mail/sample.ts'
import { ClaudeCliProvider } from './src/llm/claudeCli.ts'
import { orchestrate } from './src/agents/orchestrator.ts'
import { preFilter, PREFILTER_SKIP } from './src/rules/preFilter.ts'
import { classify, batchClassify } from './src/agents/classifier.ts'
import { bucketOf, BUCKET_LABEL } from './src/rules/taxonomy.ts'
import { DEFAULT_SETTINGS, type AgentEvent, type Classification, type EmailThread } from './src/types.ts'

async function main() {
  const mail = new SampleMailProvider(path.join(process.cwd(), 'fixtures'), path.join(os.tmpdir(), 'aea-humantest-drafts'))
  const llm = new ClaudeCliProvider(os.tmpdir())
  const threads = await mail.listThreads({ maxResults: 40 })
  const ctx = { llm, settings: DEFAULT_SETTINGS, today: new Date().toISOString().slice(0, 10), localScan: async () => [], emit: (_e: Omit<AgentEvent, 'ts'>) => {} }
  console.log(`讀到 ${threads.length} 封範例信。引擎：Claude CLI（無 Gemini 額度消耗）。\n`)

  // 1) zero-LLM pre-filter
  const classMap = new Map<string, Classification>()
  const toClassify: EmailThread[] = []
  let prefiltered = 0
  for (const t of threads) {
    const pre = preFilter(t.messages[0], { vipSenders: [] })
    if (pre && pre.confidence >= PREFILTER_SKIP) { classMap.set(t.id, pre); prefiltered++ }
    else toClassify.push(t)
  }

  // 2) batch classify the rest
  let llmCalls = 0
  for (let i = 0; i < toClassify.length; i += 10) {
    const chunk = toClassify.slice(i, i + 10)
    try { const res = await batchClassify(chunk, ctx); llmCalls++; chunk.forEach((t, j) => classMap.set(t.id, res[j])) }
    catch { for (const t of chunk) { try { classMap.set(t.id, await classify(t, ctx)); llmCalls++ } catch {} } }
  }

  // 3) orchestrate (deep agents only for ACTION_*) using precomputed classification
  const buckets: Record<string, string[]> = { act: [], watch: [], skip: [] }
  for (const t of threads) {
    const o = await orchestrate(t, ctx, classMap.get(t.id))
    const b = bucketOf(o.classification.category, o.classification.urgency)
    const art = [o.events?.length ? `${o.events.length}行程` : '', o.draft ? '草稿' : '', o.materials?.length ? `${o.materials.length}材料` : '', o.flagNote ? '旗標' : ''].filter(Boolean).join('+') || '略過'
    const src = classMap.get(t.id)!.confidence >= PREFILTER_SKIP && classMap.get(t.id)!.reason.length < 12 ? '規則' : 'LLM'
    buckets[b].push(`  • [${o.classification.category}/${src}] ${t.messages[0].subject.slice(0, 40)} → ${art}`)
  }

  console.log(`分類來源：規則預過濾 ${prefiltered} 封（0 LLM）｜LLM 呼叫 ${llmCalls} 次（含批次；舊版會是 ${threads.length} 次）\n`)
  for (const b of ['act', 'watch', 'skip']) {
    if (buckets[b].length) { console.log(`【${BUCKET_LABEL[b as 'act']}】(${buckets[b].length})`); console.log(buckets[b].join('\n')) }
  }
  console.log('\n✓ 完整新管線在範例信上跑通（無寄信／無真實收件匣／無額度消耗）')
  process.exit(0)
}
main().catch((e) => { console.error('ERROR:', e?.message ?? e); process.exit(1) })
