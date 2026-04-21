"use client"

import type { ParsedSummary } from "@/lib/types"

const METHOD_LABEL: Record<string, string> = {
  Surgery: "🔪 수술",
  Treatment: "💊 처치",
  Exam: "🔬 검사",
}

type Props = {
  summary: ParsedSummary[]
}

export default function ResultTable({ summary }: Props) {
  if (summary.length === 0) {
    return <p className="text-gray-400 text-center py-8">요약 데이터가 없습니다.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-blue-600 text-white">
            <th className="px-4 py-3 text-left font-semibold">주상병명</th>
            <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">진단코드</th>
            <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">진료기간</th>
            <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">내원일수</th>
            <th className="px-4 py-3 text-center font-semibold">처치구분</th>
            <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">투약일수</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((item, i) => (
            <tr
              key={`${item.diagnosisCode}-${i}`}
              className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                {item.diagnosis}
              </td>
              <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 font-mono text-xs">
                {item.diagnosisCode}
              </td>
              <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300 whitespace-nowrap">
                {item.dateRange.start === item.dateRange.end
                  ? item.dateRange.start
                  : `${item.dateRange.start} ~ ${item.dateRange.end}`}
              </td>
              <td className="px-4 py-3 text-center font-bold text-blue-600 dark:text-blue-400">
                {item.totalVisits}일
              </td>
              <td className="px-4 py-3 text-center">
                {item.methods.length > 0 ? (
                  <div className="flex flex-wrap gap-1 justify-center">
                    {item.methods.map((m) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      >
                        {METHOD_LABEL[m] ?? m}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-300">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                {item.totalMedicationDays > 0 ? `${item.totalMedicationDays}일` : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
