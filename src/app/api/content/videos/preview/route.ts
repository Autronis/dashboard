import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// POST: Save script to a file that Remotion Root reads as defaultProps
export async function POST(req: NextRequest) {
  try {
    const { script } = await req.json() as { script: unknown };
    if (!script) {
      return NextResponse.json({ fout: "Script is verplicht" }, { status: 400 });
    }

    const propsPath = path.join(process.cwd(), "src", "remotion", "preview-props.json");
    fs.writeFileSync(propsPath, JSON.stringify(script, null, 2));

    return NextResponse.json({ succes: true, pad: propsPath });
  } catch (error) {
    return NextResponse.json({ fout: error instanceof Error ? error.message : "Opslaan mislukt" }, { status: 500 });
  }
}

// GET: Read current preview props
export async function GET() {
  try {
    const propsPath = path.join(process.cwd(), "src", "remotion", "preview-props.json");
    if (!fs.existsSync(propsPath)) {
      return NextResponse.json({ script: null });
    }
    const content = fs.readFileSync(propsPath, "utf-8");
    return NextResponse.json({ script: JSON.parse(content) });
  } catch {
    return NextResponse.json({ script: null });
  }
}
