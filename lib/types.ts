export type ParsedSummary = {
  diagnosis: string
  diagnosisCode: string
  dateRange: { start: string; end: string }
  totalVisits: number
  methods: ('Surgery' | 'Treatment' | 'Exam')[]
  totalMedicationDays: number
}

export type ParseException = {
  date: string
  hospital: string
  diagnosis: string
  reason: string
}

export type ParseResult = {
  summary: ParsedSummary[]
  exceptions: ParseException[]
}
