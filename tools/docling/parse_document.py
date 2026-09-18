from __future__ import annotations

import argparse
import json
import os
import sys
import zipfile
from pathlib import Path

MAX_BYTES = 10 * 1024 * 1024


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(2)


def validate_input(source: Path, kind: str) -> None:
    if not source.is_file():
        fail("找不到要解析的文件")
    if source.stat().st_size > MAX_BYTES:
        fail("文件超過 10 MB 上限")
    prefix = source.read_bytes()[:5]
    if kind == "pdf" and prefix != b"%PDF-":
        fail("PDF 檔案標頭不正確")
    if kind == "docx":
        try:
            with zipfile.ZipFile(source) as archive:
                names = set(archive.namelist())
                if "[Content_Types].xml" not in names or "word/document.xml" not in names:
                    fail("DOCX 結構不完整")
        except zipfile.BadZipFile:
            fail("DOCX 不是有效的 ZIP 文件")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--metadata", required=True)
    parser.add_argument("--format", choices=("pdf", "docx"), required=True)
    parser.add_argument("--models", required=True)
    args = parser.parse_args()

    # The parent process also sets these. Setting them here makes direct runs safe.
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["DOCLING_SERVE_ENABLE_REMOTE_SERVICES"] = "false"

    source = Path(args.input).resolve()
    output = Path(args.output).resolve()
    metadata = Path(args.metadata).resolve()
    models = Path(args.models).resolve()
    validate_input(source, args.format)

    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption, WordFormatOption
    from docling.pipeline.simple_pipeline import SimplePipeline

    if args.format == "pdf":
        if not models.is_dir() or not any(models.iterdir()):
            fail("PDF 本機模型尚未安裝，請執行第二階段安裝程序")
        pdf_options = PdfPipelineOptions()
        pdf_options.artifacts_path = models
        pdf_options.do_ocr = False
        pdf_options.do_table_structure = True
        pdf_options.enable_remote_services = False
        pdf_options.allow_external_plugins = False
        converter = DocumentConverter(
            allowed_formats=[InputFormat.PDF],
            format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_options)},
        )
    else:
        converter = DocumentConverter(
            allowed_formats=[InputFormat.DOCX],
            format_options={InputFormat.DOCX: WordFormatOption(pipeline_cls=SimplePipeline)},
        )

    result = converter.convert(source, max_file_size=MAX_BYTES, max_num_pages=200)
    status = getattr(result.status, "value", str(result.status)).lower()
    if status != "success":
        fail(f"文件解析未完整成功：{status}")
    markdown = result.document.export_to_markdown().strip()
    pages = len(getattr(result.document, "pages", {}) or {})
    if args.format == "pdf" and len(markdown) < 20:
        fail("PDF 沒有可擷取的文字；掃描型 PDF 目前未啟用 OCR")
    if not markdown:
        fail("文件沒有可供派工的文字內容")

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(markdown, encoding="utf-8")
    metadata.write_text(
        json.dumps(
            {"status": "success", "characters": len(markdown), "pages": pages or None},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
