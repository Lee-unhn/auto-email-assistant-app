/**
 * google-sheet-task-db.gs — Google Sheet 當作任務 DB 的後端（給 auto-email-assistant）。
 *
 * 部署：1) sheets.google.com 開一張空白試算表 2) 擴充功能→Apps Script，貼上本檔
 *      3) 部署→新增部署作業→類型「網頁應用程式」→執行身分=我、存取權=僅限我自己
 *      4) 複製 /exec 網址 → 給 app：  npx tsx queue.ts run --sheet "https://script.google.com/.../exec"
 *
 * 第一列為表頭；之後每列一個任務。dedup key = id（= 郵件 messageId）。
 */
var COLS = ['id', 'from', 'subject', 'body', 'status', 'attempts', 'category', 'result', 'error', 'date', 'createdAt', 'updatedAt']

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sh = ss.getSheetByName('tasks') || ss.insertSheet('tasks')
  if (sh.getLastRow() === 0) sh.appendRow(COLS)
  return sh
}

function rows_(sh) {
  var data = sh.getDataRange().getValues()
  var head = data.shift() || COLS
  return data.map(function (r) {
    var o = {}
    head.forEach(function (h, i) { o[h] = r[i] })
    return o
  })
}

function doGet(e) {
  var sh = sheet_()
  var status = e && e.parameter && e.parameter.status
  var tasks = rows_(sh).filter(function (t) { return t.id && (!status || t.status === status) })
  return json_({ tasks: tasks })
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents)
  var sh = sheet_()
  if (body.action === 'upsertPending') {
    var existing = {}
    rows_(sh).forEach(function (t) { existing[t.id] = true })
    var now = new Date().toISOString(), added = 0
    ;(body.items || []).forEach(function (it) {
      if (existing[it.id]) return
      sh.appendRow([it.id, it.from, it.subject, (it.body || '').slice(0, 40000), 'pending', 0, '', '', '', it.date, now, now])
      added++
    })
    return json_({ added: added })
  }
  if (body.action === 'update') {
    var data = sh.getDataRange().getValues()
    for (var r = 1; r < data.length; r++) {
      if (data[r][0] === body.id) {
        var p = body.patch || {}
        COLS.forEach(function (c, ci) { if (c in p) data[r][ci] = p[c] })
        data[r][COLS.indexOf('updatedAt')] = new Date().toISOString()
        sh.getRange(r + 1, 1, 1, COLS.length).setValues([data[r].slice(0, COLS.length)])
        return json_({ ok: true })
      }
    }
    return json_({ ok: false, error: 'not found' })
  }
  return json_({ error: 'unknown action' })
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}
