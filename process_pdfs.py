import fitz  # PyMuPDF
import os
import re

pdf_dir = "raw_pdfs"
out_dir = os.path.join("public", "materials")

if not os.path.exists(out_dir):
    os.makedirs(out_dir)

# Helper function to find page numbers of units
def find_unit_pages(doc):
    unit_pages = {}
    
    # We look for large bold text or just the text "Unit 1", "Unit 2" etc.
    # A robust way is to just search the document text for the exact headers,
    # but since it's a TOC, it's easier to just find the first occurrence of 
    # "UNIT 1", "UNIT 2" as a header on the actual pages (not TOC).
    # Actually, scanning the TOC on page 2 (index 1) is very reliable.
    
    toc_page = doc[1].get_text()
    
    # regex to match "Unit 1 - Introduction 3" -> groups: ("1", "3")
    unit_pattern = re.compile(r"Unit\s+(\d+)\s+-\s+.*?\s+(\d+)", re.IGNORECASE)
    extra_pattern = re.compile(r"Extra Challenges.*?\s+(\d+)", re.IGNORECASE)
    
    matches = unit_pattern.findall(toc_page)
    for m in matches:
        unit_num = int(m[0])
        page_num = int(m[1])
        unit_pages[unit_num] = page_num
        
    extra_match = extra_pattern.search(toc_page)
    if extra_match:
        unit_pages[6] = int(extra_match.group(1)) # Treat extra as Unit 6
        
    # If TOC parsing fails, use fallback hardcoded (approx) or raise error
    if len(unit_pages) < 5:
        print("TOC parsing failed, trying text search across pages...")
        for i in range(2, len(doc)):
            text = doc[i].get_text()
            if re.search(r"^UNIT\s+1\b", text, re.IGNORECASE | re.MULTILINE) and 1 not in unit_pages: unit_pages[1] = i + 1
            if re.search(r"^UNIT\s+2\b", text, re.IGNORECASE | re.MULTILINE) and 2 not in unit_pages: unit_pages[2] = i + 1
            if re.search(r"^UNIT\s+3\b", text, re.IGNORECASE | re.MULTILINE) and 3 not in unit_pages: unit_pages[3] = i + 1
            if re.search(r"^UNIT\s+4\b", text, re.IGNORECASE | re.MULTILINE) and 4 not in unit_pages: unit_pages[4] = i + 1
            if re.search(r"^UNIT\s+5\b", text, re.IGNORECASE | re.MULTILINE) and 5 not in unit_pages: unit_pages[5] = i + 1
            if re.search(r"^Extra Challenges", text, re.IGNORECASE | re.MULTILINE) and 6 not in unit_pages: unit_pages[6] = i + 1

    # Ensure we have all 6
    if 6 not in unit_pages:
        unit_pages[6] = len(doc) - 3 # approx
        
    # Build ranges
    ranges = []
    # Sort unit keys
    keys = sorted(unit_pages.keys())
    for i in range(len(keys)):
        start_page = unit_pages[keys[i]]
        if i < len(keys) - 1:
            end_page = unit_pages[keys[i+1]] - 1
        else:
            end_page = len(doc)
            
        ranges.append((keys[i], start_page, end_page))
        
    return ranges

def create_watermark(width, height):
    # Create a simple PDF in memory using fitz to act as a watermark
    wm_doc = fitz.open()
    page = wm_doc.new_page(width=width, height=height)
    
    text = "PIXIU TECH - VIEW ONLY"
    
    # Calculate diagonal
    import math
    angle = 45
    
    # Insert text with some transparency and rotation
    # PyMuPDF supports insert_text with rotation and opacity
    # We will use insert_textbox for better control
    rect = fitz.Rect(0, 0, width, height)
    
    # We need a font
    font = fitz.Font("helv")
    
    # We just draw the text multiple times or big in the center
    # Matrix for rotation
    mat = fitz.Matrix(math.cos(math.radians(angle)), math.sin(math.radians(angle)), 
                     -math.sin(math.radians(angle)), math.cos(math.radians(angle)), 
                     width/4, height/2)
    
    page.insert_text((0, 0), text, fontsize=60, fontname="helv", color=(0.8, 0.8, 0.8), fill_opacity=0.5, morph=mat)
    return wm_doc

def process_pdf(filepath, class_num):
    print(f"Processing Class {class_num}...")
    doc = fitz.open(filepath)
    ranges = find_unit_pages(doc)
    
    print(f"  Found ranges: {ranges}")
    
    for (unit_num, start_p, end_p) in ranges:
        # PyMuPDF uses 0-based indexing, the printed page numbers are usually offset by something.
        # Generally, printed page 3 is PDF page 2. Let's assume PDF index = printed_page - 1.
        
        start_idx = max(0, start_p - 1)
        end_idx = min(len(doc) - 1, end_p - 1)
        
        # 1) Teacher Pack (No watermark)
        teacher_doc = fitz.open()
        teacher_doc.insert_pdf(doc, from_page=start_idx, to_page=end_idx)
        teacher_filename = f"class{class_num}-unit{unit_num}-teacher.pdf"
        teacher_doc.save(os.path.join(out_dir, teacher_filename))
        teacher_doc.close()
        
        # 2) Student Book (Watermarked)
        student_doc = fitz.open()
        student_doc.insert_pdf(doc, from_page=start_idx, to_page=end_idx)
        
        for page in student_doc:
            # Add watermark
            wm_text = "PIXIU TECH - VIEW ONLY"
            page.insert_text((50, page.rect.height / 2), wm_text, fontsize=50, color=(0.8, 0.8, 0.8), fill_opacity=0.4)
            page.insert_text((50, 100), wm_text, fontsize=50, color=(0.8, 0.8, 0.8), fill_opacity=0.4)
            page.insert_text((50, page.rect.height - 100), wm_text, fontsize=50, color=(0.8, 0.8, 0.8), fill_opacity=0.4)
            
        student_filename = f"class{class_num}-unit{unit_num}-student-watermarked.pdf"
        student_doc.save(os.path.join(out_dir, student_filename))
        student_doc.close()
        
    doc.close()

# Process all PDFs in raw_pdfs
for file in os.listdir(pdf_dir):
    if file.endswith(".pdf"):
        m = re.search(r"Class(\d+)", file, re.IGNORECASE)
        if m:
            class_num = int(m.group(1))
            process_pdf(os.path.join(pdf_dir, file), class_num)

print("All PDFs successfully split, watermarked, and saved to public/materials!")
