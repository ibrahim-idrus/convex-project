const gradePointMap: Record<string, number> = {
  A: 4,
  'A-': 3.7,
  'B+': 3.3,
  B: 3,
  'B-': 2.7,
  'C+': 2.3,
  C: 2,
  D: 1,
  E: 0,
}

export function calculateGpa(items: Array<{ gradeValue: string; credits: number }>): number {
  if (items.length === 0) return 0

  const totals = items.reduce(
    (acc, item) => {
      const point = gradePointMap[item.gradeValue] ?? 0
      acc.totalCredits += item.credits
      acc.totalPoints += point * item.credits
      return acc
    },
    { totalCredits: 0, totalPoints: 0 },
  )

  if (totals.totalCredits === 0) return 0
  return Number((totals.totalPoints / totals.totalCredits).toFixed(2))
}

export function calculateAttendancePercentage(records: Array<{ status: 'present' | 'absent' | 'late' }>): number {
  if (records.length === 0) return 0

  const attended = records.reduce((sum, record) => {
    if (record.status === 'present') return sum + 1
    if (record.status === 'late') return sum + 0.5
    return sum
  }, 0)

  return Number(((attended / records.length) * 100).toFixed(2))
}
