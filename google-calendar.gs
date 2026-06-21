/**
 * google-calendar.gs — 把事件自動建進「本帳號的 Google 行事曆」（含提前提醒）。
 * 給 auto-email-assistant 用，零 Google Cloud、零 OAuth client。
 *
 * 部署（每位家人各做一次，在他/她自己的 Google 帳號下）：
 *  1) script.google.com → 新專案 → 貼上本檔
 *  2) 左下「專案設定」→ 時區設成 Asia/Taipei（重要：事件時間才正確）
 *  3) 部署 → 新增部署作業 → 類型「網頁應用程式」
 *     執行身分 = 我；存取權 = 僅限我自己
 *  4) 首次授權（會要你同意存取行事曆）→ 複製 /exec 網址
 *  5) 寫進該電腦的 ~/.auto-email-assistant-config.json 的 "calendarWebhook"
 *     （或用 app 設定頁貼上）
 */
function doPost(e) {
  try {
    var b = JSON.parse(e.postData.contents)
    var cal = CalendarApp.getDefaultCalendar()
    var start = new Date(b.startISO)
    var end = new Date(b.endISO || b.startISO)
    if (isNaN(end.getTime()) || end <= start) end = new Date(start.getTime() + 60 * 60 * 1000)
    var ev = cal.createEvent(b.summary || '(無標題)', start, end, { description: b.description || '' })
    var rem = b.reminders && b.reminders.length ? b.reminders : [1440, 60]
    ev.removeAllReminders()
    rem.forEach(function (m) { ev.addPopupReminder(m) })
    return json_({ ok: true, id: ev.getId() })
  } catch (err) {
    return json_({ ok: false, error: String(err) })
  }
}

function doGet() {
  return json_({ ok: true, info: 'auto-email-assistant calendar webhook alive' })
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}
