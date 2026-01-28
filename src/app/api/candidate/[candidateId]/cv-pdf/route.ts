import { PDFDocument, StandardFonts, rgb, PDFPage } from "pdf-lib";
import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  context: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId } = await context.params;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const supabase = await supabaseServer();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return new NextResponse("Missing jobId", { status: 400 });
    }

    // 🔓 Check unlock
    const { data: unlock } = await supabase
      .from("candidate_unlocks")
      .select("id")
      .eq("recruiter_id", user.id)
      .eq("job_id", jobId)
      .maybeSingle();

    if (!unlock) {
      return new NextResponse("Not unlocked", { status: 403 });
    }

    // 📄 Fetch CV
    const { data: candidate } = await supabase
      .from("candidates")
      .select("name, cv_text")
      .eq("id", candidateId)
      .single();

    if (!candidate?.cv_text) {
      return new NextResponse("CV not found", { status: 404 });
    }

    // 🖼️ LOAD LOGO (ADDED)
    const logoPath = path.join(process.cwd(), "public/elwasta-logo.png");
    const logoBytes = fs.readFileSync(logoPath);

    // 📄 Generate PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const logoImage = await pdfDoc.embedPng(logoBytes);

    // 📐 Layout constants (ADDED)
    const margin = 50;
    const headerHeight = 60;
    const footerHeight = 40;
    const fontSize = 11;
    const lineHeight = fontSize + 4;

    // 🧠 Header / Footer drawer (ADDED)
    const drawHeaderFooter = (
      page: PDFPage,
      pageNumber: number,
      totalPages: number
    ) => {
      const { width, height } = page.getSize();

      // Header logo
      page.drawImage(logoImage, {
        x: margin,
        y: height - headerHeight + 15,
        width: 90,
        height: 30,
      });

      // Header divider
      page.drawLine({
        start: { x: margin, y: height - headerHeight },
        end: { x: width - margin, y: height - headerHeight },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
      });

      // Footer page number
      page.drawText(`Page ${pageNumber} of ${totalPages}`, {
        x: width / 2 - 30,
        y: footerHeight / 2,
        size: 9,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    };

    // ➕ First page
    let page = pdfDoc.addPage();
    let { width, height } = page.getSize();

    const maxWidth = width - margin * 2;
    let y = height - headerHeight - margin;

    // Title
    page.drawText(candidate.name ?? "Candidate CV", {
      x: margin,
      y,
      size: 18,
      font,
    });
    y -= 30;

    // Helper: wrap text by real font width
    const wrapText = (text: string) => {
      const words = text.split(" ");
      const lines: string[] = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine
          ? `${currentLine} ${word}`
          : word;

        const testWidth = font.widthOfTextAtSize(
          testLine,
          fontSize
        );

        if (testWidth <= maxWidth) {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }

      if (currentLine) lines.push(currentLine);
      return lines;
    };

    const paragraphs = candidate.cv_text
      .replace(/\r\n/g, "\n")
      .split("\n");

    const lines: string[] = [];

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === "") {
        lines.push("");
        continue;
      }

      lines.push(...wrapText(paragraph));
    }

    for (const line of lines) {
      if (y < footerHeight + margin) {
        page = pdfDoc.addPage();
        ({ width, height } = page.getSize());
        y = height - headerHeight - margin;
      }

      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
      });

      y -= lineHeight;
    }

    // 🔢 Apply header & footer to all pages (ADDED)
    const pages = pdfDoc.getPages();
    pages.forEach((p, index) => {
      drawHeaderFooter(p, index + 1, pages.length);
    });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${
          candidate.name ?? "candidate"
        }-CV.pdf"`,
      },
    });
  } catch (err) {
    console.error("CV PDF ERROR:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
