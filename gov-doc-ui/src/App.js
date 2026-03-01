import React, { useState } from "react";

function App() {
  const [page, setPage] = useState("upload");
  const [editable, setEditable] = useState(false);
  const [error, setError] = useState("");
  const [showRedirectMsg, setShowRedirectMsg] = useState(false);
  const [loading, setLoading] = useState(false);

  const [aadhaar, setAadhaar] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [signature, setSignature] = useState(null);

  const [form, setForm] = useState({});

  // ================================
  // FILE VALIDATION
  // ================================
  const validateFile = (file, maxSizeMB, allowedTypes) => {
    if (!file) return false;

    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type");
      return false;
    }

    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File must be less than ${maxSizeMB} MB`);
      return false;
    }

    setError("");
    return true;
  };

  // ================================
  // STEP 1: UPLOAD & OCR
  // ================================
  const handleSubmit = async () => {
    if (!aadhaar || !photo || !signature) {
      setError("All documents are required");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("aadhaar", aadhaar);
    formData.append("photo", photo);
    formData.append("signature", signature);

    try {
      const res = await fetch("http://127.0.0.1:5000/process", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      setForm(data);
      setPage("review");
    } catch {
      setError("OCR processing failed. Is the Flask server running?");
    } finally {
      setLoading(false);
    }
  };

  // ================================
  // STEP 2: CONFIRM & AUTOFILL
  // ================================
  const handleConfirm = async () => {
    setLoading(true);
    setError("");

    try {
      // Save confirmed data to MongoDB
      await fetch(`http://127.0.0.1:5000/confirm/${form._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      // Trigger Puppeteer autofill
      const res = await fetch("http://127.0.0.1:4000/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const result = await res.json();

      if (result.status === "success") {
        setShowRedirectMsg(true);
      }
    } catch {
      setError("Autofill failed. Make sure the Puppeteer service is running on port 4000.");
    } finally {
      setLoading(false);
    }
  };

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ================================
  // REVIEW PAGE
  // ================================
  if (page === "review") {
    return (
      <div style={wrap}>
        <div style={card}>

          {/* Header */}
          <div style={pageHeader}>
            <h2 style={{ color: "#002e6e" }}>Review & Edit Details</h2>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {form.confidence !== undefined && (
                <span style={confidenceBadge(form.confidence)}>
                  Confidence: {Math.round(form.confidence * 100)}%
                </span>
              )}
              <button style={editBtn} onClick={() => setEditable(!editable)}>
                {editable ? "🔒 Lock" : "✏️ Edit"}
              </button>
            </div>
          </div>

          {editable && (
            <div style={editNotice}>
              ✏️ Edit mode is ON — you can correct any OCR errors before submitting.
            </div>
          )}

          {/* Personal Details */}
          <Section title="Personal Details">
            <Field label="Aadhaar Number"  value={form.aadhaar_number} editable={false} />
            <Field label="First Name"      value={form.first_name}     onChange={v => update("first_name", v)}  editable={editable} />
            <Field label="Middle Name"     value={form.middle_name}    onChange={v => update("middle_name", v)} editable={editable} />
            <Field label="Last Name"       value={form.last_name}      onChange={v => update("last_name", v)}   editable={editable} />
            <Select
              label="Gender"
              value={form.gender}
              options={["Male", "Female", "Other"]}
              onChange={v => update("gender", v)}
              editable={editable}
            />
            <Field label="Date of Birth" type="date" value={form.dob} onChange={v => update("dob", v)} editable={editable} />
          </Section>

          {/* Contact Details */}
          <Section title="Contact Details">
            <Field label="Mobile" value={form.mobile} onChange={v => update("mobile", v)} editable={editable} />
            <Field label="Email"  value={form.email}  onChange={v => update("email", v)}  editable={editable} />
          </Section>

          {/* Address */}
          <Section title="Address for Communication">
            <Field label="Flat / Door No"    value={form.flat_no}  onChange={v => update("flat_no", v)}  editable={editable} />
            <Field label="Building / Village" value={form.building} onChange={v => update("building", v)} editable={editable} />
            <Field label="Road / Street"     value={form.road}     onChange={v => update("road", v)}     editable={editable} />
            <Field label="Area / Locality"   value={form.locality} onChange={v => update("locality", v)} editable={editable} />
            <Field label="Town / City"       value={form.city}     onChange={v => update("city", v)}     editable={editable} />
            <Field label="District"          value={form.district} onChange={v => update("district", v)} editable={editable} />
            <Select
              label="Resident State"
              value={form.residentState}
              options={["Kerala", "Tamil Nadu", "Karnataka", "Maharashtra", "Delhi", "Uttar Pradesh"]}
              onChange={v => update("residentState", v)}
              editable={editable}
            />
            <Field label="Pincode" value={form.pincode} onChange={v => update("pincode", v)} editable={editable} />
          </Section>

          {/* AO Code */}
          <Section title="AO Code">
            <Field label="Area Code"  value={form.areaCode}  onChange={v => update("areaCode", v)}  editable={editable} />
            <Field label="AO Type"    value={form.aoType}    onChange={v => update("aoType", v)}    editable={editable} />
            <Field label="Range Code" value={form.rangeCode} onChange={v => update("rangeCode", v)} editable={editable} />
            <Field label="AO Number"  value={form.aoNumber}  onChange={v => update("aoNumber", v)}  editable={editable} />
          </Section>

          {/* Representative Assessee */}
          <Section title="Representative Assessee Address">
            <Field label="First Name"    value={form.rep_first}    onChange={v => update("rep_first", v)}    editable={editable} />
            <Field label="Last Name"     value={form.rep_last}     onChange={v => update("rep_last", v)}     editable={editable} />
            <Field label="Area/Locality" value={form.rep_area}     onChange={v => update("rep_area", v)}     editable={editable} />
            <Field label="District"      value={form.rep_district} onChange={v => update("rep_district", v)} editable={editable} />
            <Select
              label="State"
              value={form.rep_state}
              options={["Kerala", "Tamil Nadu", "Karnataka"]}
              onChange={v => update("rep_state", v)}
              editable={editable}
            />
            <Select
              label="Declaration"
              value={form.declaration}
              options={["Himself / Herself", "Authorized Signatory"]}
              onChange={v => update("declaration", v)}
              editable={editable}
            />
            <Field label="Verifier Name"       value={form.verifier}           onChange={v => update("verifier", v)}           editable={editable} />
            <Field label="Verification Place"  value={form.verification_place} onChange={v => update("verification_place", v)} editable={editable} />
          </Section>

          {/* Error */}
          {error && <p style={{ color: "red", marginBottom: 10 }}>{error}</p>}

          {/* Success message */}
          {showRedirectMsg && (
            <div style={successBox}>
              ✅ Data confirmed! A browser window has opened and is filling the PAN form automatically.
              Please complete the payment when it reaches Step 7.
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button style={secondaryBtn} onClick={() => { setPage("upload"); setShowRedirectMsg(false); }}>
              ← Go Back
            </button>
            <button
              style={loading ? { ...submitBtn, opacity: 0.6 } : submitBtn}
              onClick={handleConfirm}
              disabled={loading || showRedirectMsg}
            >
              {loading ? "Processing..." : "✅ Confirm & Proceed"}
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ================================
  // UPLOAD PAGE
  // ================================
  return (
    <div style={wrap}>
      <div style={card}>

        <div style={pageHeader}>
          <h2 style={{ color: "#002e6e" }}>Upload Documents</h2>
          <p style={{ color: "#666", fontSize: 13 }}>
            Upload your Aadhaar card and we'll auto-fill your PAN application.
          </p>
        </div>

        <Upload
          label="Aadhaar Card"
          hint="PDF / JPG / PNG — Max 2MB"
          onChange={e => {
            const f = e.target.files[0];
            if (validateFile(f, 2, ["application/pdf", "image/jpeg", "image/png"])) {
              setAadhaar(f);
            }
          }}
        />

        <Upload
          label="Photograph"
          hint="JPG / PNG — Max 50KB"
          onChange={e => {
            const f = e.target.files[0];
            if (validateFile(f, 0.05, ["image/jpeg", "image/png"])) {
              setPhoto(f);
            }
          }}
        />

        <Upload
          label="Signature"
          hint="JPG / PNG — Max 50KB"
          onChange={e => {
            const f = e.target.files[0];
            if (validateFile(f, 0.05, ["image/jpeg", "image/png"])) {
              setSignature(f);
            }
          }}
        />

        {error && <p style={{ color: "red", marginBottom: 10 }}>{error}</p>}

        <button
          style={loading ? { ...submitBtn, opacity: 0.6 } : submitBtn}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Reading Document..." : "Process Documents →"}
        </button>

      </div>
    </div>
  );
}

// ================================
// UI HELPER COMPONENTS
// ================================

const Upload = ({ label, hint, onChange }) => (
  <div style={{ marginBottom: 22 }}>
    <label style={{ fontWeight: "700", fontSize: 14, display: "block", marginBottom: 4 }}>
      {label}
    </label>
    <span style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>{hint}</span>
    <input type="file" onChange={onChange} style={{ fontSize: 13 }} />
  </div>
);

const Section = ({ title, children }) => (
  <div style={sectionStyle}>
    <h3 style={sectionTitle}>{title}</h3>
    {children}
  </div>
);

const Field = ({ label, value, onChange, editable, type = "text" }) => (
  <div style={row}>
    <label style={rowLabel}>{label}</label>
    <input
      type={type}
      disabled={!editable}
      value={value || ""}
      onChange={e => onChange && onChange(e.target.value)}
      style={editable ? inputActive : inputDisabled}
    />
  </div>
);

const Select = ({ label, value, options, onChange, editable }) => (
  <div style={row}>
    <label style={rowLabel}>{label}</label>
    <select
      disabled={!editable}
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      style={editable ? inputActive : inputDisabled}
    >
      <option value="">Select</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

// ================================
// STYLES
// ================================

const wrap = {
  background: "#f4f6fb",
  minHeight: "100vh",
  padding: 30,
  fontFamily: "'Segoe UI', sans-serif"
};

const card = {
  background: "#fff",
  maxWidth: 900,
  margin: "auto",
  padding: 35,
  borderRadius: 10,
  boxShadow: "0 4px 20px rgba(0,0,0,0.1)"
};

const pageHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 25,
  paddingBottom: 15,
  borderBottom: "2px solid #f37321"
};

const sectionStyle = {
  background: "#faf7f2",
  border: "1px solid #e8ddd0",
  padding: "15px 20px",
  marginBottom: 20,
  borderRadius: 6
};

const sectionTitle = {
  fontSize: 14,
  fontWeight: "700",
  color: "#964404",
  marginBottom: 12,
  paddingBottom: 6,
  borderBottom: "1px solid #e0d0bc"
};

const row = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr",
  alignItems: "center",
  marginBottom: 10,
  gap: 10
};

const rowLabel = {
  fontSize: 13,
  color: "#555",
  fontWeight: "600"
};

const inputActive = {
  padding: "7px 10px",
  border: "1px solid #f37321",
  borderRadius: 4,
  fontSize: 13,
  width: "100%",
  background: "#fff9f5"
};

const inputDisabled = {
  padding: "7px 10px",
  border: "1px solid #ddd",
  borderRadius: 4,
  fontSize: 13,
  width: "100%",
  background: "#f9f9f9",
  color: "#333"
};

const editBtn = {
  padding: "8px 16px",
  background: "#002e6e",
  color: "white",
  border: "none",
  borderRadius: 5,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: "600"
};

const submitBtn = {
  flex: 1,
  padding: "12px 20px",
  background: "#f37321",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 15,
  fontWeight: "700"
};

const secondaryBtn = {
  flex: 1,
  padding: "12px 20px",
  background: "#e0e0e0",
  color: "#333",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: "600"
};

const editNotice = {
  background: "#fff3e0",
  border: "1px solid #f37321",
  padding: "10px 15px",
  borderRadius: 5,
  fontSize: 13,
  color: "#b54800",
  marginBottom: 15
};

const successBox = {
  background: "#e8f5e9",
  border: "1px solid #4caf50",
  padding: "15px",
  borderRadius: 6,
  color: "#2e7d32",
  fontWeight: "600",
  marginBottom: 15,
  fontSize: 14
};

const confidenceBadge = (score) => ({
  padding: "5px 12px",
  borderRadius: 20,
  fontSize: 12,
  fontWeight: "700",
  background: score >= 0.8 ? "#e8f5e9" : score >= 0.5 ? "#fff3e0" : "#ffebee",
  color: score >= 0.8 ? "#2e7d32" : score >= 0.5 ? "#e65100" : "#c62828"
});

export default App;