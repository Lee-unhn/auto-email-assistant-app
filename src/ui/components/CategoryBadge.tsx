import type { Category } from '../../types'
import { CATEGORY_MAP } from '../../rules/taxonomy'

export function CategoryBadge({ category }: { category: Category }) {
  const def = CATEGORY_MAP[category]
  return (
    <span className="badge" title={def.action}>
      <span className="swatch" style={{ background: def.color }} />
      {def.zh}
    </span>
  )
}
