"""
Production CBC Analyzer OCR
Single-file implementation for Licare-style hematology analyzer screens

INSTALLATION
============

1. Install Python 3.10

2. Install dependencies:

pip install paddleocr==2.7.3
pip install paddlepaddle==2.6.1
pip install opencv-python numpy

RUN
===

python cbc_ocr.py cbc.jpg

OUTPUT
======

Creates:
- debug_original.png
- debug_processed.png
- debug_table.png
- debug_rows/
- extracted_results.json

"""

import cv2
import numpy as np
from paddleocr import PaddleOCR
import json
import os
import sys
import re
from difflib import SequenceMatcher


# =========================================================
# OCR ENGINE
# =========================================================

ocr = PaddleOCR(
    use_angle_cls=True,
    lang='en',
    use_gpu=False,
    show_log=False,
    det_db_thresh=0.2,
    det_db_box_thresh=0.3,
    rec_algorithm='SVTR_LCNet'
)


# =========================================================
# LAYOUT CONFIG
# =========================================================

class Layout:

    # TABLE AREA (adjust if needed)
    TABLE_X1 = 40
    TABLE_Y1 = 130
    TABLE_X2 = 970
    TABLE_Y2 = 620

    ROW_HEIGHT = 31
    START_Y = 55
    TOTAL_ROWS = 21

    # COLUMN POSITIONS
    PARAM_COL = (0, 120)
    VALUE_COL = (120, 240)
    UNIT_COL = (240, 380)
    RANGE_COL = (380, 620)

    PARAMETERS = [
        "WBC",
        "Lymph#",
        "Mid#",
        "Gran#",
        "Lymph%",
        "Mid%",
        "Gran%",
        "RBC",
        "HGB",
        "HCT",
        "MCV",
        "MCH",
        "MCHC",
        "RDW-CV",
        "RDW-SD",
        "PLT",
        "MPV",
        "PDW",
        "PCT",
        "P-LCC",
        "P-LCR",
    ]


# =========================================================
# HELPERS
# =========================================================

def save_debug(name, image):

    cv2.imwrite(name, image)


def similarity(a, b):

    return SequenceMatcher(None, a, b).ratio()


def clean_text(text):

    text = text.strip()

    text = text.replace("O", "0")
    text = text.replace("o", "0")
    text = text.replace(",", ".")
    text = text.replace("|", "1")

    return text


def normalize_unit(text):

    text = text.replace("1049", "10^9/L")
    text = text.replace("1012", "10^12/L")
    text = text.replace("10A9", "10^9/L")
    text = text.replace("10A12", "10^12/L")

    return text


def normalize_parameter(text):

    text = text.strip()

    corrections = {
        "WEC": "WBC",
        "R8C": "RBC",
        "PL1": "PLT",
        "H68": "HGB",
    }

    if text in corrections:
        return corrections[text]

    best_match = text
    best_score = 0

    for param in Layout.PARAMETERS:

        score = similarity(text, param)

        if score > best_score:
            best_score = score
            best_match = param

    if best_score > 0.6:
        return best_match

    return text


def extract_ocr(image):

    result = ocr.ocr(image, cls=True)

    if not result or not result[0]:
        return "", 0.0

    texts = []
    confs = []

    for line in result[0]:

        txt = line[1][0]
        conf = line[1][1]

        texts.append(txt)
        confs.append(conf)

    final_text = " ".join(texts)

    confidence = float(np.mean(confs))

    return final_text, confidence


# =========================================================
# PREPROCESSING
# =========================================================

def resize_image(image):

    h, w = image.shape[:2]

    max_width = 1400

    if w > max_width:

        scale = max_width / w

        image = cv2.resize(
            image,
            (int(w * scale), int(h * scale))
        )

    return image


def correct_perspective(image):

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    blur = cv2.GaussianBlur(gray, (5, 5), 0)

    edges = cv2.Canny(blur, 50, 150)

    contours, _ = cv2.findContours(
        edges,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    for cnt in contours[:5]:

        peri = cv2.arcLength(cnt, True)

        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)

        if len(approx) == 4:

            pts = approx.reshape(4, 2)

            return four_point_transform(image, pts)

    return image


def four_point_transform(image, pts):

    rect = np.zeros((4, 2), dtype="float32")

    s = pts.sum(axis=1)

    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    diff = np.diff(pts, axis=1)

    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]

    (tl, tr, br, bl) = rect

    widthA = np.linalg.norm(br - bl)
    widthB = np.linalg.norm(tr - tl)

    maxWidth = max(int(widthA), int(widthB))

    heightA = np.linalg.norm(tr - br)
    heightB = np.linalg.norm(tl - bl)

    maxHeight = max(int(heightA), int(heightB))

    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")

    M = cv2.getPerspectiveTransform(rect, dst)

    warped = cv2.warpPerspective(
        image,
        M,
        (maxWidth, maxHeight)
    )

    return warped


