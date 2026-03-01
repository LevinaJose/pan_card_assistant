from flask import Flask, request, jsonify
from flask_cors import CORS
import pytesseract
import cv2
import numpy as np
from PIL import Image
import re
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime

app = Flask(__name__)
CORS(app)

# ================================
# Tesseract Path (Windows)
# ================================
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# ================================
# MongoDB Connection
# ================================
client = MongoClient("mongodb://localhost:27017/")
db = client["gov_doc_ai"]
collection = db["applications"]


# ================================
# OCR PROCESS ROUTE
# ================================
@app.route("/process", methods=["POST"])
def process_aadhaar():
    file = request.files.get("aadhaar")

    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    # Convert image
    image = Image.open(file.stream).convert("RGB")
    img = np.array(image)

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # OCR
    text = pytesseract.image_to_string(gray, config="--psm 6")
    text = text.replace("\n\n", "\n")
    print("OCR RAW TEXT:\n", text)

    extracted_data = extract_fields(text)

    # Add metadata
    extracted_data["confidence"] = calculate_confidence(extracted_data)
    extracted_data["verified"] = False
    extracted_data["created_at"] = datetime.utcnow()

    # Insert into MongoDB
    inserted = collection.insert_one(extracted_data)

    # Convert ObjectId to string for JSON response
    extracted_data["_id"] = str(inserted.inserted_id)

    return jsonify(extracted_data)


# ================================
# CONFIRM ROUTE
# ================================
@app.route("/confirm/<id>", methods=["PUT"])
def confirm_data(id):
    updated_data = request.json

    # Remove _id from update payload — MongoDB does not allow updating immutable _id field
    updated_data.pop("_id", None)

    # Also remove created_at so we don't overwrite it
    updated_data.pop("created_at", None)

    collection.update_one(
        {"_id": ObjectId(id)},
        {"$set": {
            **updated_data,
            "verified": True,
            "confirmed_at": datetime.utcnow()
        }}
    )

    return jsonify({"status": "confirmed"})


# ================================
# FIELD EXTRACTION
# ================================
def extract_fields(text):

    data = {
        "first_name": "",
        "middle_name": "",
        "last_name": "",
        "dob": "",
        "gender": "",
        "aadhaar_number": "",
        "address": "",
        "email": "",
        "mobile": ""
    }

    # Aadhaar number — 12 digits in groups of 4
    aadhaar_match = re.search(r"\b\d{4}\s\d{4}\s\d{4}\b", text)
    if aadhaar_match:
        data["aadhaar_number"] = aadhaar_match.group()

    # DOB — supports DD/MM/YYYY and DD-MM-YYYY
    dob_match = re.search(r"(\d{2})[\/\-](\d{2})[\/\-](\d{4})", text)
    if dob_match:
        day   = dob_match.group(1)
        month = dob_match.group(2)
        year  = dob_match.group(3)
        data["dob"] = f"{year}-{month}-{day}"

    # Gender
    gender_match = re.search(r"\b(MALE|FEMALE)\b", text, re.IGNORECASE)
    if gender_match:
        data["gender"] = gender_match.group().title()

    # Name — find first clean alphabetic line that isn't a keyword
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    for line in lines:
        upper = line.upper()
        if any(word in upper for word in [
            "DOB", "MALE", "FEMALE", "GOVERNMENT", "INDIA",
            "AADHAAR", "UNIQUE", "AUTHORITY", "VID", "HELP"
        ]):
            continue

        # Must be alphabetic words only, 1-3 words
        if line.replace(" ", "").isalpha() and 1 <= len(line.split()) <= 3:
            parts = line.split()
            data["first_name"] = parts[0]

            if len(parts) == 2:
                data["last_name"] = parts[1]

            if len(parts) == 3:
                data["middle_name"] = parts[1]
                data["last_name"]   = parts[2]

            break

    # Address — take last few meaningful lines
    clean_text = re.sub(
        r"(DOB[:\s]*\d{2}[\/\-]\d{2}[\/\-]\d{4}|MALE|FEMALE|S/O|D/O|W/O|\d{4}\s\d{4}\s\d{4})",
        "",
        text,
        flags=re.IGNORECASE
    )

    clean_lines = [l.strip() for l in clean_text.split("\n") if l.strip()]

    if len(clean_lines) >= 3:
        data["address"] = " ".join(clean_lines[-3:])
    elif clean_lines:
        data["address"] = " ".join(clean_lines)

    return data


# ================================
# CONFIDENCE CALCULATION
# ================================
def calculate_confidence(data):
    score = 0

    if data.get("aadhaar_number"):
        score += 0.3
    if data.get("dob"):
        score += 0.3
    if data.get("first_name"):
        score += 0.2
    if data.get("address"):
        score += 0.2

    return round(score, 2)


# ================================
# RUN SERVER
# ================================
if __name__ == "__main__":
    app.run(debug=True)
    
    