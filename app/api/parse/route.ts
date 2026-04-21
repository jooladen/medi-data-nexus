import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import { writeFile, unlink, mkdir } from "fs/promises"
import { tmpdir } from "os"
import path from "path"

export const maxDuration = 60

async function callPythonParser(filePaths: string[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // Windows에서 python 또는 python3 자동 감지
    const pythonCmd = process.platform === "win32" ? "python" : "python3"
    const scriptPath = path.join(process.cwd(), "api", "parse_cli.py")

    const proc = spawn(pythonCmd, [scriptPath, ...filePaths], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    })

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString("utf8") })
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString("utf8") })

    proc.on("error", (err) => reject(new Error(`Python 실행 실패: ${err.message}`)))
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Python 종료 코드: ${code}`))
        return
      }
      try {
        resolve(JSON.parse(stdout.trim()))
      } catch {
        reject(new Error(`JSON 파싱 실패: ${stdout.slice(0, 200)}`))
      }
    })
  })
}

export async function POST(request: NextRequest) {
  const tmpDir = path.join(tmpdir(), `medi-${Date.now()}`)
  const savedPaths: string[] = []

  try {
    await mkdir(tmpDir, { recursive: true })

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (files.length < 2) {
      return NextResponse.json(
        { error: "기본진료정보 + 세부진료정보 PDF를 모두 업로드해 주세요." },
        { status: 400 }
      )
    }

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const safeName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, "_")
      const tmpPath = path.join(tmpDir, safeName)
      await writeFile(tmpPath, buffer)
      savedPaths.push(tmpPath)
    }

    const result = await callPythonParser(savedPaths)

    if (result && typeof result === "object" && "error" in result) {
      return NextResponse.json(result, { status: 422 })
    }

    return NextResponse.json(result)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류"
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    for (const p of savedPaths) {
      await unlink(p).catch(() => {})
    }
  }
}