def preprocess(image):

    image = resize_image(image)

    image = correct_perspective(image)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # CLAHE
    clahe = cv2.createCLAHE(
        clipLimit=3.0,
        tileGridSize=(8, 8)
    )

    gray = clahe.apply(gray)

    # DENOISE
    gray = cv2.fastNlMeansDenoising(
        gray,
        None,
        h=10,
        templateWindowSize=7,
        searchWindowSize=21
    )

    # IMPORTANT:
    # PaddleOCR often works BETTER on grayscale
    # than aggressive thresholding

    return gray


# =========================================================
# TABLE EXTRACTION
# =========================================================

def crop_table(image):

    return image[
        Layout.TABLE_Y1:Layout.TABLE_Y2,
        Layout.TABLE_X1:Layout.TABLE_X2
    ]


def extract_rows(table):

    rows = []

    y = Layout.START_Y

    for i in range(Layout.TOTAL_ROWS):

        row = table[
            y:y + Layout.ROW_HEIGHT,
            :
        ]

        rows.append(row)

        y += Layout.ROW_HEIGHT

    return rows


def crop_columns(row):

    param_crop = row[
        :,
        Layout.PARAM_COL[0]:Layout.PARAM_COL[1]
    ]

    value_crop = row[
        :,
        Layout.VALUE_COL[0]:Layout.VALUE_COL[1]
    ]

    unit_crop = row[
        :,
        Layout.UNIT_COL[0]:Layout.UNIT_COL[1]
    ]

    range_crop = row[
        :,
        Layout.RANGE_COL[0]:Layout.RANGE_COL[1]
    ]

    return (
        param_crop,
        value_crop,
        unit_crop,
        range_crop
    )


# =========================================================
# MAIN EXTRACTION
# =========================================================

def parse_row(row, row_index):

    (
        param_crop,
        value_crop,
        unit_crop,
        range_crop
    ) = crop_columns(row)

    os.makedirs("debug_rows", exist_ok=True)

    save_debug(f"debug_rows/row_{row_index}_param.png", param_crop)
    save_debug(f"debug_rows/row_{row_index}_value.png", value_crop)
    save_debug(f"debug_rows/row_{row_index}_unit.png", unit_crop)
    save_debug(f"debug_rows/row_{row_index}_range.png", range_crop)

    param_text, param_conf = extract_ocr(param_crop)

    if not param_text:
        return None

    parameter = normalize_parameter(param_text)

    if parameter not in Layout.PARAMETERS:
        return None

    value_text, value_conf = extract_ocr(value_crop)
    unit_text, unit_conf = extract_ocr(unit_crop)
    range_text, range_conf = extract_ocr(range_crop)

    value_text = clean_text(value_text)
    unit_text = normalize_unit(clean_text(unit_text))
    range_text = clean_text(range_text)

    confidence = np.mean([
        param_conf,
        value_conf,
        unit_conf,
        range_conf
    ])

    return {
        "parameter": parameter,
        "value": value_text,
        "unit": unit_text,
        "range": range_text,
        "confidence": round(float(confidence), 3)
    }


def extract_cbc(image_path):

    image = cv2.imread(image_path)

    if image is None:
        raise Exception("Failed to load image")

    save_debug("debug_original.png", image)

    processed = preprocess(image)

    save_debug("debug_processed.png", processed)

    table = crop_table(processed)

    save_debug("debug_table.png", table)

    rows = extract_rows(table)

    results = {}

    for idx, row in enumerate(rows):

        parsed = parse_row(row, idx)

        if parsed:

            results[parsed["parameter"]] = {
                "value": parsed["value"],
                "unit": parsed["unit"],
                "range": parsed["range"],
                "confidence": parsed["confidence"]
            }

    return results


# =========================================================
# MAIN
# =========================================================

if __name__ == "__main__":

    if len(sys.argv) < 2:

        print("Usage:")
        print("python cbc_ocr.py image.jpg")

        sys.exit(1)

    image_path = sys.argv[1]

    results = extract_cbc(image_path)

    with open("extracted_results.json", "w") as f:

        json.dump(results, f, indent=2)

    print("\n==============================")
    print("EXTRACTED CBC RESULTS")
    print("==============================\n")

    print(json.dumps(results, indent=2))

    print("\nSaved:")
    print("- extracted_results.json")
    print("- debug images")
