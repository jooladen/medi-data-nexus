"use client"

import type { ParseException } from "@/lib/types"

type Props = {
  exceptions: ParseException[]
}

export default function ExceptionList({ exceptions }: Props) {
  if (exceptions.length === 0) return null

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
        ⚠️ 미매칭 항목 ({exceptions.length}건)
        <span className="text-xs font-normal text-gray-400">
          — 세부진료정보에서 매칭되지 않은 항목입니다.
        </span>
      </h3>
      <div className="overflow-x-auto rounded-xl border border-amber-200 dark:border-amber-800">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-amber-600 text-white">
              <th className="px-4 py-2 text-center font-semibold whitespace-nowrap">진료일자</th>
              <th className="px-4 py-2 text-left font-semibold">병·의원명</th>
              <th className="px-4 py-2 text-left font-semibold">주상병명</th>
              <th className="px-4 py-2 text-left font-semibold">사유</th>
            </tr>
          </thead>
          <tbody>
            {exceptions.map((item, i) => (
              <tr
                key={i}
                className="border-t border-amber-100 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30"
              >
                <td className="px-4 py-2 text-center text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {item.date}
                </td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{item.hospital}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{item.diagnosis}</td>
                <td className="px-4 py-2 text-amber-700 dark:text-amber-400 text-xs">{item.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
