import { cleanBody } from './src/rules/cleanBody'

let pass = 0, fail = 0
const check = (name: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`  ${cond ? '✓' : '✗'} ${name}`) }

const gmail = `好的，禮拜三可以。\n\nOn Mon, Jun 16, 2026 at 9:00 AM, Wang <wang@x.com> wrote:\n> 你下週三有空嗎？\n> 想約個會議`
check('Gmail 引用被剝除', !cleanBody(gmail).includes('你下週三有空嗎'))
check('Gmail 新內容保留', cleanBody(gmail).includes('禮拜三可以'))

const zh = `沒問題，我準時到。\n\n於 2026年6月16日 王經理 <wang@x.com> 寫道：\n舊的會議內容在這裡`
check('中文「寫道」引用被剝除', !cleanBody(zh).includes('舊的會議內容'))

const sig = `這是正文。\n\n-- \n王小明\n手機 0912-345-678`
check('簽名被剝除', !cleanBody(sig).includes('0912-345-678'))

const quoted = `我的回覆\n> 引用第一行\n> 引用第二行`
check('> 引用行被剝除', !cleanBody(quoted).includes('引用第一行'))

check('全引用時 fallback 不回空', cleanBody('> only quoted').length > 0)
check('純新內容原樣保留', cleanBody('就這樣，謝謝').trim() === '就這樣，謝謝')

// bottom-posting: marker at top, reply written BELOW the quote — must NOT be discarded
const bottom = `On Mon, Jun 16, 2026 at 9:00 AM, Wang <wang@x.com> wrote:\n> 你下週三有空嗎？\n\n好的，禮拜三沒問題，我準時到。`
check('下方回覆(bottom-post)不被吃掉', cleanBody(bottom).includes('禮拜三沒問題'))

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
