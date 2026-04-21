import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"

export const maxDuration = 60

async function callPythonExcelExporter(jsonData: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pythonCmd = process.platform === "win32" ? "python" : "python3"
    const scriptPath = path.join(process.cwd(), "api", "export_excel_cli.py")

    const proc = spawn(pythonCmd, [scriptPath], { env: { ...process.env } })

    const chunks: Buffer[] = []
    let stderr = ""

    proc.stdin.write(jsonData)
    proc.stdin.end()

    proc.stdout.on("data", (d: Buffer) => chunks.push(d))
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString() })

    proc.on("error", (err) => reject(new Error(`Python 실행 실패: ${err.message}`)))
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Python 종료 코드: ${code}`))
        return
      }
      resolve(Buffer.concat(chunks))
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const jsonStr = JSON.stringify(data)
    const xlsxBuffer = await callPythonExcelExporter(jsonStr)

    return new NextResponse(xlsxBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="insurance_summary.xlsx"',
        "Content-Length": String(xlsxBuffer.length),
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
