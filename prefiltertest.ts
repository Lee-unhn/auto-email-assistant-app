// Pure unit test for the zero-LLM pre-filter — no network, no Gemini quota.
import { preFilter } from './src/rules/preFilter'
import type { EmailMessage } from './src/types'

const msg = (from: string, subject = '', body = ''): EmailMessage =>
  ({ id: 'x', from, to: ['me@gmail.com'], subject, date: '', snippet: '', body })

const opts = { selfAddress: 'me@gmail.com', vipSenders: ['boss@company.com'] }
let pass = 0, fail = 0
const check = (name: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`  ${cond ? '✓' : '✗'} ${name}`) }

// must SKIP (high-confidence noise)
check('no-reply → noise skip', preFilter(msg('LinkedIn <jobs-noreply@e.linkedin.com>', '新工作機會'), opts)?.confidence! >= 0.8)
check('facebook 社群網域 → noise', preFilter(msg('Facebook <notify@facebookmail.com>', '有新通知'), opts)?.category === 'NOISE_SOCIAL')
check('自寄信 → SELF_AUTOMATED', preFilter(msg('me@gmail.com', '備忘'), opts)?.category === 'SELF_AUTOMATED')

// SAFETY GATE — must NOT pre-filter (return null → goes to LLM)
check('安全字樣即使 no-reply 也不過濾', preFilter(msg('no-reply@bank.com', '您的登入驗證碼'), opts) === null)
check('金流字樣不過濾', preFilter(msg('billing-noreply@shop.com', '您的發票與付款明細'), opts) === null)
check('行事曆字樣不過濾', preFilter(msg('noreply@calendly.com', '會議邀請：週三面試'), opts) === null)
check('VIP 不過濾', preFilter(msg('boss@company.com', 'sale 優惠'), opts) === null)
check('一般真人信不過濾', preFilter(msg('alice@friend.com', '週末聚餐?'), opts) === null)

// never emits an actionable/flag category
const all = [preFilter(msg('x@linkedin.com'), opts), preFilter(msg('me@gmail.com'), opts)].filter(Boolean)
check('永不回 ACTION_*/FLAG_*', all.every((c) => c!.category.startsWith('NOISE') || c!.category === 'SELF_AUTOMATED'))

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
