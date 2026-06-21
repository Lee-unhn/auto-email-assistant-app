import type { Category } from '../types'

// Ported from the G:\auto-email-assistant prototype §3. Single source of truth
// for the classifier prompt and the UI labels/colors.
export interface CategoryDef {
  id: Category
  label: string
  zh: string
  action: string
  color: string // maps to a CSS accent
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'ACTION_EVENT', label: 'Event', zh: '含日期可排程', action: '建行事曆事件 + 提前提醒', color: '#5e6ad2' },
  { id: 'ACTION_REPLY', label: 'Reply', zh: '真人需回覆', action: '草擬草稿（永不寄）', color: '#7170ff' },
  { id: 'ACTION_MATERIAL', label: 'Material', zh: '需找材料', action: '本機/Drive/web 檢索', color: '#27a644' },
  { id: 'FLAG_SECURITY', label: 'Security', zh: '安全警示', action: '只通知，不處理', color: '#dc2626' },
  { id: 'FLAG_FINANCE', label: 'Finance', zh: '金流留意', action: '只通知，不處理', color: '#eab308' },
  { id: 'INFO_BANK', label: 'Bank info', zh: '銀行通知', action: '旗標，不回信', color: '#8a8f98' },
  { id: 'INFO_SYS', label: 'System', zh: '系統通知', action: '略過', color: '#8a8f98' },
  { id: 'NOISE_JOB', label: 'Jobs', zh: '求職平台', action: '略過', color: '#62666d' },
  { id: 'NOISE_SOCIAL', label: 'Social', zh: '社群通知', action: '略過', color: '#62666d' },
  { id: 'NOISE_MARKETING', label: 'Marketing', zh: '行銷', action: '略過', color: '#62666d' },
  { id: 'SELF_AUTOMATED', label: 'Self', zh: '自寄自動信', action: '略過', color: '#62666d' }
]

export const CATEGORY_MAP: Record<Category, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
) as Record<Category, CategoryDef>

// Compact catalog injected into the classifier prompt.
export const TAXONOMY_PROMPT = CATEGORIES.map(
  (c) => `- ${c.id}: ${c.zh} → ${c.action}`
).join('\n')

export const ACTIONABLE: Category[] = ['ACTION_EVENT', 'ACTION_REPLY', 'ACTION_MATERIAL']
export const FLAGS: Category[] = ['FLAG_SECURITY', 'FLAG_FINANCE']
